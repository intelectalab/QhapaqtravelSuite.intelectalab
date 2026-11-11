<?php

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;

function catProviderAudit(array $where): bool
{
    return withinTenant(tenantA(), fn () => DB::table('audit_events')->where($where)->exists());
}

function catProviderRow(string $ref): object
{
    return rowOf('catalog_providers', $ref, column: 'ref');
}

function catProviderBody(array $overrides = []): array
{
    return [
        'name' => 'Inka Rail Express S.A.C.',
        'type' => 'Tren',
        'ruc' => '20612345678',
        'city' => 'Cusco',
        'contact_name' => 'Rosa Quispe',
        'phone' => '+51 984 111 222',
        'email' => 'reservas@inkarail.pe',
        'contract_start' => '2026-01-01',
        'contract_end' => '2027-12-31',
        'currency' => 'USD',
        'payment_terms' => '30 días',
        'rating' => 4.5,
        ...$overrides,
    ];
}

function catProviderBodyOf(string $ref, array $overrides = []): array
{
    $row = catProviderRow($ref);

    return catProviderBody([
        'name' => $row->name, 'type' => $row->type, 'ruc' => $row->ruc, 'city' => $row->city, 'contact_name' => $row->contact_name ?: 'Contacto comercial',
        'phone' => $row->phone, 'email' => $row->email, 'contract_start' => $row->contract_start, 'contract_end' => $row->contract_end,
        'currency' => trim($row->currency), 'payment_terms' => $row->payment_terms, 'rating' => (float) $row->rating ?: null, ...$overrides,
    ]);
}

function catProviderContacts(string $ref): array
{
    return withinTenant(tenantA(), fn () => DB::table('catalog_provider_contacts')->where('provider_id', catProviderRow($ref)->id)->orderBy('name')->pluck('name', 'id')->all());
}

beforeEach(function () {
    lockCatalogProducts();
    Queue::fake();
});

it('registra un proveedor inactivo con su contacto comercial', function () {
    actingAsSeed('U05');

    $ref = (string) $this->postJson('/api/v1/catalog/providers', catProviderBody())->assertCreated()->json('data.ref');
    $row = catProviderRow($ref);

    expect($ref)->toStartWith('PRV-')
        ->and($row->status)->toBe('inactivo')
        ->and($row->ruc)->toBe('20612345678')
        ->and(array_values(catProviderContacts($ref)))->toBe(['Rosa Quispe'])
        ->and(catProviderAudit(['entity' => 'Proveedor', 'entity_id' => $ref, 'action' => 'crear']))->toBeTrue();
    expect(collect($this->getJson('/api/v1/catalog/providers')->assertOk()->json('data.providers'))->pluck('ref'))->toContain($ref);
});

it('valida RUC, fechas de contrato y correo, y no repite el RUC', function () {
    actingAsSeed('U01');

    $this->postJson('/api/v1/catalog/providers', catProviderBody(['ruc' => '30123456789', 'contract_end' => '2025-12-31', 'email' => 'no-es-correo', 'type' => 'Nave']))
        ->assertStatus(422)->assertJsonValidationErrors(['ruc', 'contract_end', 'email', 'type']);
    expect($this->postJson('/api/v1/catalog/providers', catProviderBody(['ruc' => catProviderRow('PRV-004')->ruc])))->toBeApiError(422, 'CAT-BR-38');
});

it('gerencia, ventas y finanzas no gestionan proveedores', function (string $user) {
    actingAsSeed($user);

    expect($this->postJson('/api/v1/catalog/providers', catProviderBody()))->toBeApiError(403);
    expect($this->patchJson('/api/v1/catalog/providers/PRV-004', catProviderBodyOf('PRV-004', ['city' => 'Lima'])))->toBeApiError(403);
    expect($this->postJson('/api/v1/catalog/providers/PRV-004/deactivate', ['reason' => 'Prueba']))->toBeApiError(403);
    expect($this->postJson('/api/v1/catalog/providers/PRV-013/activate'))->toBeApiError(403);
    expect($this->postJson('/api/v1/catalog/providers/PRV-004/contacts', ['name' => 'Nuevo contacto']))->toBeApiError(403);
    expect($this->deleteJson('/api/v1/catalog/providers/PRV-004/contacts/'.array_key_first(catProviderContacts('PRV-004'))))->toBeApiError(403);
    expect(catProviderRow('PRV-004')->status)->toBe('activo');
})->with(['U02', 'U03', 'U07']);

it('renovar el contrato de un proveedor vencido lo deja inactivo y luego se puede activar', function () {
    actingAsSeed('U01');

    expect($this->postJson('/api/v1/catalog/providers/PRV-011/activate'))->toBeApiError(409, 'CAT-BR-38');

    $this->patchJson('/api/v1/catalog/providers/PRV-011', catProviderBodyOf('PRV-011', ['contract_end' => '2027-06-30', 'payment_terms' => '15 días']))->assertOk();
    $row = catProviderRow('PRV-011');
    expect($row->status)->toBe('inactivo')
        ->and($row->contract_end)->toBe('2027-06-30')
        ->and($row->payment_terms)->toBe('15 días')
        ->and(catProviderAudit(['entity' => 'Proveedor', 'entity_id' => 'PRV-011', 'action' => 'modificar']))->toBeTrue();

    $this->postJson('/api/v1/catalog/providers/PRV-011/activate')->assertOk()->assertJsonPath('data.warning', null);
    expect(catProviderRow('PRV-011')->status)->toBe('activo')
        ->and(catProviderAudit(['entity' => 'Proveedor', 'entity_id' => 'PRV-011', 'action' => 'activar']))->toBeTrue();
});

