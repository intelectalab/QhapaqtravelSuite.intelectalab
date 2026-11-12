<?php

declare(strict_types=1);

namespace App\Domain\Admin\Support;

use App\Domain\Iam\Models\User;
use App\Domain\Iam\Support\StaffSeats;
use App\Domain\Platform\Support\EffectiveLimits;
use App\Domain\Platform\Support\Entitlements;
use App\Domain\Platform\Support\PlatformInvoicer;
use App\Domain\Platform\Support\PlatformSettings;
use App\Domain\Shared\Money\Decimal;
use App\Domain\Shared\Tenancy\TenantContext;
use Brick\Math\RoundingMode;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

final class SubscriptionDirectory
{
    private const METRICS = [
        'users' => ['label' => 'Usuarios', 'unit' => 'usuarios'],
        'sedes' => ['label' => 'Sedes activas', 'unit' => 'sedes'],
        'reservations_month' => ['label' => 'Reservas del mes', 'unit' => 'reservas'],
        'storage_gb' => ['label' => 'Almacenamiento', 'unit' => 'GB'],
        'whatsapp_month' => ['label' => 'Mensajes de WhatsApp', 'unit' => 'mensajes'],
        'email_month' => ['label' => 'Correos enviados', 'unit' => 'correos'],
        'api_calls_month' => ['label' => 'Llamadas a la API', 'unit' => 'llamadas'],
        'api_keys' => ['label' => 'Claves de API activas', 'unit' => 'claves'],
        'webhooks' => ['label' => 'Webhooks', 'unit' => 'webhooks'],
    ];

    private const STATUS = ['trialing' => 'En prueba', 'active' => 'Activa', 'past_due' => 'Pago pendiente', 'cancel_scheduled' => 'Cancelación programada', 'suspended' => 'Suspendida', 'canceled' => 'Cancelada'];

    public function __construct(
        private readonly TenantContext $context,
        private readonly AuditDirectory $audit,
        private readonly Entitlements $entitlements,
        private readonly PlatformInvoicer $invoicer,
        private readonly PlatformSettings $settings,
    ) {}

