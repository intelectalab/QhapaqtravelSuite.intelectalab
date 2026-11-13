<?php

use Database\Seeders\Modules\GrowthCommerceSeeder;
use Illuminate\Support\Facades\DB;

it('el seeder de crecimiento comercial deja datos para ver cada pantalla y se puede correr dos veces', function () {
    withinTenant(tenantA(), fn () => (new GrowthCommerceSeeder(tenantA()))->run());
    withinTenant(tenantA(), fn () => (new GrowthCommerceSeeder(tenantA()))->run());

    $counts = withinTenant(tenantA(), fn () => collect(['collab_whatsapp_templates', 'mkt_recovery_flows', 'mkt_recovery_attempts', 'catalog_dynamic_price_rules', 'channel_ota_connections', 'channel_ota_product_mappings', 'channel_ota_bookings', 'catalog_import_jobs'])
        ->mapWithKeys(fn (string $table) => [$table => DB::table($table)->count()])->all());

    expect($counts['collab_whatsapp_templates'])->toBe(4)
        ->and($counts['mkt_recovery_flows'])->toBe(2)
        ->and($counts['mkt_recovery_attempts'])->toBeGreaterThan(0)
        ->and($counts['catalog_dynamic_price_rules'])->toBe(3)
        ->and($counts['channel_ota_connections'])->toBe(1)
        ->and($counts['channel_ota_product_mappings'])->toBe(2)
        ->and($counts['channel_ota_bookings'])->toBe(2)
        ->and($counts['catalog_import_jobs'])->toBe(1);

    actingAsSeed('U01');
    $this->getJson('/api/v1/inbox/whatsapp-templates')->assertOk()->assertJsonPath('data.kpis.approved', 3);
    $this->getJson('/api/v1/channels/ota/connections')->assertOk()->assertJsonPath('data.connections.0.code', 'OTA-01');
    $this->getJson('/api/v1/catalog/imports/IMP-0001')->assertOk()->assertJsonPath('data.status', 'revision');
    $this->postJson('/api/v1/catalog/dynamic-price-rules', ['name' => 'Fin de semana', 'basis' => 'dia_semana', 'conditions' => ['weekdays' => [6, 7]], 'adjust_pct' => 5])->assertCreated()->assertJsonPath('data.code', 'PDN-004');
});
