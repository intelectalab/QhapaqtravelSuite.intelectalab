<?php

declare(strict_types=1);

namespace App\Domain\Platform\Support;

use App\Domain\Platform\Http\Requests\TenantProvisionRequest;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Support\Facades\DB;

final class PublicShowcase
{
    private const CONNECTION = 'pgsql_platform';

    private const LIVE = ['activo', 'prueba'];

    private const FUNNEL = [
        'leads' => 'crm_leads',
        'opportunities' => 'crm_opportunities',
        'quotes' => 'quote_quotes',
        'reservations' => 'booking_reservations',
        'operations' => 'ops_orders',
        'payments' => 'fin_payments',
    ];

    public function overview(): array
    {
        $tenants = $this->db()->table('tenants as t')->join('plans as p', 'p.id', '=', 't.plan_id')
            ->whereIn('t.status', self::LIVE)
            ->get(['t.business_type', 't.status', 'p.code as plan', 'p.name as plan_name', 'p.rank']);

        return [
            'agencies' => [
                'live' => $tenants->count(),
                'active' => $tenants->where('status', 'activo')->count(),
                'cities' => $this->db()->table('iam_sedes as s')->join('tenants as t', 't.id', '=', 's.tenant_id')->whereIn('t.status', self::LIVE)->whereNull('s.deleted_at')->distinct()->count('s.city'),
            ],
            'segments' => collect(TenantProvisionRequest::BUSINESS_TYPES)->map(function (string $type) use ($tenants): array {
                $members = $tenants->where('business_type', $type);
                $favorite = $members->groupBy('plan')->sortByDesc(fn ($group) => $group->count())->keys()->first();

                return [
                    'type' => $type,
                    'agencies' => $members->count(),
                    'plan' => $favorite,
                    'plan_name' => $favorite ? $members->firstWhere('plan', $favorite)->plan_name : null,
                    'plan_rank' => $favorite ? (int) $members->firstWhere('plan', $favorite)->rank : null,
                ];
            })->values()->all(),
            'funnel' => collect(self::FUNNEL)->map(fn (string $table) => $this->db()->table($table)->count())->all(),
            'reservations' => $this->db()->table('booking_reservations')->selectRaw('status, count(*) as total')->groupBy('status')->orderByDesc('total')->pluck('total', 'status')->map(fn ($total) => (int) $total)->all(),
            'catalog' => [
                'products' => $this->db()->table('catalog_products')->count(),
                'rules' => $this->db()->table('plan_rule_entitlements')->count(),
                'features' => $this->db()->table('features')->where('kind', 'module')->count(),
                'plans' => $this->db()->table('plans')->where('status', 'active')->count(),
            ],
        ];
    }

    private function db(): ConnectionInterface
    {
        return DB::connection(self::CONNECTION);
    }
}
