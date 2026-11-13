<?php

declare(strict_types=1);

namespace Database\Seeders\Modules;

use App\Domain\Admin\Support\PgArray;
use App\Domain\Platform\Models\Tenant;
use App\Domain\Quotes\Support\QuoteApprovalPolicy;
use Database\Support\KitSeeds;
use Database\Support\SeedsTenant;
use Illuminate\Support\Facades\DB;

final class AdminSettingsSeeder
{
    use SeedsTenant;

    private const SERIES = [
        'Cotización' => ['quote', 'quote_quotes', 5],
        'Reserva' => ['reservation', 'booking_reservations', 6],
        'Orden operativa' => ['ops_order', 'ops_orders', 5],
        'Voucher' => ['voucher', 'ops_vouchers', 5],
        'Factura' => ['invoice', null, 8],
        'Boleta' => ['receipt', null, 8],
    ];

    private const ROUND_MODES = ['Al más cercano' => 'nearest', 'Hacia arriba' => 'up', 'Hacia abajo' => 'down'];

    public function __construct(private readonly Tenant $tenant) {}

    protected function tenant(): Tenant
    {
        return $this->tenant;
    }

    public function run(): void
    {
        $seed = KitSeeds::read('settings');
        $owner = $this->userId('U01');
        $general = $seed['general'];
        $policies = $seed['policies'];
        $ops = $seed['ops'];

        $this->section('general', [
            'email' => $general['email'],
            'phone' => $general['phone'],
            'web' => $general['web'],
            'address' => $general['address'],
            'legal_rep' => $general['legalRep'],
            'mincetur_registry' => $general['mincetur'],
            'lang' => $general['lang'],
            'date_format' => $general['dateFmt'],
            'main_sede_id' => $this->idByCode('iam_sedes', $general['mainSede']),
        ], $owner);

        $this->section('currency', [
            'base_currency' => $seed['currency'],
            'alt_currency' => $seed['altCurrency'],
            'price_with_tax' => (bool) $seed['priceWithTax'],
            'fx_source' => $seed['fxSource'],
            'tax_pct' => $seed['taxPct'],
            'rounding' => $seed['rounding'],
            'round_mode' => self::ROUND_MODES[$seed['roundMode']] ?? 'nearest',
            'invoice_void_days' => 7,
        ], $owner);

        $this->section('policies', [
            'quote_validity_days' => $seed['quoteValidityDays'],
            'hold_minutes' => $seed['holdMinutes'],
            'markup_pct' => $policies['markupPct'],
            'max_discount_pct' => $policies['maxDiscountPct'],
            'approval_margin_pct' => (int) QuoteApprovalPolicy::DEFAULTS['margin_floor'],
            'discount_cap_pct' => (int) QuoteApprovalPolicy::DEFAULTS['max_discount'],
            'advance_pct' => $policies['advancePct'],
            'balance_days_before' => $policies['balanceDaysBefore'],
            'cancel_text' => $policies['cancel'],
            'modify_text' => $policies['modify'],
            'noshow_text' => $policies['noshow'],
            'refund_text' => $policies['refund'],
        ], $owner);

        $this->section('operations', [
            'voucher_hours_before' => $ops['voucherHoursBefore'],
            'assign_expiry_min' => $ops['assignExpiryMin'],
            'checkin_tolerance_min' => $ops['checkinToleranceMin'],
            'modify_min_hours' => $ops['modifyMinHours'],
            'max_pax_per_guide' => $ops['maxPaxPerGuide'],
            'offline_sync_min' => $ops['offlineSyncMin'],
            'pay_reminder_days' => $ops['payReminderDays'],
            'trip_notice_hours' => $ops['tripNoticeHours'],
            'incident_escalate_min' => $ops['incidentEscalateMin'],
        ], $owner);

        $this->section('channels', collect($seed['channels'])->mapWithKeys(fn (bool $on, string $key): array => [strtolower((string) preg_replace('/([a-z])([A-Z])/', '$1_$2', $key)) => $on])->all(), $owner);

        if ($general['legalRep'] ?? null) {
            DB::table('tenants')->where('id', $this->tenant->getKey())->whereNull('legal_rep')->update(['legal_rep' => $general['legalRep']]);
        }

        $this->sequences($seed['series']);
        $this->rules($seed['bookingRules'], $owner);
    }

    private function section(string $section, array $values, ?string $by): void
    {
        DB::table('sys_settings')->updateOrInsert(
            ['tenant_id' => $this->tenant->getKey(), 'section' => $section],
            ['values' => json_encode($values, JSON_UNESCAPED_UNICODE), 'updated_by' => $by, 'updated_at' => now()],
        );
    }

    private function sequences(array $series): void
    {
        foreach ($series as $row) {
            [$type, $table, $pad] = self::SERIES[$row['doc']] ?? [null, null, 5];

            if ($type === null) {
                continue;
            }

            $next = (int) $row['next'];

            if ($table !== null) {
                $codes = DB::table($table)->where('tenant_id', $this->tenant->getKey())->where('code', 'like', $row['prefix'].'%')->pluck('code');
                $max = $codes->map(fn (string $code): int => preg_match('/(\d+)$/', $code, $m) === 1 ? (int) $m[1] : 0)->max() ?? 0;
                $next = max($next, $max + 1);
            }

            $existing = DB::table('sys_sequences')->where('tenant_id', $this->tenant->getKey())->where('doc_type', $type)->where('series', 'default')->first(['id', 'next_number']);
            $values = ['label' => $row['doc'], 'prefix' => $row['prefix'], 'pad_width' => $pad, 'year_reset' => str_contains($row['prefix'], '2026'), 'updated_at' => now()];

            if ($existing) {
                DB::table('sys_sequences')->where('id', $existing->id)->update([...$values, 'next_number' => max((int) $existing->next_number, $next)]);

                continue;
            }

            DB::table('sys_sequences')->insert(['tenant_id' => $this->tenant->getKey(), 'doc_type' => $type, 'series' => 'default', 'next_number' => $next, ...$values]);
        }
    }

    private function rules(array $rules, ?string $by): void
    {
        $catalog = DB::table('sys_booking_rule_catalog')->get()->keyBy('code');

        foreach (array_values($rules) as $index => $rule) {
            $base = $catalog[$rule['id']] ?? null;
            $this->upsert('sys_booking_rules', ['code' => $rule['id']], [
                'rule_group' => $rule['group'],
                'name' => $rule['name'],
                'description' => $rule['desc'],
                'enabled' => (bool) $rule['enabled'],
                'params' => json_encode((object) $rule['params'], JSON_UNESCAPED_UNICODE),
                'params_schema' => $base->params_schema ?? '{}',
                'scope' => PgArray::from($rule['scope'] ?? []),
                'product_override' => (bool) ($rule['productOverride'] ?? false),
                'is_custom' => false,
                'min_plan' => $rule['minPlan'] ?? ($base->min_plan ?? 'Starter'),
                'sort_order' => $index + 1,
                'created_by' => $by,
                'updated_by' => $by,
            ]);
        }
    }
}
