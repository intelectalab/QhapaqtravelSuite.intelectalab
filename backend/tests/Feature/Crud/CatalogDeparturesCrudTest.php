<?php

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;

function catDepAudit(array $where): bool
{
    return withinTenant(tenantA(), fn () => DB::table('audit_events')->where($where)->exists());
}

function catDepProductId(string $code): string
{
    return idOf('catalog_products', $code);
}

function catDepBody(array $overrides = []): array
{
    return [
        'product_id' => catDepProductId('CUS-HUM-FD'),
        'departure_date' => '2026-11-21',
        'departure_time' => '04:30',
        'capacity' => 12,
        'meeting_point' => 'Plaza San Francisco',
        'return_point' => 'Plaza de Armas',
        ...$overrides,
    ];
}

function catDepUpdateBody(string $ref, array $overrides = []): array
{
    $row = departureRow($ref);

    return [
        'departure_date' => $row->departure_date,
        'departure_time' => substr((string) $row->departure_time, 0, 5),
        'capacity' => (int) $row->capacity,
        'status' => in_array($row->status, ['abierta', 'cerrada', 'cancelada'], true) ? $row->status : 'abierta',
        'meeting_point' => $row->meeting_point,
        'lock_version' => (int) $row->lock_version,
        ...$overrides,
    ];
}

function catDepCheck(string $ref)
{
    return test()->postJson('/api/v1/reservations/availability-check', ['product_id' => 'CUS-HUM-FD', 'departure_id' => departureRow($ref)->id, 'adt' => 2]);
}

beforeEach(fn () => Queue::fake());

it('crea una salida abierta que aparece en el cotizador y en el sitio', function () {
    actingAsSeed('U05');

    $response = $this->postJson('/api/v1/catalog/departures', catDepBody(), critical())->assertCreated();
    $ref = (string) $response->json('data.ref');
    $row = departureRow($ref);

    expect($ref)->toStartWith('SAL-')
        ->and($row->status)->toBe('abierta')
        ->and((int) $row->sold)->toBe(0)
        ->and((int) $row->capacity)->toBe(12)
        ->and($row->departure_date)->toBe('2026-11-21')
        ->and(catDepAudit(['entity' => 'Salida', 'entity_id' => $ref, 'action' => 'crear']))->toBeTrue();

    $listed = collect($this->getJson('/api/v1/catalog/departures')->assertOk()->json('data.departures'))->firstWhere('ref', $ref);
    expect($listed['available'])->toBe(12);

    actingAsSeed('U03');
    $check = catDepCheck($ref)->assertOk()->json('data');
    expect($check['available'])->toBeTrue()->and($check['departure']['free'])->toBe(12);

    $day = collect($this->getJson('/api/v1/public/products/laguna-humantay-full-day/calendar?mes=2026-11&viajeros=2', siteOf())->assertOk()->json('data.days'))->firstWhere('date', '2026-11-21');
    expect($day['status'])->toBe('disponible');
});

it('avisa cuando el vehículo tiene menos asientos que la capacidad', function () {
    actingAsSeed('U01');
    $small = withinTenant(tenantA(), fn () => DB::table('ops_vehicles')->where('status', 'disponible')->where('capacity', '<', 12)->value('id'));

    $this->postJson('/api/v1/catalog/departures', catDepBody(['vehicle_id' => $small]), critical())
        ->assertCreated()->assertJsonPath('data.warning', fn (?string $warning) => str_contains((string) $warning, 'asientos'));
});