    public function overview(User $viewer): array
    {
        $tenant = $this->context->tenant();
        $platform = $this->platform();
        $subscription = $platform->table('subscriptions')->where('tenant_id', $tenant->getKey())->where('status', '<>', 'canceled')->first();
        $planId = $subscription->plan_id ?? $tenant->plan_id;
        $plan = $platform->table('plans')->where('id', $planId)->first(['code', 'name', 'rank', 'price_month', 'price_year', 'currency', 'support_level', 'module_count']);
        $limits = $platform->table('plan_limits')->where('plan_id', $planId)->get(['metric', 'value', 'hard'])->keyBy('metric');
        $today = Carbon::today('America/Lima')->toDateString();
        $items = $platform->table('subscription_items')->where('subscription_id', $subscription->id ?? null)->where(fn ($query) => $query->whereNull('ends_at')->orWhere('ends_at', '>=', $today))->get(['addon_code', 'quantity', 'unit_price', 'starts_at', 'ends_at', 'meta']);
        $catalog = $platform->table('addons')->orderBy('price_month')->get();
        $labels = $catalog->pluck('label', 'code');
        $prices = $platform->table('addon_prices')->where('plan_id', $planId)->pluck('price', 'addon_code');
        $scheduled = $subscription ? $platform->table('subscription_changes as c')->leftJoin('plans as p', 'p.id', '=', 'c.to_plan_id')->where('c.subscription_id', $subscription->id)->where('c.status', 'scheduled')->first(['c.kind', 'c.to_cycle', 'c.effective_at', 'p.name as plan']) : null;
        $coupon = $subscription && $subscription->coupon_redemption_id ? $platform->table('coupon_redemptions as r')->join('coupons as c', 'c.id', '=', 'r.coupon_id')->where('r.id', $subscription->coupon_redemption_id)->where('r.remaining_cycles', '>', 0)->first(['c.code', 'c.type', 'c.value', 'r.remaining_cycles']) : null;
        $month = Carbon::today()->startOfMonth();
        $metered = $platform->table('usage_monthly')->where('tenant_id', $tenant->getKey())->where('month', '>=', $month->copy()->subMonths(5)->toDateString())->get(['metric', 'month', 'value']);
        $current = $metered->filter(fn (object $row): bool => Carbon::parse($row->month)->isSameMonth($month))->pluck('value', 'metric');
        $extras = EffectiveLimits::extras((string) $tenant->getKey());
        $used = [
            'users' => StaffSeats::count(DB::table('iam_users')),
            'sedes' => DB::table('iam_sedes')->whereNull('deleted_at')->where('status', 'activa')->count(),
            'reservations_month' => DB::table('booking_reservations')->whereNull('deleted_at')->where('created_at', '>=', $month)->count(),
            'storage_gb' => round(((int) $tenant->storage_used_bytes) / 1024 ** 3, 1),
            'whatsapp_month' => (int) ($current['whatsapp_month'] ?? 0),
            'email_month' => (int) ($current['email_month'] ?? 0),
            'api_calls_month' => (int) ($current['api_calls_month'] ?? 0),
            'api_keys' => DB::table('integration_api_keys')->where('status', 'active')->count(),
            'webhooks' => DB::table('integration_webhooks')->whereIn('status', ['active', 'paused'])->count(),
        ];
        $invoices = $platform->table('platform_invoices')->where('tenant_id', $tenant->getKey())->orderByDesc('issue_date')->limit(24)->get(['id', 'series', 'number', 'kind', 'period_from', 'period_to', 'issue_date', 'due_date', 'currency', 'subtotal', 'igv', 'total', 'status', 'paid_at', 'payment_ref', 'sunat_status']);
        $lines = $platform->table('platform_invoice_lines')->whereIn('invoice_id', $invoices->pluck('id'))->get(['invoice_id', 'description', 'quantity', 'unit_price', 'amount'])->groupBy('invoice_id');

        return [
            'plan' => $plan ? [
                'code' => $plan->code,
                'name' => $plan->name,
                'price_month' => (float) $plan->price_month,
                'price_year' => (float) $plan->price_year,
                'currency' => $plan->currency,
                'support' => $plan->support_level,
                'modules' => (int) $plan->module_count,
            ] : null,
            'subscription' => $subscription ? [
                'code' => $subscription->code,
                'status' => $subscription->status,
                'status_label' => self::STATUS[$subscription->status] ?? $subscription->status,
                'cycle' => $subscription->cycle,
                'period_start' => $subscription->current_period_start,
                'period_end' => $subscription->current_period_end,
                'auto_renew' => (bool) $subscription->auto_renew,
                'cancel_at' => $subscription->cancel_at,
                'credit_balance' => (float) $subscription->credit_balance,
                'lock_version' => (int) $subscription->lock_version,
                'trial_ends_at' => $subscription->trial_ends_at,
                'scheduled' => $scheduled ? ['kind' => $scheduled->kind, 'plan' => $scheduled->plan, 'cycle' => $scheduled->to_cycle, 'effective_at' => $scheduled->effective_at] : null,
                'coupon' => $coupon ? ['code' => $coupon->code, 'label' => $coupon->type === 'percent' ? rtrim(rtrim((string) $coupon->value, '0'), '.').' %' : 'S/ '.$coupon->value, 'remaining_cycles' => (int) $coupon->remaining_cycles] : null,
                'customer_since' => $subscription->created_at,
                'billing' => [
                    'ruc' => $subscription->billing_ruc,
                    'name' => $subscription->billing_name,
                    'address' => $subscription->billing_address,
                    'ubigeo' => $subscription->billing_ubigeo,
                    'email' => $subscription->billing_email,
                    'contact' => $subscription->billing_contact,
                    'doc_type' => $subscription->billing_doc_type,
                ],
            ] : null,
            'addons' => $items->map(fn (object $item): array => [
                'code' => $item->addon_code,
                'label' => $labels[$item->addon_code] ?? $item->addon_code,
                'quantity' => (int) $item->quantity,
                'unit_price' => (float) $item->unit_price,
                'since' => $item->starts_at,
                'ends_at' => $item->ends_at,
                'detail' => self::domain($item->meta),
            ])->values(),
            'addon_catalog' => $catalog->map(fn (object $addon): array => [
                'code' => $addon->code,
                'label' => $addon->label,
                'unit' => $addon->unit,
                'quantity_allowed' => (bool) $addon->quantity_allowed,
                'price' => (float) ($prices[$addon->code] ?? $addon->price_month ?? 0),
                'included' => in_array((string) $planId, self::uuids($addon->included_plans), true),
                'available' => in_array((string) $planId, self::uuids($addon->available_plans), true),
            ])->values(),
            'usage' => collect(self::METRICS)->map(function (array $meta, string $metric) use ($limits, $used, $extras): array {
                $limit = isset($limits[$metric]) && $limits[$metric]->value !== null ? (int) $limits[$metric]->value + (int) ($extras[$metric] ?? 0) : null;

                return [
                    'metric' => $metric,
                    'label' => $meta['label'],
                    'unit' => $meta['unit'],
                    'used' => $used[$metric],
                    'limit' => $limit,
                    'hard' => (bool) ($limits[$metric]->hard ?? true),
                ];
            })->values(),
            'history' => $metered->groupBy('metric')->map(fn ($rows) => $rows->sortBy('month')->map(fn (object $row): array => ['month' => $row->month, 'value' => (int) $row->value])->values())->all(),
            'invoices' => $invoices->map(fn (object $row): array => [
                'number' => $row->series.'-'.str_pad((string) $row->number, 8, '0', STR_PAD_LEFT),
                'kind' => $row->kind,
                'period_from' => $row->period_from,
                'period_to' => $row->period_to,
                'issue_date' => $row->issue_date,
                'due_date' => $row->due_date,
                'currency' => $row->currency,
                'subtotal' => (float) $row->subtotal,
                'igv' => (float) $row->igv,
                'total' => (float) $row->total,
                'status' => $row->status,
                'paid_at' => $row->paid_at,
                'method' => $row->payment_ref,
                'sunat' => $row->sunat_status,
                'lines' => collect($lines[$row->id] ?? [])->map(fn ($line): array => ['description' => $line->description, 'quantity' => (float) $line->quantity, 'amount' => (float) $line->amount])->values(),
            ])->values(),
            'payment_method' => $this->paymentMethod((string) $tenant->getKey()),
            'next_charge' => $subscription ? $this->nextCharge($subscription, $plan, $items, $coupon) : null,
            'modules' => collect($this->entitlements->for((string) $tenant->getKey()))->filter(fn (array $feature, string $key): bool => str_starts_with($key, 'module.'))->map(fn (array $feature, string $key): array => ['key' => $key, 'label' => $feature['label'], 'enabled' => $feature['enabled'], 'source' => $feature['source'], 'valid_until' => $feature['valid_until']])->sortBy('label')->values()->all(),
            'changes' => $this->audit->recent(['Suscripción'], 6),
            'can_manage' => $viewer->can('admin.billing.manage'),
        ];
    }

