<?php

use App\Domain\Platform\Models\Tenant;
use Illuminate\Support\Facades\DB;

function p3Audited(array $where, ?Tenant $tenant = null): bool
{
    return (bool) withinTenant($tenant ?? tenantA(), fn () => DB::table('audit_events')->where($where)->exists());
}

function p3Row(string $table, array $where): ?object
{
    return withinTenant(tenantA(), fn () => DB::table($table)->where($where)->first());
}