it('valida la salida nueva: datos, fecha pasada, recursos no disponibles y producto inactivo', function () {
    actingAsSeed('U01');
    [$vacation, $maintenance] = withinTenant(tenantA(), fn () => [
        DB::table('ops_guides')->where('status', 'vacaciones')->value('id'),
        DB::table('ops_vehicles')->where('status', 'mantenimiento')->value('id'),
    ]);

    $this->postJson('/api/v1/catalog/departures', catDepBody(['capacity' => 0, 'departure_time' => '7am']), critical())
        ->assertStatus(422)->assertJsonValidationErrors(['capacity', 'departure_time']);
    expect($this->postJson('/api/v1/catalog/departures', catDepBody(['departure_date' => '2026-09-28']), critical()))->toBeApiError(422, 'CAT-BR-20');
    expect($this->postJson('/api/v1/catalog/departures', catDepBody(['provider_id' => rowOf('catalog_providers', 'PRV-013', column: 'ref')->id]), critical()))->toBeApiError(422, 'PRD-BR-007');
    expect($this->postJson('/api/v1/catalog/departures', catDepBody(['guide_id' => $vacation]), critical()))->toBeApiError(422, 'CAT-BR-20');
    expect($this->postJson('/api/v1/catalog/departures', catDepBody(['vehicle_id' => $maintenance]), critical()))->toBeApiError(422, 'CAT-BR-20');
    expect($this->postJson('/api/v1/catalog/departures', catDepBody(), ['Accept' => 'application/json']))->toBeApiError(422, 'IDEMPOTENCY_KEY_REQUIRED');
});

it('ventas y finanzas no programan ni cambian salidas', function (string $user) {
    actingAsSeed($user);
    $row = departureRow('SAL-0403');

    expect($this->postJson('/api/v1/catalog/departures', catDepBody(), critical()))->toBeApiError(403);
    expect($this->patchJson('/api/v1/catalog/departures/SAL-0403', catDepUpdateBody('SAL-0403', ['capacity' => 30]), critical((int) $row->lock_version)))->toBeApiError(403);
    expect($this->postJson('/api/v1/catalog/departures/SAL-0403/close', ['reason' => 'Prueba']))->toBeApiError(403);
    expect($this->postJson('/api/v1/catalog/departures/SAL-0403/cancel', ['reason' => 'Prueba']))->toBeApiError(403);
    expect(departureRow('SAL-0403')->status)->toBe('abierta');
})->with(['U03', 'U07']);

it('edita la salida: capacidad nueva libera cupo y se audita', function () {
    actingAsSeed('U05');
    $row = departureRow('SAL-0403');

    $this->patchJson('/api/v1/catalog/departures/SAL-0403', catDepUpdateBody('SAL-0403', ['capacity' => 24, 'meeting_point' => 'Óvalo Pachacútec']), critical((int) $row->lock_version))
        ->assertOk()->assertJsonPath('data.ref', 'SAL-0403');

    $after = departureRow('SAL-0403');
    expect((int) $after->capacity)->toBe(24)
        ->and($after->meeting_point)->toBe('Óvalo Pachacútec')
        ->and((int) $after->lock_version)->toBe((int) $row->lock_version + 1)
        ->and(catDepAudit(['entity' => 'Salida', 'entity_id' => 'SAL-0403', 'action' => 'modificar']))->toBeTrue();
    actingAsSeed('U03');
    expect(catDepCheck('SAL-0403')->assertOk()->json('data.departure.free'))->toBe(24 - (int) $row->sold);
});

it('bajar la capacidad al vendido marca la salida completa y no se puede bajar de lo vendido y retenido', function () {
    actingAsSeed('U01');
    $row = departureRow('SAL-0404');
    $sold = (int) $row->sold;

    expect($this->patchJson('/api/v1/catalog/departures/SAL-0404', catDepUpdateBody('SAL-0404', ['capacity' => $sold - 1]), critical((int) $row->lock_version)))->toBeApiError(422, 'CAT-BR-20');

    $this->patchJson('/api/v1/catalog/departures/SAL-0404', catDepUpdateBody('SAL-0404', ['capacity' => $sold]), critical((int) $row->lock_version))->assertOk();
    expect(departureRow('SAL-0404')->status)->toBe('completa');

    $held = departureRow('SAL-0403');
    expect($this->patchJson('/api/v1/catalog/departures/SAL-0403', catDepUpdateBody('SAL-0403', ['capacity' => (int) $held->sold]), critical((int) $held->lock_version)))->toBeApiError(422, 'CAT-BR-20');
});

