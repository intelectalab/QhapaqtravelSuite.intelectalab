<?php

use Illuminate\Support\Facades\DB;

if (! function_exists('crmInboxAudited')) {
    function crmInboxAudited(array $where): bool
    {
        return (bool) withinTenant(tenantA(), fn () => DB::table('audit_events')->where($where)->exists());
    }
}