    public function updateBilling(array $data): array
    {
        $platform = $this->platform();
        $tenantId = $this->context->idOrFail();
        $subscription = $platform->table('subscriptions')->where('tenant_id', $tenantId)->where('status', '<>', 'canceled')->first(['id', 'billing_ruc', 'billing_name', 'billing_address', 'billing_ubigeo', 'billing_email', 'billing_contact', 'billing_doc_type']);

        if ($subscription === null) {
            return [];
        }

        $after = ['billing_ruc' => $data['ruc'], 'billing_name' => $data['name'], 'billing_address' => $data['address'], 'billing_ubigeo' => $data['ubigeo'] ?? null, 'billing_email' => $data['email'], 'billing_contact' => $data['contact'] ?? null, 'billing_doc_type' => $data['doc_type'] ?? 'Factura'];
        $changed = TenantSettings::changes((array) $subscription, $after);

        if ($changed !== []) {
            $platform->table('subscriptions')->where('id', $subscription->id)->update([...$after, 'updated_at' => now(), 'lock_version' => DB::raw('lock_version + 1')]);
        }

        return $changed;
    }

    public function invoice(object $row): array
    {
        $platform = $this->platform();
        $lines = $platform->table('platform_invoice_lines')->where('invoice_id', $row->id)->get(['description', 'quantity', 'unit_price', 'amount', 'line_type']);
        $attempts = $platform->table('payment_attempts')->where('invoice_id', $row->id)->orderBy('attempt_no')->get(['attempt_no', 'source', 'result', 'message', 'created_at']);

        return [
            'number' => $row->series.'-'.str_pad((string) $row->number, 8, '0', STR_PAD_LEFT),
            'kind' => $row->kind,
            'period_from' => $row->period_from,
            'period_to' => $row->period_to,
            'issue_date' => $row->issue_date,
            'due_date' => $row->due_date,
            'currency' => $row->currency,
            'subtotal' => (float) $row->subtotal,
            'igv' => (float) $row->igv,
            'total' => (float) $row->total,
            'status' => $row->status,
            'paid_at' => $row->paid_at,
            'method' => $row->payment_ref,
            'sunat' => $row->sunat_status,
            'bill_to' => $row->bill_to ? json_decode((string) $row->bill_to, true) : null,
            'next_retry_at' => $row->dunning_next_retry_at,
            'lines' => $lines->map(fn (object $line): array => ['description' => $line->description, 'quantity' => (float) $line->quantity, 'unit_price' => (float) $line->unit_price, 'amount' => (float) $line->amount, 'type' => $line->line_type])->values()->all(),
            'attempts' => $attempts->map(fn (object $attempt): array => ['number' => (int) $attempt->attempt_no, 'source' => $attempt->source, 'result' => $attempt->result, 'message' => $attempt->message, 'at' => $attempt->created_at])->values()->all(),
        ];
    }

