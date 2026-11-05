<?php

declare(strict_types=1);

namespace App\Domain\Shared\Tenancy;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Scope;

/**
 * Global scope de tenant (primera barrera; la segunda es RLS en PostgreSQL).
 *
 * Sin contexto de tenant agrega `where 1 = 0`: falla cerrado igual que RLS (sin app.tenant_id → cero filas).
 * Para el código de plataforma (Super Admin, jobs multi-tenant) se usa la conexión `pgsql_platform`
 * y `withoutGlobalScope(TenantScope::class)` de forma explícita y revisada.
 */
final class TenantScope implements Scope
{
    public function apply(Builder $builder, Model $model): void
    {
        $tenantId = app(TenantContext::class)->id();

        if ($tenantId === null) {
            $builder->whereRaw('1 = 0');

            return;
        }

        $builder->where($model->qualifyColumn('tenant_id'), $tenantId);
    }
}
