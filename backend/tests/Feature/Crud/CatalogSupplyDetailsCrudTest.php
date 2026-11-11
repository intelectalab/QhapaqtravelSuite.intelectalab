<?php

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;

function supplyAudit(array $where): bool
{
    return withinTenant(tenantA(), fn () => DB::table('audit_events')->where($where)->exists());
}

function supplyProvider(string $ref): object
{
    return rowOf('catalog_providers', $ref, column: 'ref');
}

beforeEach(function () {
    lockCatalogProducts();
    Queue::fake();
});

it('la ficha del servicio trae proveedor, productos, historial y respeta el costo por rol', function () {
    actingAsSeed('U01');

    $service = $this->getJson('/api/v1/catalog/services/SRV-012')->assertOk();

    expect($service->json('data.service.ref'))->toBe('SRV-012')
        ->and($service->json('data.provider.ref'))->not->toBeEmpty()
        ->and($service->json('data.service.cost'))->not->toBeNull()
        ->and($service->json('data.history'))->toBeArray()
        ->and($service->json('data.usage'))->toBeArray();

    actingAsSeed('U03');
    $sales = $this->getJson('/api/v1/catalog/services/SRV-012')->assertOk();
    expect($sales->json('data.service.cost'))->toBeNull()
        ->and($sales->json('data.history'))->toBeNull()
        ->and($sales->json('data.cost_history'))->toBe([]);
    $this->getJson('/api/v1/catalog/services/SRV-999')->assertNotFound();
});

it('la ficha del proveedor trae servicios, productos, reservas y cuentas por pagar según permiso', function () {
    actingAsSeed('U01');

    $provider = $this->getJson('/api/v1/catalog/providers/PRV-004')->assertOk();

    expect($provider->json('data.provider.ref'))->toBe('PRV-004')
        ->and($provider->json('data.services'))->not->toBeEmpty()
        ->and($provider->json('data.reservations'))->not->toBeEmpty()
        ->and($provider->json('data.payables'))->not->toBeEmpty()
        ->and(collect($provider->json('data.products'))->pluck('role')->unique()->all())->not->toBeEmpty()
        ->and($provider->json('data.history'))->toBeArray();
    $this->getJson('/api/v1/catalog/providers/PRV-999')->assertNotFound();
});

it('renueva el contrato y califica al proveedor con auditoría', function () {
    actingAsSeed('U05');
    $before = supplyProvider('PRV-004');
    $end = date('Y-m-d', strtotime("{$before->contract_end} +1 year"));

    $this->postJson('/api/v1/catalog/providers/PRV-004/renew-contract', ['contract_end' => $end, 'payment_terms' => 'Crédito 45 días'])->assertOk();
    expect(supplyProvider('PRV-004')->contract_end)->toBe($end)
        ->and(supplyProvider('PRV-004')->payment_terms)->toBe('Crédito 45 días')
        ->and(supplyAudit(['entity' => 'Proveedor', 'entity_id' => 'PRV-004', 'action' => 'renovar_contrato']))->toBeTrue();
    expect($this->postJson('/api/v1/catalog/providers/PRV-004/renew-contract', ['contract_end' => $before->contract_end]))->toBeApiError(422, 'CAT-BR-38');

    $this->postJson('/api/v1/catalog/providers/PRV-004/rating', ['rating' => 4.5, 'note' => 'Puntual en temporada alta'])->assertOk();
    expect((float) supplyProvider('PRV-004')->rating)->toBe(4.5)
        ->and(supplyAudit(['entity' => 'Proveedor', 'entity_id' => 'PRV-004', 'action' => 'calificar']))->toBeTrue();
    $this->postJson('/api/v1/catalog/providers/PRV-004/rating', ['rating' => 7])->assertStatus(422)->assertJsonValidationErrors(['rating']);
});

it('ventas y finanzas no renuevan ni califican proveedores', function (string $user) {
    actingAsSeed($user);

    expect($this->postJson('/api/v1/catalog/providers/PRV-004/renew-contract', ['contract_end' => '2030-12-31']))->toBeApiError(403);
    expect($this->postJson('/api/v1/catalog/providers/PRV-004/rating', ['rating' => 1]))->toBeApiError(403);
})->with(['U03', 'U07']);

it('la venta directa suma lo vendido, deja el registro confirmado y valida versión y cupo', function () {
    actingAsSeed('U05');
    $departure = departureRow('SAL-0405');

    $response = $this->postJson('/api/v1/catalog/departures/SAL-0405/confirm-seats', ['quantity' => 2, 'reference' => 'RES-2026-00042', 'lock_version' => $departure->lock_version], critical())->assertOk();
    $hold = rowOf('catalog_availability_holds', (string) $response->json('data.hold'), column: 'ref');

    expect((int) departureRow('SAL-0405')->sold)->toBe((int) $departure->sold + 2)
        ->and($hold->status)->toBe('confirmada')
        ->and((int) $hold->quantity)->toBe(2)
        ->and(supplyAudit(['entity' => 'Salida', 'entity_id' => 'SAL-0405', 'action' => 'confirmar_cupos']))->toBeTrue();
    expect($this->postJson('/api/v1/catalog/departures/SAL-0405/confirm-seats', ['quantity' => 1, 'reference' => 'RES-2026-00042', 'lock_version' => $departure->lock_version], critical()))->toBeApiError(409, 'STALE_VERSION');
    expect($this->postJson('/api/v1/catalog/departures/SAL-0405/confirm-seats', ['quantity' => 60, 'reference' => 'RES-2026-00042', 'lock_version' => departureRow('SAL-0405')->lock_version], critical()))->toBeApiError(422, 'PRD-BR-012');
    expect($this->postJson('/api/v1/catalog/departures/SAL-0402/confirm-seats', ['quantity' => 1, 'reference' => 'RES-2026-00042', 'lock_version' => departureRow('SAL-0402')->lock_version], critical()))->toBeApiError(422, 'CAT-BR-21');
    $this->postJson('/api/v1/catalog/departures/SAL-0405/confirm-seats', ['quantity' => 0], critical())->assertStatus(422)->assertJsonValidationErrors(['quantity', 'reference']);
});

it('ventas y finanzas no venden cupos directo', function (string $user) {
    actingAsSeed($user);
    $departure = departureRow('SAL-0405');

    expect($this->postJson('/api/v1/catalog/departures/SAL-0405/confirm-seats', ['quantity' => 1, 'reference' => 'RES-2026-00042', 'lock_version' => $departure->lock_version], critical()))->toBeApiError(403);
    expect((int) departureRow('SAL-0405')->sold)->toBe((int) $departure->sold);
})->with(['U03', 'U07']);
