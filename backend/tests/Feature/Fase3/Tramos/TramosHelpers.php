<?php

use Illuminate\Support\Facades\DB;

if (! function_exists('tramosAudited')) {
    function tramosAudited(array $where): bool
    {
        return (bool) withinTenant(tenantA(), fn () => DB::table('audit_events')->where($where)->exists());
    }
}