it('rechaza la edición con versión vieja, sin versión o con fecha pasada', function () {
    actingAsSeed('U01');
    $row = departureRow('SAL-0403');

    expect($this->patchJson('/api/v1/catalog/departures/SAL-0403', catDepUpdateBody('SAL-0403', ['capacity' => 22, 'lock_version' => (int) $row->lock_version + 3]), critical((int) $row->lock_version + 3)))->toBeApiError(409, 'STALE_VERSION');
    $body = catDepUpdateBody('SAL-0403');
    unset($body['lock_version']);
    expect($this->patchJson('/api/v1/catalog/departures/SAL-0403', $body, ['Accept' => 'application/json']))->toBeApiError(428, 'IF_MATCH_REQUIRED');
    expect($this->patchJson('/api/v1/catalog/departures/SAL-0403', catDepUpdateBody('SAL-0403', ['departure_date' => '2026-09-01']), critical((int) $row->lock_version)))->toBeApiError(422, 'CAT-BR-20');
    expect((int) departureRow('SAL-0403')->capacity)->toBe((int) $row->capacity);
});

it('cerrar la salida impide reservarla, bloquearla y venderla en el sitio', function () {
    actingAsSeed('U03');
    catDepCheck('SAL-0403')->assertOk();
    actingAsSeed('U05');

    $this->postJson('/api/v1/catalog/departures/SAL-0403/close', [])->assertStatus(422)->assertJsonValidationErrors('reason');
    $this->postJson('/api/v1/catalog/departures/SAL-0403/close', ['reason' => 'Huaico en la vía'])->assertOk()->assertJsonPath('data.ref', 'SAL-0403');

    $row = departureRow('SAL-0403');
    expect($row->status)->toBe('cerrada')
        ->and($row->notes)->toContain('Cerrada: Huaico en la vía')
        ->and(catDepAudit(['entity' => 'Salida', 'entity_id' => 'SAL-0403', 'action' => 'cerrar']))->toBeTrue();
    expect($this->postJson('/api/v1/catalog/holds', ['departure_id' => $row->id, 'quantity' => 1, 'reference' => 'COT-PRUEBA'], critical()))->toBeApiError(422, 'CAT-BR-21');
    actingAsSeed('U03');
    expect(catDepCheck('SAL-0403'))->toBeApiError(422, 'RES-BR-06');
    expect($this->postJson('/api/v1/public/price-quote', ['product' => 'laguna-humantay-full-day', 'date' => '2026-10-02', 'adults' => 2], siteOf()))->toBeApiError(422, 'SIT-BR-05');
    expect(collect($this->getJson('/api/v1/catalog/departures')->json('data.departures'))->firstWhere('ref', 'SAL-0403')['available'])->toBe(0);
});

it('cancelar una salida con vendidos avisa a operaciones y ya no se puede cerrar', function () {
    actingAsSeed('U01');

    $this->postJson('/api/v1/catalog/departures/SAL-0404/cancel', ['reason' => 'Paro regional'])
        ->assertOk()->assertJsonPath('data.warning', fn (?string $warning) => str_contains((string) $warning, '2 pasajeros'));

    expect(departureRow('SAL-0404')->status)->toBe('cancelada')
        ->and(catDepAudit(['entity' => 'Salida', 'entity_id' => 'SAL-0404', 'action' => 'cancelar']))->toBeTrue();
    $this->postJson('/api/v1/catalog/departures/SAL-0404/cancel', ['reason' => 'Otra vez'])->assertOk()->assertJsonPath('data.warning', null);
    expect($this->postJson('/api/v1/catalog/departures/SAL-0404/close', ['reason' => 'Cerrar']))->toBeApiError(409, 'CAT-BR-20');
    expect(catDepCheck('SAL-0404'))->toBeApiError(422, 'RES-BR-06');
    $this->postJson('/api/v1/catalog/departures/SAL-9999/cancel', ['reason' => 'No existe'])->assertNotFound();
});
