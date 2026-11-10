<?php

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;

function catServiceAudit(array $where): bool
{
    return withinTenant(tenantA(), fn () => DB::table('audit_events')->where($where)->exists());
}

function catServiceRow(string $ref): object
{
    return rowOf('catalog_services', $ref, column: 'ref');
}

function catServiceBody(array $overrides = []): array
{
    return [
        'provider_id' => rowOf('catalog_providers', 'PRV-004', column: 'ref')->id,
        'name' => 'Traslado Cusco — Valle Sur',
        'type' => 'Traslado',
        'unit' => 'vehículo',
        'cost' => 180,
        'currency' => 'PEN',
        'capacity' => 12,
        'valid_from' => '2026-01-01',
        'valid_to' => '2026-12-31',
        ...$overrides,
    ];
}

function catServiceBodyOf(string $ref, array $overrides = []): array
{
    $row = catServiceRow($ref);

    return catServiceBody([
        'provider_id' => $row->provider_id, 'name' => $row->name, 'type' => $row->type, 'unit' => $row->unit, 'cost' => (float) $row->cost,
        'currency' => trim($row->currency), 'capacity' => $row->capacity, 'valid_from' => $row->valid_from, 'valid_to' => $row->valid_to, ...$overrides,
    ]);
}

function catServiceComponentOf(string $product): string
{
    return withinTenant(tenantA(), fn () => (string) DB::table('catalog_product_items as i')->join('catalog_services as s', 's.id', '=', 'i.service_id')
        ->where('i.product_id', idOf('catalog_products', $product))->orderBy('s.ref')->value('s.ref'));
}

function catServiceProductLock(string $code): int
{
    return (int) rowOf('catalog_products', $code)->lock_version;
}

beforeEach(fn () => Queue::fake());

it('crea un servicio activo cuando el proveedor está activo', function () {
    actingAsSeed('U05');

    $response = $this->postJson('/api/v1/catalog/services', catServiceBody())->assertCreated()->assertJsonPath('data.warning', null);
    $ref = (string) $response->json('data.ref');
    $row = catServiceRow($ref);

    expect($ref)->toStartWith('SRV-')
        ->and($row->status)->toBe('activo')
        ->and((string) $row->cost)->toBe('180.00')
        ->and(catServiceAudit(['entity' => 'Servicio', 'entity_id' => $ref, 'action' => 'crear']))->toBeTrue();
    expect(collect($this->getJson('/api/v1/catalog/services')->assertOk()->json('data.services'))->pluck('ref'))->toContain($ref);
});

it('un servicio de proveedor inactivo se guarda inactivo con aviso', function () {
    actingAsSeed('U01');

    $response = $this->postJson('/api/v1/catalog/services', catServiceBody(['provider_id' => rowOf('catalog_providers', 'PRV-013', column: 'ref')->id]))->assertCreated();

    expect($response->json('data.warning'))->toContain('inactivo')
        ->and(catServiceRow((string) $response->json('data.ref'))->status)->toBe('inactivo');
});

it('valida los datos del servicio', function () {
    actingAsSeed('U01');

    $this->postJson('/api/v1/catalog/services', catServiceBody(['cost' => -1, 'unit' => 'kilo', 'valid_to' => '2025-01-01', 'provider_id' => 'no-uuid']))
        ->assertStatus(422)->assertJsonValidationErrors(['cost', 'unit', 'valid_to', 'provider_id']);
    expect($this->postJson('/api/v1/catalog/services', catServiceBody(['provider_id' => '01a1b4f8-0000-7000-8000-000000000000'])))->toBeApiError(422, 'VALIDATION_ERROR');
    $this->patchJson('/api/v1/catalog/services/SRV-999', catServiceBody())->assertNotFound();
});

it('gerencia, ventas y finanzas no gestionan servicios', function (string $user) {
    actingAsSeed($user);

    expect($this->postJson('/api/v1/catalog/services', catServiceBody()))->toBeApiError(403);
    expect($this->patchJson('/api/v1/catalog/services/SRV-012', catServiceBodyOf('SRV-012', ['cost' => 1])))->toBeApiError(403);
    expect($this->postJson('/api/v1/catalog/services/SRV-012/deactivate', ['reason' => 'Prueba']))->toBeApiError(403);
    expect($this->postJson('/api/v1/catalog/services/SRV-012/activate'))->toBeApiError(403);
    expect(catServiceRow('SRV-012')->status)->toBe('activo');
})->with(['U02', 'U03', 'U07']);

