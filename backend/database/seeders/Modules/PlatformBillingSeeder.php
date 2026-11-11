<?php

declare(strict_types=1);

namespace Database\Seeders\Modules;

use App\Domain\Platform\Models\Tenant;
use App\Domain\Platform\Support\BillingMetrics;
use App\Domain\Platform\Support\PlatformSettings;
use Database\Support\KitSeeds;
use Database\Support\SeedsTenant;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class PlatformBillingSeeder
{
    use SeedsTenant;

    private const INVOICE_STATUS = ['pagada' => 'paid', 'fallida' => 'failed', 'pendiente' => 'open', 'anulada' => 'void', 'vencida' => 'uncollectible'];

    private const SUNAT_STATUS = ['aceptado' => 'accepted', 'observado' => 'observed', 'rechazado' => 'rejected'];

    private const SUBSCRIPTION_STATUS = ['TNT-0004' => 'past_due', 'TNT-0006' => 'suspended'];

    private const USAGE = ['reservations' => 'reservations_month', 'whatsapp' => 'whatsapp_month', 'email' => 'email_month', 'apiCalls' => 'api_calls_month', 'storageGB' => 'storage_gb'];

    private Collection $tenants;

    private Collection $plans;

    private ?string $operator = null;

    public function __construct(private readonly Tenant $tenant) {}

    protected function tenant(): Tenant
    {
        return $this->tenant;
    }

    public function run(): void
    {
        $this->tenants = DB::table('tenants')->get()->keyBy('code');
        $this->plans = DB::table('plans')->get()->keyBy('name');
        $this->operator = DB::table('platform_users')->where('email', 'ops@kipucontrol.com')->value('id');
        $config = KitSeeds::read('platformConfig');

        $this->settings($config);
        $this->subscriptions($config);
        $this->paymentMethods($config);
        $this->invoices();
        $this->sequences($config);
        $this->coupons();
        $this->overrides();
        $this->usage();
        $this->metrics();
    }

    private function settings(array $config): void
    {
        $values = json_encode([
            'issuer' => $config['issuer'],
            'igv_pct' => $config['igvPct'],
            'currency' => $config['currency'],
            'gateway' => $config['gateway'],
            'dunning' => ['retry_days' => $config['dunning']['retryDays'], 'suspend_after_last' => (bool) $config['dunning']['suspendAfterLast']],
        ], JSON_UNESCAPED_UNICODE);

        if (DB::table('platform_settings')->where('key', PlatformSettings::KEY)->exists()) {
            return;
        }

        DB::table('platform_settings')->insert(['key' => PlatformSettings::KEY, 'value' => $values, 'updated_by' => $this->operator, 'updated_at' => now()]);
    }

    private function subscriptions(array $config): void
    {
        $kitTenants = collect(KitSeeds::read('tenants'))->keyBy('id');
        $owned = KitSeeds::read('subscription')['tenantId'];

        foreach ($config['tenantBilling'] as $code => $billing) {
            $tenant = $this->tenants[$code] ?? null;
            $kit = $kitTenants[$code] ?? null;

            if ($tenant === null || $kit === null || $code === $owned) {
                continue;
            }

            $trial = isset($billing['trialEnd']);
            [$start, $end] = $trial ? [$this->day($billing['trialStart']), $this->day($billing['trialEnd'])] : $this->period((int) $billing['day']);
            $values = [
                'tenant_id' => $tenant->id,
                'plan_id' => $tenant->plan_id,
                'cycle' => $billing['cycle'] === 'anual' ? 'annual' : 'monthly',
                'status' => $trial ? 'trialing' : (self::SUBSCRIPTION_STATUS[$code] ?? 'active'),
                'trial_starts_at' => $trial ? $start : null,
                'trial_ends_at' => $trial ? $end : null,
                'trial_extended_days' => (int) ($billing['trialExtended'] ?? 0),
                'current_period_start' => $start,
                'current_period_end' => $end,
                'billing_anchor_day' => min(28, (int) $billing['day']),
                'auto_renew' => true,
                'credit_balance' => 0,
                'gateway' => 'local_gateway',
                'billing_ruc' => $kit['ruc'],
                'billing_name' => $kit['name'],
                'billing_address' => $billing['address'],
                'billing_email' => $kit['adminEmail'],
                'updated_at' => now(),
            ];
            $existing = DB::table('subscriptions')->where('tenant_id', $tenant->id)->where('status', '<>', 'canceled')->value('id');

            if ($existing) {
                DB::table('subscriptions')->where('id', $existing)->update($values);
            } else {
                DB::table('subscriptions')->insert(['id' => (string) Str::uuid7(), 'code' => 'SUB-'.substr($kit['createdAt'], 0, 4).'-'.substr($code, -4), 'created_at' => $this->moment($kit['createdAt'].' 09:00'), ...$values]);
            }

            if ($trial) {
                DB::table('tenants')->where('id', $tenant->id)->update(['trial_ends_at' => Carbon::parse($end, 'America/Lima')->endOfDay()->utc()]);
            }
        }
    }

    private function period(int $anchor): array
    {
        $today = Carbon::parse(self::KIT_TODAY);
        $start = $today->copy()->day(min($anchor, $today->daysInMonth));

        if ($start->greaterThan($today)) {
            $start = $today->copy()->subMonthNoOverflow()->day($anchor);
        }

        return [$this->day($start->toDateString()), $this->day($start->copy()->addMonthNoOverflow()->subDay()->toDateString())];
    }

    private function paymentMethods(array $config): void
    {
        $card = KitSeeds::read('subscription')['paymentMethod'];

        foreach ($config['tenantBilling'] as $code => $billing) {
            $tenant = $this->tenants[$code] ?? null;

            if ($tenant === null || empty($billing['pm']) || ! preg_match('/^(\w+) •+ (\d{4})/u', $billing['pm'], $match)) {
                continue;
            }

            $primary = $code === $this->tenant->code;
            [$month, $year] = $primary ? array_map('intval', explode('/', $card['exp'])) : [null, null];
            $values = [
                'gateway_token' => $primary ? $card['token'] : 'pm_'.substr(hash('sha256', $code.$match[2]), 0, 20),
                'brand' => $match[1],
                'last4' => $match[2],
                'exp_month' => $month,
                'exp_year' => $year,
                'holder' => $primary ? $card['holder'] : null,
                'status' => str_contains($billing['pm'], 'vencida') ? 'expired' : 'active',
                'created_at' => $primary ? $this->moment($card['updatedAt'].' 10:00') : $tenant->created_at,
            ];
            $existing = DB::table('payment_methods')->where('tenant_id', $tenant->id)->where('is_default', true)->value('id');

            if ($existing) {
                DB::table('payment_methods')->where('id', $existing)->update($values);
            } else {
                DB::table('payment_methods')->insert(['id' => (string) Str::uuid7(), 'tenant_id' => $tenant->id, 'is_default' => true, ...$values]);
            }
        }
    }

    private function invoices(): void
    {
        $subscriptions = DB::table('subscriptions')->where('status', '<>', 'canceled')->pluck('id', 'tenant_id');

        foreach (KitSeeds::read('platformInvoices') as $row) {
            $tenant = $this->tenants[$row['tenantId']] ?? null;
            $subscription = $tenant ? ($subscriptions[$tenant->id] ?? null) : null;

            if ($subscription === null) {
                continue;
            }

            [$series, $number] = explode('-', $row['id']);
            $dunning = $row['dunning'] ?? null;
            $values = [
                'tenant_id' => $tenant->id,
                'subscription_id' => $subscription,
                'kind' => $row['kind'] === 'suscripcion' ? 'subscription' : 'addon',
                'period_from' => $this->day($row['periodFrom']),
                'period_to' => $this->day($row['periodTo']),
                'issue_date' => $this->day($row['issueDate']),
                'due_date' => $this->day($row['dueDate']),
                'currency' => $row['currency'],
                'subtotal' => $row['subtotal'],
                'igv' => $row['igv'],
                'total' => $row['total'],
                'status' => self::INVOICE_STATUS[$row['status']] ?? 'open',
                'paid_at' => $this->moment($row['paidAt']),
                'payment_ref' => $row['method'] ?? null,
                'bill_to' => json_encode($row['billTo'], JSON_UNESCAPED_UNICODE),
                'sunat_status' => self::SUNAT_STATUS[$row['sunat'] ?? ''] ?? 'pending',
                'sunat_hash' => $row['hash'] ?? null,
                'dunning_failed_at' => $dunning ? $this->day($dunning['failedAt']) : null,
                'dunning_retries_done' => (int) ($dunning['retriesDone'] ?? 0),
                'dunning_next_retry_at' => $dunning && $row['status'] === 'fallida' ? $this->moment($dunning['nextRetryAt'] ?? null) : null,
                'dunning_extended_days' => (int) ($dunning['extendedDays'] ?? 0),
                'updated_at' => now(),
            ];
            $id = DB::table('platform_invoices')->where('series', $series)->where('number', (int) $number)->value('id');

            if ($id) {
                DB::table('platform_invoices')->where('id', $id)->update($values);
            } else {
                $id = (string) Str::uuid7();
                DB::table('platform_invoices')->insert(['id' => $id, 'series' => $series, 'number' => (int) $number, 'created_at' => $this->moment($row['issueDate'].' 06:00'), ...$values]);
                $this->lines($id, $row);
            }

            $this->attempts((string) $id, $row);

            if ($row['status'] === 'fallida' && $dunning !== null) {
                $this->catchUp((string) $id, $row);
            }
        }
    }

    private function catchUp(string $invoiceId, array $row): void
    {
        $policy = KitSeeds::read('platformConfig')['dunning']['retryDays'];
        $invoice = DB::table('platform_invoices')->where('id', $invoiceId)->first();
        $done = (int) $invoice->dunning_retries_done;
        $next = $invoice->dunning_next_retry_at ? Carbon::parse($invoice->dunning_next_retry_at) : null;
        $failed = Carbon::parse($invoice->dunning_failed_at, 'America/Lima');
        $last = collect($row['attempts'])->last();

        while ($next !== null && $next->lessThanOrEqualTo(now()) && $done < count($policy)) {
            $done++;
            $key = "inv:{$row['id']}:attempt:".(count($row['attempts']) + $done - (int) $row['dunning']['retriesDone']);
            DB::table('payment_attempts')->updateOrInsert(['idempotency_key' => $key], [
                'id' => DB::table('payment_attempts')->where('idempotency_key', $key)->value('id') ?? (string) Str::uuid7(),
                'invoice_id' => $invoiceId,
                'attempt_no' => count($row['attempts']) + $done - (int) $row['dunning']['retriesDone'],
                'source' => 'dunning',
                'result' => 'declined',
                'gateway_code' => $last['code'] ?? 'card_declined',
                'message' => preg_replace('/ · reintento.*$/u', '', (string) ($last['msg'] ?? 'Cobro rechazado'))." · reintento {$done} de ".count($policy),
                'created_at' => $next->copy()->toIso8601String(),
            ]);
            $next = $done < count($policy) ? $failed->copy()->addDays($policy[$done])->setTime(10, 0)->utc() : null;
        }

        DB::table('platform_invoices')->where('id', $invoiceId)->update([
            'dunning_retries_done' => $done,
            'dunning_next_retry_at' => $next?->toIso8601String(),
            'status' => $next === null && $done >= count($policy) ? 'uncollectible' : 'failed',
        ]);
    }

    private function lines(string $invoiceId, array $row): void
    {
        $label = fn (): string => Carbon::parse($this->day($row['periodFrom']))->locale('es')->translatedFormat('d M Y').' al '.Carbon::parse($this->day($row['periodTo']))->locale('es')->translatedFormat('d M Y');

        foreach ($row['lines'] as $line) {
            DB::table('platform_invoice_lines')->insert([
                'invoice_id' => $invoiceId,
                'description' => mb_substr((string) preg_replace_callback('/\d{2} \w{3} \d{4} al \d{2} \w{3} \d{4}/u', $label, $line['desc']), 0, 250),
                'quantity' => $line['qty'],
                'unit_price' => $line['unit'],
                'amount' => $line['amount'],
                'line_type' => str_starts_with($line['desc'], 'Add-on') ? 'addon' : 'plan',
            ]);
        }
    }

    private function attempts(string $invoiceId, array $row): void
    {
        foreach ($row['attempts'] ?? [] as $index => $attempt) {
            $key = "inv:{$row['id']}:attempt:".($index + 1);
            $values = [
                'invoice_id' => $invoiceId,
                'attempt_no' => $index + 1,
                'source' => $index === 0 ? 'initial' : 'dunning',
                'result' => $attempt['result'] === 'exitoso' ? 'succeeded' : 'declined',
                'gateway_code' => $attempt['code'] ?? null,
                'message' => $attempt['msg'] ?? null,
                'created_at' => $this->moment($attempt['ts']),
            ];

            if (DB::table('payment_attempts')->where('idempotency_key', $key)->exists()) {
                DB::table('payment_attempts')->where('idempotency_key', $key)->update($values);

                continue;
            }

            DB::table('payment_attempts')->insert(['id' => (string) Str::uuid7(), 'idempotency_key' => $key, ...$values]);
        }
    }

    private function sequences(array $config): void
    {
        $invoices = max((int) $config['nextInvoice'], (int) DB::table('platform_invoices')->where('series', 'FQ01')->max('number') + 1);
        $notes = (int) DB::table('platform_credit_notes')->where('series', 'NQ01')->max('number') + 1;

        foreach ([['platform_invoice', 'FQ01', $invoices], ['platform_credit_note', 'NQ01', $notes]] as [$type, $series, $next]) {
            $current = DB::table('platform_sequences')->where('doc_type', $type)->where('series', $series)->value('next_number');

            if ($current === null) {
                DB::table('platform_sequences')->insert(['id' => (string) Str::uuid7(), 'doc_type' => $type, 'series' => $series, 'prefix' => $series.'-', 'pad_width' => 8, 'next_number' => $next]);
            } elseif ((int) $current < $next) {
                DB::table('platform_sequences')->where('doc_type', $type)->where('series', $series)->update(['next_number' => $next]);
            }
        }
    }

    private function coupons(): void
    {
        foreach (KitSeeds::read('coupons') as $row) {
            DB::table('coupons')->updateOrInsert(['code' => $row['code']], [
                'type' => $row['type'],
                'value' => $row['value'],
                'duration_cycles' => $row['months'],
                'plan_ids' => '{'.collect($row['plans'])->map(fn (string $name) => $this->plans[$name]->id ?? null)->filter()->implode(',').'}',
                'max_redemptions' => $row['maxRedemptions'],
                'redeemed_count' => $row['redeemed'],
                'valid_to' => $this->day($row['validTo']),
                'status' => $row['status'] === 'activo' ? 'active' : 'inactive',
                'note' => $row['note'],
                'created_by' => $this->operator,
                'created_at' => $this->moment($row['createdAt'].' 09:00'),
            ]);
        }
    }

    private function overrides(): void
    {
        foreach (KitSeeds::read('featureFlags') as $flag) {
            foreach ($flag['overrides'] as $override) {
                $tenant = $this->tenants[$override['tenantId']] ?? null;

                if ($tenant === null || $this->operator === null) {
                    continue;
                }

                DB::table('feature_overrides')->updateOrInsert(['tenant_id' => $tenant->id, 'feature_key' => 'module.'.$flag['key']], [
                    'value' => (bool) $override['value'],
                    'reason' => $override['reason'],
                    'valid_until' => $this->day($override['until']),
                    'granted_by' => $this->operator,
                    'created_by' => $this->operator,
                    'created_at' => $this->moment($override['at']),
                ]);
            }
        }
    }

    private function usage(): void
    {
        $month = Carbon::today('America/Lima')->startOfMonth()->toDateString();

        foreach (KitSeeds::read('platformMetrics')['usageByTenant'] as $code => $row) {
            $tenant = $this->tenants[$code] ?? null;

            if ($tenant === null) {
                continue;
            }

            foreach (self::USAGE as $key => $metric) {
                DB::table('usage_monthly')->updateOrInsert(['tenant_id' => $tenant->id, 'metric' => $metric, 'month' => $month], ['value' => (int) round($row[$key])]);
            }

            DB::table('tenants')->where('id', $tenant->id)->update(['storage_used_bytes' => (int) round($row['storageGB'] * 1024 ** 3)]);
        }
    }

    private function metrics(): void
    {
        $seed = KitSeeds::read('platformMetrics');
        $months = count($seed['mrr']);
        $current = Carbon::today('America/Lima')->startOfMonth();
        $snapshot = app(BillingMetrics::class)->snapshot('pgsql_owner');
        $active = $snapshot['active_tenants'];
        $cancellations = collect($seed['cancellations'])->groupBy(fn (array $row) => substr($row['date'], 0, 7));
        $kitMonth = Carbon::parse(self::KIT_TODAY)->startOfMonth();

        for ($index = $months - 2; $index >= 0; $index--) {
            $next = $index + 1;
            $active += (int) $seed['churned'][$next] + (int) $seed['suspended'][$next] - ($next === $months - 1 ? $snapshot['new_paying'] : (int) $seed['newTenants'][$next]);
            $offset = $months - 1 - $index;
            $day = $current->copy()->subMonthsNoOverflow($offset)->endOfMonth()->toDateString();
            $mrr = (float) $seed['mrr'][$index];
            $lost = $cancellations[$kitMonth->copy()->subMonthsNoOverflow($offset)->format('Y-m')] ?? collect();

            DB::table('platform_metrics_daily')->updateOrInsert(['day' => $day], [
                'mrr' => $mrr,
                'arr' => $mrr * 12,
                'arpa' => $active > 0 ? round($mrr / $active, 2) : 0,
                'active_tenants' => $active,
                'new_tenants' => (int) $seed['newTenants'][$index],
                'churned_tenants' => (int) $seed['churned'][$index],
                'breakdown' => json_encode([
                    'suspended' => (int) $seed['suspended'][$index],
                    'cancellations' => $lost->map(fn (array $row) => [...$row, 'date' => $day])->values()->all(),
                ], JSON_UNESCAPED_UNICODE),
            ]);
        }

        app(BillingMetrics::class)->storeSnapshot($snapshot, 'pgsql_owner');
    }
}
