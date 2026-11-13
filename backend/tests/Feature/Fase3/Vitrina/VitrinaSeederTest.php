<?php

use Database\Seeders\Modules\VitrinaSeeder;
use Illuminate\Support\Facades\DB;

it('el seeder de la vitrina deja datos de demostración coherentes y es repetible', function () {
    foreach (['TNT-0001', 'TNT-0005', 'TNT-0006'] as $code) {
        $tenant = tenantByCode($code);
        withinTenant($tenant, fn () => (new VitrinaSeeder($tenant))->run());
    }

    withinTenant(tenantA(), fn () => (new VitrinaSeeder(tenantA()))->run());
    $platform = DB::connection('pgsql_platform');

    expect($platform->table('platform_showcase_listings')->where('status', 'publicado')->count())->toBeGreaterThanOrEqual(9)
        ->and($platform->table('platform_showcase_agencies')->where('code', 'SHA-02')->value('tenant_id'))->toBe((string) tenantByCode('TNT-0005')->getKey())
        ->and($platform->table('platform_access_passes')->where('code', 'PASE-0001')->value('status'))->toBe('activo')
        ->and($platform->table('feature_overrides')->where('reason', 'Pase PASE-0001')->exists())->toBeTrue()
        ->and($platform->table('platform_blog_posts')->where('status', 'publicado')->count())->toBe(3)
        ->and($platform->table('platform_funnel_events')->where('kind', 'reserva')->count())->toBeGreaterThan(0)
        ->and($platform->table('addons')->where('code', 'paypal_gateway')->value('billing_mode'))->toBe('unico');

    withinTenant(tenantA(), function () {
        expect(DB::table('fin_gateway_accounts')->count())->toBe(3)
            ->and(DB::table('cms_site_domains')->where('status', 'verificado')->count())->toBe(2)
            ->and(DB::table('cms_seo_pages')->count())->toBe(5)
            ->and(DB::table('cms_redirects')->where('active', true)->count())->toBe(2)
            ->and(DB::table('cms_travel_stories')->where('status', 'publicado')->count())->toBe(1)
            ->and(DB::table('fin_payment_fees')->whereRaw('net <> gross - fee - fee_tax - fx_spread')->count())->toBe(0);
    });
});