    private function paymentMethod(string $tenantId): ?array
    {
        $method = $this->platform()->table('payment_methods as m')->leftJoin('iam_users as u', 'u.id', '=', 'm.created_by')->where('m.tenant_id', $tenantId)->where('m.is_default', true)->where('m.status', '<>', 'removed')
            ->first(['m.brand', 'm.last4', 'm.exp_month', 'm.exp_year', 'm.holder', 'm.status', 'm.gateway_token', 'm.created_at', 'u.name as updated_by']);

        return $method ? [
            'brand' => $method->brand,
            'last4' => $method->last4,
            'exp' => str_pad((string) $method->exp_month, 2, '0', STR_PAD_LEFT).'/'.$method->exp_year,
            'holder' => $method->holder,
            'status' => $method->status,
            'token_hint' => mb_substr((string) $method->gateway_token, 0, 12),
            'updated_at' => $method->created_at,
            'updated_by' => $method->updated_by,
        ] : null;
    }

    private function nextCharge(object $subscription, ?object $plan, $items, ?object $coupon): ?array
    {
        if ($plan === null || $subscription->status === 'cancel_scheduled') {
            return null;
        }

        $platform = $this->platform();
        $renewal = Carbon::parse($subscription->current_period_end)->addDay()->toDateString();
        $change = $platform->table('subscription_changes')->where('subscription_id', $subscription->id)->where('status', 'scheduled')->whereIn('kind', ['upgrade', 'downgrade', 'cycle'])->first(['to_plan_id', 'to_cycle']);
        $cycle = (string) ($change->to_cycle ?? $subscription->cycle);
        $target = $platform->table('plans')->where('id', $change->to_plan_id ?? $subscription->plan_id)->first();
        $base = $this->invoicer->price($target, $cycle);
        $months = $cycle === 'annual' ? 12 : 1;
        $addons = Decimal::money(0);

        foreach ($items as $item) {
            if ($item->ends_at === null || $item->ends_at >= $renewal) {
                $addons = $addons->plus(Decimal::money($item->unit_price)->multipliedBy((int) $item->quantity * $months));
            }
        }

        $discount = $coupon ? $this->invoicer->discount((object) ['type' => $coupon->type, 'value' => $coupon->value], $base) : Decimal::money(0);
        $gross = $base->plus($addons)->minus($discount);
        $credit = Decimal::money($subscription->credit_balance);
        $credit = $credit->isGreaterThan($gross) ? $gross : $credit;
        $net = $gross->minus($credit);
        $igv = $net->multipliedBy(Decimal::of($this->settings->igv()))->dividedBy(100, 2, RoundingMode::HALF_UP);

        return ['date' => $renewal, 'plan' => $target->name, 'cycle' => $cycle, 'base' => (float) (string) $base, 'addons' => (float) (string) $addons, 'discount' => (float) (string) $discount, 'credit' => (float) (string) $credit, 'net' => (float) (string) $net, 'igv' => (float) (string) $igv, 'total' => (float) (string) $net->plus($igv)];
    }

    private static function uuids(?string $value): array
    {
        return $value ? array_values(array_filter(explode(',', trim($value, '{}')))) : [];
    }

    private static function domain(?string $meta): ?string
    {
        $values = $meta ? json_decode($meta, true) : null;

        return is_array($values) && isset($values['domain']) ? (string) $values['domain'] : null;
    }

    private function platform(): ConnectionInterface
    {
        return DB::connection('pgsql_platform');
    }
}
