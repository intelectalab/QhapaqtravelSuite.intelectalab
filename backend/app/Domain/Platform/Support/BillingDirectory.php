<?php

declare(strict_types=1);

namespace App\Domain\Platform\Support;

use Illuminate\Database\ConnectionInterface;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

final class BillingDirectory
{
    private const CONNECTION = 'pgsql_platform';

    private const GAUGES = ['users', 'sedes'];

    private const USAGE_METRICS = ['users', 'sedes', 'storage_gb', 'reservations_month', 'whatsapp_month', 'email_month', 'api_calls_month'];

    public function __construct(
        private readonly PlatformSettings $settings,
        private readonly LocalGateway $gateway,
    ) {}

    public function invoices(): Collection
    {
        $notes = $this->db()->table('platform_credit_notes')->get(['invoice_id', 'series', 'number'])->keyBy('invoice_id');
        $attempts = $this->db()->table('payment_attempts')->selectRaw('invoice_id, count(*) as total')->groupBy('invoice_id')->pluck('total', 'invoice_id');

        return $this->invoiceQuery()->orderByDesc('i.issue_date')->orderByDesc('i.number')->get()
            ->map(fn (object $row) => $this->invoiceSummary($row, $notes[$row->id] ?? null, (int) ($attempts[$row->id] ?? 0)));
    }

    public function invoice(string $id): ?array
    {
        $row = $this->invoiceQuery()->where('i.id', $id)->first();

        if ($row === null) {
            return null;
        }

        $note = $this->db()->table('platform_credit_notes')->where('invoice_id', $id)->first();
        $attempts = $this->db()->table('payment_attempts')->where('invoice_id', $id)->orderBy('created_at')->get(['attempt_no', 'source', 'result', 'gateway_code', 'message', 'created_at']);

        return [
            ...$this->invoiceSummary($row, $note, $attempts->count()),
            'bill_to' => json_decode((string) $row->bill_to, true),
            'igv_pct' => (float) $row->igv_pct,
            'subtotal' => (float) $row->subtotal,
            'igv' => (float) $row->igv,
            'sunat_hash' => $row->sunat_hash,
            'void_reason' => $row->void_reason,
            'lines' => $this->db()->table('platform_invoice_lines')->where('invoice_id', $id)->orderBy('id')->get(['description', 'quantity', 'unit_price', 'amount', 'line_type'])
                ->map(fn (object $line) => ['description' => $line->description, 'quantity' => (float) $line->quantity, 'unit_price' => (float) $line->unit_price, 'amount' => (float) $line->amount, 'type' => $line->line_type]),
            'attempts' => $attempts->map(fn (object $attempt) => [
                'number' => (int) $attempt->attempt_no,
                'source' => $attempt->source,
                'result' => $attempt->result,
                'code' => $attempt->gateway_code,
                'message' => $attempt->message,
                'at' => Carbon::parse($attempt->created_at)->toIso8601String(),
            ]),
            'credit_note' => $note ? ['number' => PlatformSequence::format($note->series, (int) $note->number), 'reason' => $note->reason, 'amount' => (float) $note->amount, 'refund_ref' => $note->refund_ref, 'at' => Carbon::parse($note->created_at)->toIso8601String()] : null,
        ];
    }

    public function dunning(): array
    {
        $policy = $this->settings->dunning();
        $methods = $this->methods();
        $rows = $this->invoiceQuery()->whereIn('i.status', ['failed', 'uncollectible'])->orderBy('i.dunning_next_retry_at')->get();
        $last = $this->db()->table('payment_attempts')->whereIn('invoice_id', $rows->pluck('id'))->orderBy('created_at')->get()->groupBy('invoice_id')->map(fn (Collection $items) => $items->last());

        return [
            'policy' => $policy,
            'items' => $rows->map(function (object $row) use ($policy, $methods, $last): array {
                $failed = $row->dunning_failed_at ? Carbon::parse($row->dunning_failed_at, 'America/Lima') : Carbon::parse($row->issue_date, 'America/Lima');
                $done = (int) $row->dunning_retries_done;
                $count = count($policy['retry_days']);
                $attempt = $last[$row->id] ?? null;

                return [
                    ...$this->invoiceSummary($row, null, 0),
                    'failed_at' => $failed->toDateString(),
                    'retries_done' => $done,
                    'retries_total' => $count,
                    'extended_days' => (int) $row->dunning_extended_days,
                    'next_retry_at' => $row->dunning_next_retry_at ? Carbon::parse($row->dunning_next_retry_at)->toIso8601String() : null,
                    'decline_code' => $attempt?->gateway_code,
                    'decline_message' => $attempt?->message,
                    'payment_method' => $this->gateway->label($methods[$row->tenant_id] ?? null),
                    'payment_method_status' => ($methods[$row->tenant_id] ?? null)?->status,
                    'steps' => collect($policy['retry_days'])->map(function (int $days, int $index) use ($failed, $done, $count, $row): array {
                        $extra = $index === $count - 1 ? (int) $row->dunning_extended_days : 0;

                        return [
                            'label' => 'D+'.$days,
                            'date' => $failed->copy()->addDays($days + $extra)->toDateString(),
                            'state' => $index < $done ? 'done' : ($index === $done && $row->status === 'failed' ? 'next' : 'pending'),
                        ];
                    })->prepend(['label' => 'D0', 'date' => $failed->toDateString(), 'state' => 'done'])->values(),
                ];
            })->values(),
        ];
    }

