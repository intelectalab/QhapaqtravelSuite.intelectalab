<?php

declare(strict_types=1);

namespace App\Domain\Platform\Support;

use App\Domain\Platform\Models\Plan;
use App\Domain\Platform\Models\Tenant;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class TenantDirectory
{
    private const CONNECTION = 'pgsql_platform';

    public function all(): Collection
    {
        $tenants = Tenant::on(self::CONNECTION)->orderBy('code')->get();

        return $tenants->map(fn (Tenant $tenant) => $this->summary($tenant, $this->counts()));
    }

    public function locate(string $id): ?Tenant
    {
        return Tenant::on(self::CONNECTION)->where(Str::isUuid($id) ? 'id' : 'code', $id)->first();
    }

    public function find(string $id): ?array
    {
        $tenant = $this->locate($id);

        if ($tenant === null) {
            return null;
        }

        $sedes = DB::connection(self::CONNECTION)->table('iam_sedes')->where('tenant_id', $tenant->getKey())->whereNull('deleted_at')
            ->orderByDesc('is_main')->orderBy('name')->get(['code', 'name', 'city', 'status', 'is_main']);

        $admins = DB::connection(self::CONNECTION)->table('iam_users as u')
            ->join('model_has_roles as mr', 'mr.model_id', '=', 'u.id')
            ->join('roles as r', 'r.id', '=', 'mr.role_id')
            ->where('u.tenant_id', $tenant->getKey())->where('r.name', 'tenant_admin')->whereNull('u.deleted_at')
            ->get(['u.name', 'u.email', 'u.status', 'u.last_login_at']);

        return [
            ...$this->summary($tenant, $this->counts()),
            'fiscal_address' => $tenant->fiscal_address,
            'business_type' => $tenant->business_type,
            'timezone' => $tenant->timezone,
            'base_currency' => $tenant->base_currency,
            'locations' => $sedes,
            'admins' => $admins,
            'history' => $this->history($tenant),
        ];
    }

    private function history(Tenant $tenant): Collection
    {
        return DB::connection(self::CONNECTION)->table('audit_events as a')
            ->leftJoin('platform_users as p', 'p.id', '=', 'a.actor_id')
            ->where('a.entity', 'Tenant')->where('a.entity_id', $tenant->code)
            ->orderByDesc('a.occurred_at')->limit(20)
            ->get(['a.action', 'a.before_value', 'a.after_value', 'a.occurred_at', 'p.name as actor']);
    }

    private ?array $counts = null;

    private function counts(): array
    {
        return $this->counts ??= [
            'users' => DB::connection(self::CONNECTION)->table('iam_users')->whereNull('deleted_at')->where('status', 'activo')
                ->selectRaw('tenant_id, count(*) as total')->groupBy('tenant_id')->pluck('total', 'tenant_id')->all(),
            'sedes' => DB::connection(self::CONNECTION)->table('iam_sedes')->whereNull('deleted_at')
                ->selectRaw('tenant_id, count(*) as total')->groupBy('tenant_id')->pluck('total', 'tenant_id')->all(),
            'plans' => Plan::on(self::CONNECTION)->get()->keyBy('id'),
        ];
    }

    private function summary(Tenant $tenant, array $counts): array
    {
        $plan = $counts['plans'][$tenant->plan_id] ?? null;

        return [
            'id' => $tenant->getKey(),
            'code' => $tenant->code,
            'name' => $tenant->commercial_name,
            'legal_name' => $tenant->legal_name,
            'ruc' => $tenant->ruc,
            'subdomain' => $tenant->subdomain,
            'initials' => $tenant->logo_initials,
            'admin_email' => $tenant->admin_email,
            'status' => $tenant->status,
            'plan' => $plan ? ['code' => $plan->code, 'name' => $plan->name, 'rank' => $plan->rank, 'price_month' => $plan->price_month] : null,
            'users' => (int) ($counts['users'][$tenant->getKey()] ?? 0),
            'sedes' => (int) ($counts['sedes'][$tenant->getKey()] ?? 0),
            'modules' => $tenant->modules,
            'mrr' => $tenant->mrr,
            'storage_used_bytes' => $tenant->storage_used_bytes,
            'trial_ends_at' => $tenant->trial_ends_at?->toIso8601String(),
            'suspend_reason' => $tenant->suspend_reason,
            'suspended_at' => $tenant->suspended_at?->toIso8601String(),
            'created_at' => $tenant->created_at?->toIso8601String(),
            'lock_version' => (int) $tenant->lock_version,
        ];
    }
}
