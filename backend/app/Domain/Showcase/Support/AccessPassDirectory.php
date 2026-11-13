<?php

declare(strict_types=1);

namespace App\Domain\Showcase\Support;

use App\Domain\Shared\Money\Decimal;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

final class AccessPassDirectory
{
    public function overview(): array
    {
        $today = Carbon::today('America/Lima');
        $features = $this->db()->table('features')->orderBy('key')->get(['key', 'label', 'module']);
        $labels = $features->pluck('label', 'key');
        $rows = $this->db()->table('platform_access_passes as p')->join('tenants as t', 't.id', '=', 'p.tenant_id')
            ->leftJoin('plans as pl', 'pl.id', '=', 'p.convert_to_plan_id')
            ->leftJoin('platform_invoices as i', 'i.id', '=', 'p.invoice_id')
            ->leftJoin('platform_users as u', 'u.id', '=', 'p.created_by')
            ->orderByRaw("case p.status when 'activo' then 0 else 1 end")->orderByDesc('p.created_at')
            ->get(['p.*', DB::raw('array_to_json(p.features) as features_json'), 't.code as tenant_code', 't.commercial_name as tenant_name', 't.status as tenant_status', 'pl.code as plan_code', 'pl.name as plan_name', 'i.series as invoice_series', 'i.number as invoice_number', 'u.name as author']);

        $items = $rows->map(function (object $row) use ($today, $labels): array {
            $keys = PgArray::parse($row->features_json);
            $ends = Carbon::parse($row->ends_on, 'America/Lima');

            return [
                'code' => $row->code,
                'name' => $row->name,
                'tenant' => ['code' => $row->tenant_code, 'name' => $row->tenant_name, 'status' => $row->tenant_status],
                'starts_on' => (string) $row->starts_on,
                'ends_on' => (string) $row->ends_on,
                'days' => (int) Carbon::parse($row->starts_on)->diffInDays($ends),
                'days_left' => $row->status === 'activo' ? max(0, (int) $today->diffInDays($ends, false)) : null,
                'price' => Decimal::toApi(Decimal::money($row->price)),
                'currency' => $row->currency,
                'features' => array_map(fn (string $key) => ['key' => $key, 'label' => $labels[$key] ?? $key], $keys),
                'reason' => $row->reason,
                'status' => $row->status,
                'source' => $row->source,
                'convert_to' => $row->plan_code ? ['code' => $row->plan_code, 'name' => $row->plan_name] : null,
                'invoice' => $row->invoice_number ? sprintf('%s-%08d', trim((string) $row->invoice_series), (int) $row->invoice_number) : null,
                'author' => $row->author,
                'created_at' => Carbon::parse($row->created_at)->toIso8601String(),
            ];
        });
        $active = $items->where('status', 'activo');

        return [
            'kpis' => [
                'active' => $active->count(),
                'expiring' => $active->filter(fn (array $p) => $p['days_left'] !== null && $p['days_left'] <= 7)->count(),
                'converted' => $items->where('status', 'convertido')->count(),
                'revenue' => Decimal::toApi($rows->reduce(fn ($sum, object $row) => $row->status === 'revocado' ? $sum : $sum->plus(Decimal::money($row->price)), Decimal::money(0))),
            ],
            'items' => $items->values()->all(),
            'tenants' => $this->db()->table('tenants as t')->leftJoin('plans as p', 'p.id', '=', 't.plan_id')->orderBy('t.commercial_name')
                ->get(['t.code', 't.commercial_name', 't.status', 'p.name as plan'])
                ->map(fn (object $t) => ['code' => $t->code, 'name' => $t->commercial_name, 'status' => $t->status, 'plan' => $t->plan, 'has_active_pass' => $active->contains(fn (array $p) => $p['tenant']['code'] === $t->code)])->values()->all(),
            'features' => $features->map(fn (object $f) => ['key' => $f->key, 'label' => $f->label, 'module' => $f->module])->values()->all(),
            'default_features' => ['module.crm', 'module.catalog', 'module.quotes', 'module.reservations', 'module.finance_basic', 'module.portal_client'],
            'plans' => $this->db()->table('plans')->where('status', 'active')->orderBy('rank')->get(['code', 'name'])->map(fn (object $p) => ['code' => $p->code, 'name' => $p->name])->values()->all(),
            'addons' => $this->db()->table('addons')->orderBy('label')->get(['code', 'label', 'unit', 'billing_mode', 'price_once', 'price_month'])
                ->map(fn (object $a) => [
                    'code' => $a->code,
                    'label' => $a->label,
                    'unit' => $a->unit,
                    'billing_mode' => $a->billing_mode,
                    'price_once' => $a->price_once === null ? null : Decimal::toApi(Decimal::money($a->price_once)),
                    'price_month' => $a->billing_mode === 'unico' || $a->price_month === null ? null : Decimal::toApi(Decimal::money($a->price_month)),
                ])->values()->all(),
            'rules' => ['max_days' => ShowcaseRules::PASS_MAX_DAYS, 'default_days' => 30, 'default_price' => '149.00', 'read_only_days' => 15],
        ];
    }

    private function db(): ConnectionInterface
    {
        return DB::connection('pgsql_platform');
    }
}