    public function trials(): array
    {
        $today = Carbon::today('America/Lima');
        $methods = $this->methods();
        $users = $this->db()->table('iam_users')->whereNull('deleted_at')->where('status', 'activo')->selectRaw('tenant_id, count(*) as total')->groupBy('tenant_id')->pluck('total', 'tenant_id');

        $items = $this->db()->table('subscriptions as s')->join('tenants as t', 't.id', '=', 's.tenant_id')->join('plans as p', 'p.id', '=', 's.plan_id')
            ->where('s.status', 'trialing')->orderBy('s.trial_ends_at')
            ->get(['s.id', 's.code', 's.tenant_id', 's.cycle', 's.trial_starts_at', 's.trial_ends_at', 's.trial_extended_days', 's.lock_version', 't.code as tenant_code', 't.commercial_name', 't.admin_email', 'p.code as plan_code', 'p.name as plan_name', 'p.price_month'])
            ->map(fn (object $row) => [
                'id' => $row->id,
                'code' => $row->code,
                'cycle' => $row->cycle,
                'tenant' => ['code' => $row->tenant_code, 'name' => $row->commercial_name, 'email' => $row->admin_email],
                'plan' => ['code' => $row->plan_code, 'name' => $row->plan_name, 'price_month' => (float) $row->price_month],
                'starts_at' => $row->trial_starts_at,
                'ends_at' => $row->trial_ends_at,
                'days_left' => $row->trial_ends_at ? (int) $today->diffInDays(Carbon::parse($row->trial_ends_at, 'America/Lima'), false) : null,
                'extended_days' => (int) $row->trial_extended_days,
                'can_extend' => (int) $row->trial_extended_days + 7 <= 14,
                'payment_method' => $this->gateway->label($methods[$row->tenant_id] ?? null),
                'users' => (int) ($users[$row->tenant_id] ?? 0),
            ]);

        $coupons = $this->db()->table('coupons')->where('status', 'active')->where(fn ($query) => $query->whereNull('valid_to')->orWhere('valid_to', '>=', $today))
            ->whereRaw('(max_redemptions is null or redeemed_count < max_redemptions)')->orderBy('code')->get(['code', 'type', 'value', 'duration_cycles', 'plan_ids']);
        $plans = $this->db()->table('plans')->where('status', 'active')->orderBy('rank')->get(['id', 'code', 'name', 'rank', 'price_month', 'price_year']);

        return [
            'items' => $items->values(),
            'coupons' => $coupons->map(fn (object $coupon) => ['code' => $coupon->code, 'label' => $this->couponLabel($coupon), 'plans' => $plans->whereIn('id', $this->uuids($coupon->plan_ids))->pluck('code')->values()])->values(),
            'plans' => $plans->map(fn (object $plan) => ['code' => $plan->code, 'name' => $plan->name, 'rank' => (int) $plan->rank, 'price_month' => (float) $plan->price_month, 'price_year' => (float) $plan->price_year])->values(),
        ];
    }

    public function coupons(): Collection
    {
        $plans = $this->db()->table('plans')->orderBy('rank')->get(['id', 'code', 'name']);
        $today = Carbon::today('America/Lima');

        return $this->db()->table('coupons')->orderByDesc('created_at')->get()->map(fn (object $coupon) => [
            'id' => $coupon->id,
            'code' => $coupon->code,
            'type' => $coupon->type,
            'value' => (float) $coupon->value,
            'label' => $this->couponLabel($coupon),
            'duration_cycles' => (int) $coupon->duration_cycles,
            'plans' => $plans->whereIn('id', $this->uuids($coupon->plan_ids))->map(fn (object $plan) => ['code' => $plan->code, 'name' => $plan->name])->values(),
            'max_redemptions' => $coupon->max_redemptions === null ? null : (int) $coupon->max_redemptions,
            'redeemed' => (int) $coupon->redeemed_count,
            'valid_to' => $coupon->valid_to,
            'expired' => $coupon->valid_to !== null && Carbon::parse($coupon->valid_to, 'America/Lima')->lt($today),
            'exhausted' => $coupon->max_redemptions !== null && (int) $coupon->redeemed_count >= (int) $coupon->max_redemptions,
            'status' => $coupon->status,
            'note' => $coupon->note,
            'created_at' => Carbon::parse($coupon->created_at)->toIso8601String(),
        ]);
    }

