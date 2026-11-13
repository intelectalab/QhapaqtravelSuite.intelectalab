<?php

use Illuminate\Support\Facades\DB;

require_once __DIR__.'/Support.php';

function crmInboxFxProvider(string $code, string $status): void
{
    withinTenant(tenantA(), fn () => DB::table('fx_rate_providers')->insert(['code' => $code, 'name' => "Proveedor {$code}", 'kind' => 'Simulado', 'status' => $status]));
}

it('muestra la excepción de una regla para un producto', function () {
    actingAsSeed('U01');

    $this->getJson('/api/v1/catalog/products/CUS-PKG-5D4N/rule-overrides/R-CUTOFF')->assertOk()
        ->assertJsonPath('data.code', 'R-CUTOFF')
        ->assertJsonPath('data.product', 'CUS-PKG-5D4N')
        ->assertJsonStructure(['data' => ['effective', 'has_override', 'params'], 'meta' => ['editable']]);
    $this->getJson('/api/v1/catalog/products/CUS-PKG-5D4N/rule-overrides/R-NO-EXISTE')->assertNotFound();

    actingAsSeed('U05');
    $denied = $this->getJson('/api/v1/catalog/products/CUS-PKG-5D4N/rule-overrides/R-CUTOFF');
    expect($denied)->toBeApiError(403);
    expect($denied->json('required_permissions'))->toContain('admin.settings.manage');
});

it('lista los dominios del widget', function () {
    actingAsSeed('U01');

    $response = $this->getJson('/api/v1/channels/widget/domains')->assertOk();

    expect($response->json('meta.total'))->toBe(count($response->json('data')));
});

it('previsualiza una plantilla de mensaje con los datos de la reserva', function () {
    actingAsSeed('U05');

    $data = $this->postJson('/api/v1/notifications/pax-templates/PMT-001/preview', ['reservation' => 'RES-2026-000350', 'channel' => 'email'])->assertOk()->json('data');
    expect($data['reservation'])->toBe('RES-2026-000350')
        ->and($data['body'])->not->toContain('{{');

    $this->postJson('/api/v1/notifications/pax-templates/PMT-002/preview', ['reservation' => 'RES-2026-000350', 'channel' => 'portal'])->assertStatus(422);
    $this->postJson('/api/v1/notifications/pax-templates/PMT-001/preview', ['reservation' => 'RES-NO-EXISTE'])->assertNotFound();
});

it('convierte montos con y sin margen y valida la moneda', function () {
    actingAsSeed('U01');

    $data = $this->getJson('/api/v1/finance/currencies/convert?amount=100&from=USD&to=PEN')->assertOk()->json('data');
    expect($data['result'])->toBeGreaterThan(100)
        ->and($data['client_result'])->toBeLessThanOrEqual($data['result']);

    $this->getJson('/api/v1/finance/currencies/convert?amount=100&from=USD&to=XXX')->assertStatus(422);
    $this->getJson('/api/v1/finance/currencies/convert')->assertStatus(422);
});

it('lista el historial del tipo de cambio de una moneda', function () {
    actingAsSeed('U07');

    $response = $this->getJson('/api/v1/finance/currencies/USD/rates?page[size]=5')->assertOk();

    expect($response->json('data'))->not->toBeEmpty()
        ->and(collect($response->json('data'))->pluck('currency')->unique()->all())->toBe(['USD']);
    $this->getJson('/api/v1/finance/currencies/ZZZ/rates')->assertNotFound();
});

it('lista proveedores de tipo de cambio y prueba la conexión con auditoría', function () {
    crmInboxFxProvider('FXP-TEST', 'inactivo');
    actingAsSeed('U01');

    $list = $this->getJson('/api/v1/finance/fx-providers')->assertOk();
    expect(collect($list->json('data'))->pluck('code'))->toContain('FXP-TEST')
        ->and($list->json('meta'))->toHaveKeys(['active', 'adapter', 'simulated']);

    $this->postJson('/api/v1/finance/fx-providers/FXP-TEST/test')->assertOk()->assertJsonPath('data.ok', true);
    expect(crmInboxAudited(['entity' => 'Tipo de cambio', 'entity_id' => 'FXP-TEST', 'action' => 'probar_conexion']))->toBeTrue();
    $this->postJson('/api/v1/finance/fx-providers/FXP-NADA/test')->assertNotFound();

    actingAsSeed('U07');
    $denied = $this->postJson('/api/v1/finance/fx-providers/FXP-TEST/test');
    expect($denied)->toBeApiError(403);
    expect($denied->json('required_permissions'))->toContain('admin.settings.manage');
});

it('actualiza el tipo de cambio desde el proveedor activo y reemplaza el valor del día', function () {
    actingAsSeed('U07');
    $this->postJson('/api/v1/finance/currencies/refresh')->assertStatus(409)->assertJsonPath('code', 'FX-04');

    crmInboxFxProvider('FXP-ACT', 'activo');
    $first = $this->postJson('/api/v1/finance/currencies/refresh')->assertOk()->json('data');
    expect($first['provider'])->toBe('FXP-ACT')
        ->and(collect($first['rates'])->pluck('currency'))->toContain('USD');

    $second = $this->postJson('/api/v1/finance/currencies/refresh')->assertOk()->json('data');
    expect(collect($second['rates'])->every(fn (array $rate): bool => $rate['replaced']))->toBeTrue();

    $provider = withinTenant(tenantA(), fn () => DB::table('fx_rate_providers')->where('code', 'FXP-ACT')->first(['id', 'last_run_at']));
    expect($provider->last_run_at)->not->toBeNull()
        ->and(withinTenant(tenantA(), fn () => DB::table('fin_fx_rates')->where('currency_code', 'USD')->where('provider_id', $provider->id)->where('rate_date', $first['date'])->count()))->toBe(2)
        ->and(crmInboxAudited(['entity' => 'Tipo de cambio', 'entity_id' => 'FXP-ACT', 'action' => 'actualizar_desde_proveedor']))->toBeTrue();
});
