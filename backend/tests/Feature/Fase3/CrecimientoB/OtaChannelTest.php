<?php

use Illuminate\Support\Facades\DB;

if (! function_exists('crecbAudited')) {
    function crecbAudited(array $where): bool
    {
        return (bool) withinTenant(tenantA(), fn () => DB::table('audit_events')->where($where)->exists());
    }
}

function crecbActiveProduct(): string
{
    return (string) withinTenant(tenantA(), fn () => DB::table('catalog_products')->whereNull('deleted_at')->where('status', 'ACTIVE')->orderBy('code')->value('code'));
}

it('conecta una OTA verificando la clave, mapea un producto y sincroniza', function () {
    actingAsSeed('U01');

    $connection = $this->postJson('/api/v1/channels/ota/connections', ['ota' => 'viator', 'name' => 'Viator Perú', 'account_ref' => 'SUP-4411', 'api_key' => 'viator-key-123456', 'commission_pct' => 20, 'markup_pct' => 10])
        ->assertCreated()
        ->assertJsonPath('data.status', 'conectado')
        ->json('data');

    expect(json_encode($connection))->not->toContain('viator-key-123456')
        ->and((string) rowOf('channel_ota_connections', $connection['code'])->credentials_encrypted)->not->toContain('viator-key');

    $product = crecbActiveProduct();
    $this->putJson("/api/v1/channels/ota/connections/{$connection['code']}/mappings/{$product}", ['ota_product_ref' => 'V-1001', 'price_mode' => 'fijo'])->assertStatus(422);
    $this->putJson("/api/v1/channels/ota/connections/{$connection['code']}/mappings/{$product}", ['ota_product_ref' => 'V-1001', 'price_mode' => 'markup'])
        ->assertOk()
        ->assertJsonPath('data.status', 'pendiente');

    $this->postJson("/api/v1/channels/ota/connections/{$connection['code']}/sync", [], critical())
        ->assertOk()
        ->assertJsonPath('data.synced', true)
        ->assertJsonPath('data.listings', 1);

    $this->getJson("/api/v1/channels/ota/connections/{$connection['code']}/mappings")->assertOk()->assertJsonPath('data.mappings.0.status', 'activo');
    $this->getJson('/api/v1/channels/ota/connections')->assertOk()->assertJsonPath('data.connections', fn (array $rows) => collect($rows)->firstWhere('code', $connection['code'])['mappings']['active'] === 1);

    expect(crecbAudited(['entity' => 'Conexión OTA', 'entity_id' => $connection['code'], 'action' => 'sincronizar']))->toBeTrue()
        ->and(crecbAudited(['entity' => 'Mapeo OTA', 'entity_id' => "{$connection['code']}:{$product}", 'action' => 'crear']))->toBeTrue();
});

it('una clave rechazada deja la conexión por verificar con el motivo', function () {
    actingAsSeed('U02');

    $this->postJson('/api/v1/channels/ota/connections', ['ota' => 'getyourguide', 'name' => 'GetYourGuide', 'account_ref' => 'error-cuenta', 'api_key' => 'gyg-key-123456'])
        ->assertCreated()
        ->assertJsonPath('data.status', 'borrador')
        ->assertJsonPath('data.last_error', 'La OTA no reconoce esa cuenta de proveedor.');

    $this->postJson('/api/v1/channels/ota/connections', ['ota' => 'viator', 'name' => 'Corta', 'api_key' => 'corta'])->assertStatus(422);
});

it('pausa, reanuda y desconecta con If-Match; una conexión pausada no sincroniza', function () {
    actingAsSeed('U01');
    $code = $this->postJson('/api/v1/channels/ota/connections', ['ota' => 'civitatis', 'name' => 'Civitatis', 'account_ref' => 'CIV-1', 'api_key' => 'civitatis-123456'])->json('data.code');
    $version = fn (): int => (int) rowOf('channel_ota_connections', $code)->lock_version;
    $this->putJson("/api/v1/channels/ota/connections/{$code}/mappings/".crecbActiveProduct(), ['ota_product_ref' => 'C-1', 'status' => 'activo'])->assertOk();

    $this->patchJson("/api/v1/channels/ota/connections/{$code}", ['action' => 'pausar'])->assertStatus(428);
    $this->patchJson("/api/v1/channels/ota/connections/{$code}", ['action' => 'pausar'], critical($version()))->assertOk()->assertJsonPath('data.status', 'pausado');
    $this->postJson("/api/v1/channels/ota/connections/{$code}/sync", [], critical())->assertStatus(409);
    $this->patchJson("/api/v1/channels/ota/connections/{$code}", ['action' => 'reanudar', 'markup_pct' => 15], critical($version()))->assertOk()->assertJsonPath('data.status', 'conectado')->assertJsonPath('data.markup_pct', '15.00');
    $this->patchJson("/api/v1/channels/ota/connections/{$code}", ['action' => 'desconectar'], critical($version()))->assertOk()->assertJsonPath('data.status', 'desconectado');

    expect($this->getJson("/api/v1/channels/ota/connections/{$code}/mappings")->json('data.mappings.0.status'))->toBe('pausado');
    $this->patchJson("/api/v1/channels/ota/connections/{$code}", ['name' => 'Otra'], critical($version()))->assertStatus(409);
});

it('lista las reservas recibidas de las OTAs con su estado', function () {
    actingAsSeed('U01');
    $code = $this->postJson('/api/v1/channels/ota/connections', ['ota' => 'expedia', 'name' => 'Expedia', 'account_ref' => 'EXP-1', 'api_key' => 'expedia-123456'])->json('data.code');
    withinTenant(tenantA(), fn () => DB::table('channel_ota_bookings')->insert(['connection_id' => DB::table('channel_ota_connections')->where('code', $code)->value('id'), 'ota_booking_ref' => 'EXP-BK-1', 'payload' => '{}', 'gross_amount' => '320.00', 'currency' => 'USD', 'pax' => 2, 'status' => 'rechazada', 'error' => 'Sin cupo para la fecha']));

    $this->getJson("/api/v1/channels/ota/bookings?filter[status]=rechazada&filter[connection]={$code}")->assertOk()
        ->assertJsonPath('data.0.ota_booking_ref', 'EXP-BK-1')
        ->assertJsonPath('data.0.gross_amount', '320.00')
        ->assertJsonCount(1, 'data');
});