    public function flags(): array
    {
        $plans = $this->db()->table('plans')->orderBy('rank')->get(['id', 'code', 'name', 'rank']);
        $values = $this->db()->table('plan_features')->get(['plan_id', 'feature_key', 'value'])->groupBy('feature_key');
        $today = Carbon::today('America/Lima');
        $overrides = $this->db()->table('feature_overrides as o')->join('tenants as t', 't.id', '=', 'o.tenant_id')->join('features as f', 'f.key', '=', 'o.feature_key')->leftJoin('platform_users as u', 'u.id', '=', 'o.granted_by')
            ->orderByDesc('o.created_at')->get(['o.id', 'o.feature_key', 'o.value', 'o.reason', 'o.valid_until', 'o.created_at', 't.code', 't.commercial_name', 'f.label', 'u.name as granted_by']);

        return [
            'plans' => $plans->map(fn (object $plan) => ['code' => $plan->code, 'name' => $plan->name, 'rank' => (int) $plan->rank])->values(),
            'features' => $this->db()->table('features')->orderBy('created_at')->get(['key', 'label', 'module', 'kind', 'addon_code'])->map(fn (object $feature) => [
                'key' => $feature->key,
                'label' => $feature->label,
                'module' => $feature->module,
                'kind' => $feature->kind,
                'addon' => $feature->addon_code,
                'values' => $plans->mapWithKeys(fn (object $plan) => [$plan->code => ($values[$feature->key] ?? collect())->firstWhere('plan_id', $plan->id)?->value])->all(),
                'overrides' => $overrides->where('feature_key', $feature->key)->count(),
            ])->values(),
            'overrides' => $overrides->map(fn (object $override) => [
                'id' => $override->id,
                'feature' => ['key' => $override->feature_key, 'label' => $override->label],
                'tenant' => ['code' => $override->code, 'name' => $override->commercial_name],
                'value' => (bool) $override->value,
                'reason' => $override->reason,
                'valid_until' => $override->valid_until,
                'active' => $override->valid_until === null || Carbon::parse($override->valid_until, 'America/Lima')->gte($today),
                'granted_by' => $override->granted_by,
                'created_at' => Carbon::parse($override->created_at)->toIso8601String(),
            ])->values(),
            'tenants' => $this->db()->table('tenants')->orderBy('commercial_name')->get(['code', 'commercial_name'])->map(fn (object $tenant) => ['code' => $tenant->code, 'name' => $tenant->commercial_name])->values(),
        ];
    }

    public function usage(): array
    {
        $month = Carbon::today('America/Lima')->startOfMonth();
        $limits = $this->db()->table('plan_limits')->get(['plan_id', 'metric', 'value'])->groupBy('plan_id');
        $monthly = $this->db()->table('usage_monthly')->where('month', $month->toDateString())->get(['tenant_id', 'metric', 'value'])->groupBy('tenant_id');
        $users = $this->db()->table('iam_users')->whereNull('deleted_at')->where('status', 'activo')->selectRaw('tenant_id, count(*) as total')->groupBy('tenant_id')->pluck('total', 'tenant_id');
        $sedes = $this->db()->table('iam_sedes')->whereNull('deleted_at')->where('status', 'activa')->selectRaw('tenant_id, count(*) as total')->groupBy('tenant_id')->pluck('total', 'tenant_id');
        $grants = $this->grants();

        $items = $this->db()->table('tenants as t')->join('plans as p', 'p.id', '=', 't.plan_id')->orderBy('t.code')
            ->get(['t.id', 't.code', 't.commercial_name', 't.status', 't.storage_used_bytes', 'p.id as plan_id', 'p.code as plan_code', 'p.name as plan_name', 'p.rank'])
            ->map(function (object $tenant) use ($limits, $monthly, $users, $sedes, $grants): array {
                $planLimits = ($limits[$tenant->plan_id] ?? collect())->pluck('value', 'metric')
                    ->map(fn ($value, string $metric) => $value === null ? null : (int) $value + (int) ($grants[$tenant->id][$metric] ?? 0));
                $values = ($monthly[$tenant->id] ?? collect())->pluck('value', 'metric');
                $current = [
                    'users' => (float) ($users[$tenant->id] ?? 0),
                    'sedes' => (float) ($sedes[$tenant->id] ?? 0),
                    'storage_gb' => round((int) $tenant->storage_used_bytes / 1024 ** 3, 1),
                ];
                $metrics = collect(self::USAGE_METRICS)->map(function (string $metric) use ($current, $values, $planLimits): array {
                    $value = $current[$metric] ?? (float) ($values[$metric] ?? 0);
                    $limit = $planLimits->has($metric) && $planLimits[$metric] !== null ? (int) $planLimits[$metric] : null;

                    return ['metric' => $metric, 'value' => $value, 'limit' => $limit, 'pct' => $limit ? round($value / $limit * 100, 1) : ($limit === 0 && $value > 0 ? 100.0 : null)];
                });
                $ranked = $metrics->filter(fn (array $metric) => $metric['pct'] !== null)->sortByDesc('pct');

                return [
                    'code' => $tenant->code,
                    'name' => $tenant->commercial_name,
                    'status' => $tenant->status,
                    'plan' => ['code' => $tenant->plan_code, 'name' => $tenant->plan_name, 'rank' => (int) $tenant->rank],
                    'metrics' => $metrics->values(),
                    'top' => $ranked->first(),
                    'alert' => $ranked->first(fn (array $metric) => in_array($metric['metric'], self::GAUGES, true) ? $metric['pct'] > 100 : $metric['pct'] >= 80),
                ];
            });

        return ['month' => $month->toDateString(), 'items' => $items->values()];
    }