it('cambiar el costo se audita como cambio de costo con los productos que lo usan', function () {
    actingAsSeed('U05');

    $this->patchJson('/api/v1/catalog/services/SRV-012', catServiceBodyOf('SRV-012', ['cost' => 95.5]))->assertOk()->assertJsonPath('data.ref', 'SRV-012');

    expect((string) catServiceRow('SRV-012')->cost)->toBe('95.50')
        ->and(catServiceAudit(['entity' => 'Servicio', 'entity_id' => 'SRV-012', 'action' => 'cambio_costo']))->toBeTrue();
    $after = withinTenant(tenantA(), fn () => DB::table('audit_events')->where('entity_id', 'SRV-012')->where('action', 'cambio_costo')->value('after_value'));
    expect($after)->toContain('PEN 95.5')->toContain('usado en');

    $this->patchJson('/api/v1/catalog/services/SRV-012', catServiceBodyOf('SRV-012', ['name' => 'Transporte Cusco — Soraypampa']))->assertOk();
    expect(catServiceRow('SRV-012')->name)->toBe('Transporte Cusco — Soraypampa')
        ->and(catServiceAudit(['entity' => 'Servicio', 'entity_id' => 'SRV-012', 'action' => 'modificar']))->toBeTrue();
});

it('mover el servicio a un proveedor inactivo lo deja inactivo', function () {
    actingAsSeed('U01');

    $this->patchJson('/api/v1/catalog/services/SRV-012', catServiceBodyOf('SRV-012', ['provider_id' => rowOf('catalog_providers', 'PRV-013', column: 'ref')->id]))
        ->assertOk()->assertJsonPath('data.warning', fn (?string $warning) => str_contains((string) $warning, 'inactivo'));

    expect(catServiceRow('SRV-012')->status)->toBe('inactivo');
});

it('desactivar y activar un servicio respeta proveedor y vigencia', function () {
    actingAsSeed('U05');

    $this->postJson('/api/v1/catalog/services/SRV-012/deactivate', [])->assertStatus(422)->assertJsonValidationErrors('reason');
    $this->postJson('/api/v1/catalog/services/SRV-012/deactivate', ['reason' => 'Ruta cerrada'])->assertOk();
    expect(catServiceRow('SRV-012')->status)->toBe('inactivo')
        ->and(catServiceAudit(['entity' => 'Servicio', 'entity_id' => 'SRV-012', 'action' => 'desactivar']))->toBeTrue();

    $this->postJson('/api/v1/catalog/services/SRV-012/activate')->assertOk();
    expect(catServiceRow('SRV-012')->status)->toBe('activo')
        ->and(catServiceAudit(['entity' => 'Servicio', 'entity_id' => 'SRV-012', 'action' => 'activar']))->toBeTrue();

    expect($this->postJson('/api/v1/catalog/services/SRV-017/activate'))->toBeApiError(409, 'PRD-BR-007');

    $expired = (string) $this->postJson('/api/v1/catalog/services', catServiceBody(['valid_from' => '2026-01-01', 'valid_to' => '2026-09-01']))->assertCreated()->json('data.ref');
    $this->postJson("/api/v1/catalog/services/{$expired}/deactivate", ['reason' => 'Fin de vigencia'])->assertOk();
    expect($this->postJson("/api/v1/catalog/services/{$expired}/activate"))->toBeApiError(409, 'PRD-BR-003');
    expect(catServiceRow($expired)->status)->toBe('inactivo');
});

it('un componente inactivo bloquea la activación del producto que lo usa', function () {
    actingAsSeed('U01');
    $component = catServiceComponentOf('CUS-HUM-FD');

    $this->postJson('/api/v1/catalog/products/CUS-HUM-FD/deactivate', ['reason' => 'Revisión de componentes', 'lock_version' => catServiceProductLock('CUS-HUM-FD')], critical(catServiceProductLock('CUS-HUM-FD')))->assertOk();
    $this->postJson("/api/v1/catalog/services/{$component}/deactivate", ['reason' => 'Servicio suspendido'])->assertOk();

    $response = $this->postJson('/api/v1/catalog/products/CUS-HUM-FD/activate', ['lock_version' => catServiceProductLock('CUS-HUM-FD')], critical(catServiceProductLock('CUS-HUM-FD')));
    expect($response)->toBeApiError(422, 'PRD-ACT-CHECKLIST');
    $failed = collect($response->json('details.failed') ?? $response->json('failed'))->firstWhere('key', 'provider');
    expect($failed['detail'])->toContain($component);
    expect(rowOf('catalog_products', 'CUS-HUM-FD')->status)->toBe('INACTIVE');

    $this->postJson("/api/v1/catalog/services/{$component}/activate")->assertOk();
    $this->postJson('/api/v1/catalog/products/CUS-HUM-FD/activate', ['lock_version' => catServiceProductLock('CUS-HUM-FD')], critical(catServiceProductLock('CUS-HUM-FD')))->assertOk();
    expect(rowOf('catalog_products', 'CUS-HUM-FD')->status)->toBe('ACTIVE');
});
