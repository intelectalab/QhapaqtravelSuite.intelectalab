<?php

use Database\Seeders\Modules\PlatformTrackingSeeder;
use Database\Seeders\Modules\TrackingSeeder;
use Illuminate\Support\Facades\DB;

require_once __DIR__.'/SeguimientoHelpers.php';

beforeEach(fn () => segCleanSlate());

it('los seeders de seguimiento cargan etiquetas, conversiones, envíos y visitas del prototipo y se pueden repetir', function () {
    withinTenant(tenantA(), fn () => (new TrackingSeeder(tenantA()))->run());
    withinTenant(tenantA(), fn () => (new TrackingSeeder(tenantA()))->run());
    (new PlatformTrackingSeeder(tenantB()))->run();
    expect(DB::connection('pgsql_platform')->table('platform_tracking_tags')->count())->toBe(0);
    (new PlatformTrackingSeeder(tenantA()))->run();
    withinTenant(tenantB(), fn () => (new TrackingSeeder(tenantB()))->run());
    expect(withinTenant(tenantB(), fn () => DB::table('mkt_tracking_tags')->count()))->toBe(0);

    actingAsSeed('U01');
    $tags = $this->getJson('/api/v1/marketing/tracking/tags')->assertOk()->json('data');
    expect($tags['rows'])->toHaveCount(6)->and($tags['kpis']['in_review'])->toBe(1);
    expect($this->getJson('/api/v1/marketing/tracking/dispatches')->assertOk()->json('data.rows'))->toHaveCount(9);
    expect($this->getJson('/api/v1/analytics/web/overview?days=30')->assertOk()->json('data.kpis.visits'))->toBeGreaterThan(1000);

    actingAsPlatform();
    expect($this->getJson('/api/v1/platform/tracking/tags')->assertOk()->json('data.rows'))->toHaveCount(5);
    expect($this->getJson('/api/v1/platform/analytics/web/overview?days=30&site=vitrina')->assertOk()->json('data.kpis.visits'))->toBeGreaterThan(1000);
    expect(DB::connection('pgsql_platform')->table('platform_conversion_mappings')->count())->toBeGreaterThanOrEqual(5);
});