it('editar no permite tomar el RUC de otro proveedor ni proveedores inexistentes', function () {
    actingAsSeed('U01');

    expect($this->patchJson('/api/v1/catalog/providers/PRV-004', catProviderBodyOf('PRV-004', ['ruc' => catProviderRow('PRV-005')->ruc])))->toBeApiError(422, 'CAT-BR-38');
    $this->patchJson('/api/v1/catalog/providers/PRV-004', catProviderBodyOf('PRV-004', ['contract_end' => '2020-01-01']))->assertStatus(422)->assertJsonValidationErrors('contract_end');
    $this->patchJson('/api/v1/catalog/providers/PRV-999', catProviderBody())->assertNotFound();
});

it('un proveedor activado queda disponible para programar salidas', function () {
    actingAsSeed('U01');
    $ref = (string) $this->postJson('/api/v1/catalog/providers', catProviderBody())->assertCreated()->json('data.ref');
    $departure = ['product_id' => idOf('catalog_products', 'CUS-HUM-FD'), 'departure_date' => '2026-11-22', 'departure_time' => '04:30', 'capacity' => 10, 'meeting_point' => 'Plaza San Francisco', 'provider_id' => catProviderRow($ref)->id];

    expect($this->postJson('/api/v1/catalog/departures', $departure, critical()))->toBeApiError(422, 'PRD-BR-007');
    $this->postJson("/api/v1/catalog/providers/{$ref}/activate")->assertOk();
    expect(collect($this->getJson('/api/v1/catalog/departures')->json('data.options.providers'))->pluck('name'))->toContain('Inka Rail Express S.A.C.');
    $this->postJson('/api/v1/catalog/departures', $departure, critical())->assertCreated();
});

it('desactivar un proveedor avisa de productos activos y bloquea sus servicios, salidas y activaciones', function () {
    actingAsSeed('U01');

    $this->postJson('/api/v1/catalog/providers/PRV-004/deactivate', [])->assertStatus(422)->assertJsonValidationErrors('reason');
    $this->postJson('/api/v1/catalog/providers/PRV-004/deactivate', ['reason' => 'Unidades sin SOAT'])
        ->assertOk()->assertJsonPath('data.warning', fn (?string $warning) => str_contains((string) $warning, 'productos activos'));

    expect(catProviderRow('PRV-004')->status)->toBe('inactivo')
        ->and(catProviderAudit(['entity' => 'Proveedor', 'entity_id' => 'PRV-004', 'action' => 'desactivar']))->toBeTrue();
    expect($this->postJson('/api/v1/catalog/departures', ['product_id' => idOf('catalog_products', 'CUS-HUM-FD'), 'departure_date' => '2026-11-22', 'departure_time' => '04:30', 'capacity' => 10, 'meeting_point' => 'Plaza', 'provider_id' => catProviderRow('PRV-004')->id], critical()))->toBeApiError(422, 'PRD-BR-007');

    $this->postJson('/api/v1/catalog/services/SRV-012/deactivate', ['reason' => 'Proveedor suspendido'])->assertOk();
    expect($this->postJson('/api/v1/catalog/services/SRV-012/activate'))->toBeApiError(409, 'PRD-BR-007');

    $lock = (int) rowOf('catalog_products', 'CUS-HUM-FD')->lock_version;
    $this->postJson('/api/v1/catalog/products/CUS-HUM-FD/deactivate', ['reason' => 'Sin transporte', 'lock_version' => $lock], critical($lock))->assertOk();
    $lock++;
    $response = $this->postJson('/api/v1/catalog/products/CUS-HUM-FD/activate', ['lock_version' => $lock], critical($lock));
    expect($response)->toBeApiError(422, 'PRD-ACT-CHECKLIST');
    expect(collect($response->json('details.failed') ?? $response->json('failed'))->pluck('key'))->toContain('provider');
});

it('agrega y quita contactos del proveedor', function () {
    actingAsSeed('U05');

    $this->postJson('/api/v1/catalog/providers/PRV-004/contacts', ['name' => 'Jo', 'email' => 'mal'])->assertStatus(422)->assertJsonValidationErrors(['name', 'email']);
    $this->postJson('/api/v1/catalog/providers/PRV-004/contacts', ['name' => 'Lucía Mamani', 'role' => 'Operaciones', 'phone' => '+51 984 000 111', 'email' => 'ops@qosqotour.pe'])
        ->assertCreated()->assertJsonPath('data.ref', 'PRV-004');

    $contacts = catProviderContacts('PRV-004');
    $id = array_search('Lucía Mamani', $contacts, true);
    expect($id)->not->toBeFalse()
        ->and(catProviderAudit(['entity' => 'Proveedor', 'entity_id' => 'PRV-004', 'action' => 'agregar_contacto']))->toBeTrue();
    $listed = collect($this->getJson('/api/v1/catalog/providers')->json('data.providers'))->firstWhere('ref', 'PRV-004');
    expect(collect($listed['contacts'])->pluck('name'))->toContain('Lucía Mamani');

    $this->deleteJson("/api/v1/catalog/providers/PRV-005/contacts/{$id}")->assertNotFound();
    $this->deleteJson("/api/v1/catalog/providers/PRV-004/contacts/{$id}")->assertOk();
    expect(catProviderContacts('PRV-004'))->not->toHaveKey($id)
        ->and(catProviderAudit(['entity' => 'Proveedor', 'entity_id' => 'PRV-004', 'action' => 'quitar_contacto']))->toBeTrue();
    $this->deleteJson("/api/v1/catalog/providers/PRV-004/contacts/{$id}")->assertNotFound();
});
