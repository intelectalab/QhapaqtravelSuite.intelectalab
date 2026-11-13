<?php

use App\Domain\Landing\Fake\FakeRucLookup;
use Illuminate\Support\Facades\DB;

function segAudited(array $where, bool $platform = false): bool
{
    return $platform
        ? DB::connection('pgsql_platform')->table('audit_events')->whereNull('tenant_id')->where($where)->exists()
        : (bool) withinTenant(tenantA(), fn () => DB::table('audit_events')->where($where)->exists());
}

function segCleanSlate(): void
{
    foreach ([tenantA(), tenantB()] as $tenant) {
        withinTenant($tenant, function () {
            foreach (['mkt_conversion_dispatches', 'mkt_conversion_mappings', 'mkt_tracking_tags', 'cms_web_analytics_daily'] as $table) {
                DB::table($table)->delete();
            }
        });
    }

    foreach (['platform_conversion_dispatches', 'platform_conversion_mappings', 'platform_tracking_tags', 'platform_web_analytics_daily'] as $table) {
        DB::connection('pgsql_platform')->table($table)->delete();
    }
}

function segRuc(string $first10): string
{
    return $first10.FakeRucLookup::checkDigit($first10);
}