    private function grants(): array
    {
        $addons = $this->db()->table('addons')->pluck('grants', 'code')->map(fn ($raw) => (array) json_decode((string) $raw, true));
        $grants = [];

        foreach ($this->db()->table('subscription_items as i')->join('subscriptions as s', 's.id', '=', 'i.subscription_id')->whereNull('i.ends_at')->where('s.status', '<>', 'canceled')->get(['s.tenant_id', 'i.addon_code', 'i.quantity']) as $item) {
            foreach ($addons[$item->addon_code] ?? [] as $metric => $amount) {
                if (is_numeric($amount)) {
                    $grants[$item->tenant_id][$metric] = ($grants[$item->tenant_id][$metric] ?? 0) + (int) $amount * (int) $item->quantity;
                }
            }
        }

        return $grants;
    }

    public function couponLabel(object $coupon): string
    {
        $value = $coupon->type === 'percent' ? rtrim(rtrim(number_format((float) $coupon->value, 2, '.', ''), '0'), '.').' %' : 'S/ '.number_format((float) $coupon->value, 2, '.', ' ');
        $cycles = (int) $coupon->duration_cycles;

        return "{$value} por {$cycles} ".($cycles === 1 ? 'mes' : 'meses');
    }

    private function invoiceQuery(): Builder
    {
        return $this->db()->table('platform_invoices as i')->join('tenants as t', 't.id', '=', 'i.tenant_id')->join('subscriptions as s', 's.id', '=', 'i.subscription_id')->join('plans as p', 'p.id', '=', 's.plan_id')
            ->select(['i.*', 't.code as tenant_code', 't.commercial_name', 't.status as tenant_status', 'p.name as plan_name', 'p.rank as plan_rank', 's.status as subscription_status']);
    }

    private function invoiceSummary(object $row, ?object $note, int $attempts): array
    {
        return [
            'id' => $row->id,
            'number' => PlatformSequence::format(trim((string) $row->series), (int) $row->number),
            'tenant' => ['code' => $row->tenant_code, 'name' => $row->commercial_name, 'status' => $row->tenant_status],
            'plan' => ['name' => $row->plan_name, 'rank' => (int) $row->plan_rank],
            'subscription_status' => $row->subscription_status,
            'kind' => $row->kind,
            'period_from' => $row->period_from,
            'period_to' => $row->period_to,
            'issue_date' => $row->issue_date,
            'due_date' => $row->due_date,
            'currency' => trim((string) $row->currency),
            'total' => (float) $row->total,
            'status' => $row->status,
            'sunat_status' => $row->sunat_status,
            'paid_at' => $row->paid_at ? Carbon::parse($row->paid_at)->toIso8601String() : null,
            'payment_ref' => $row->payment_ref,
            'attempts' => $attempts,
            'credit_note' => $note ? PlatformSequence::format(trim((string) $note->series), (int) $note->number) : null,
            'dunning_extended_days' => (int) $row->dunning_extended_days,
        ];
    }

    private function methods(): Collection
    {
        return $this->db()->table('payment_methods')->where('is_default', true)->get()->keyBy('tenant_id');
    }

    private function uuids(?string $raw): array
    {
        return $raw === null || $raw === '{}' ? [] : explode(',', trim($raw, '{}'));
    }

    private function db(): ConnectionInterface
    {
        return DB::connection(self::CONNECTION);
    }
}
