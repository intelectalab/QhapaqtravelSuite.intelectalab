<?php

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;

function ctrCatAudit(array $where): bool
{
    return withinTenant(tenantA(), fn () => DB::table('audit_events')->where($where)->exists());
}

function ctrCatDepartureBody(string $ref, array $overrides = []): array
{
    $row = departureRow($ref);

    return [
        'departure_date' => $row->departure_date,
        'departure_time' => substr((string) $row->departure_time, 0, 5),
        'capacity' => (int) $row->capacity,
        'status' => 'abierta',
        'meeting_point' => $row->meeting_point,
        ...$overrides,
    ];
}

beforeEach(function () {
    lockCatalogProducts();
    Queue::fake();
});

it('GET /catalog/departures/{id} devuelve la salida con sus holds', function () {
    actingAsSeed('U05');
    $hold = withinTenant(tenantA(), fn () => DB::table('catalog_availability_holds as h')->join('catalog_product_departures as d', 'd.id', '=', 'h.departure_id')->first(['d.ref', 'h.ref as hold']));

    $data = $this->getJson("/api/v1/catalog/departures/{$hold->ref}")->assertOk()->json('data');

    expect($data['ref'])->toBe($hold->ref)
        ->and($data['available'])->toBe(max(0, $data['capacity'] - $data['sold'] - $data['held']))
        ->and(collect($data['holds'])->pluck('ref'))->toContain($hold->hold);

    $this->getJson('/api/v1/catalog/departures/'.departureRow($hold->ref)->id)->assertOk()->assertJsonPath('data.ref', $hold->ref);
    expect($this->getJson('/api/v1/catalog/departures/SAL-9999'))->toBeApiError(404);
});

it('GET /catalog/holds lista los holds paginados por cursor y filtra por estado', function () {
    actingAsSeed('U05');

    $response = $this->getJson('/api/v1/catalog/holds?filter[status]=hold&page[size]=2')->assertOk();

    expect(collect($response->json('data'))->pluck('status')->unique()->all())->toBe(['hold'])
        ->and($response->json('meta.per_page'))->toBe(2)
        ->and($response->json('links.first'))->toContain('/api/v1/catalog/holds');
    expect($this->getJson('/api/v1/catalog/holds?sort=desconocido'))->toBeApiError(422, 'SORT_INVALID');
});

it('GET /catalog/products/{id}/departures lista solo las salidas del producto', function () {
    actingAsSeed('U03');

    $data = $this->getJson('/api/v1/catalog/products/CUS-MAPI-FD/departures?filter[status]=abierta&page[size]=100')->assertOk()->json('data');

    expect($data)->not->toBeEmpty()
        ->and(collect($data)->pluck('product.code')->unique()->all())->toBe(['CUS-MAPI-FD'])
        ->and(collect($data)->pluck('status')->unique()->all())->toBe(['abierta']);
    expect($this->getJson('/api/v1/catalog/products/NO-EXISTE/departures'))->toBeApiError(404);
});

it('POST /catalog/products/{id}/departures crea la salida del producto y la audita', function () {
    actingAsSeed('U05');

    $response = $this->postJson('/api/v1/catalog/products/CUS-HUM-FD/departures', [
        'departure_date' => '2026-11-22',
        'departure_time' => '04:30',
        'capacity' => 12,
        'meeting_point' => 'Plaza San Francisco',
    ], critical())->assertCreated();

    $ref = (string) $response->json('data.ref');
    expect($response->json('data.product.code'))->toBe('CUS-HUM-FD')
        ->and($response->json('data.capacity'))->toBe(12)
        ->and(ctrCatAudit(['entity' => 'Salida', 'entity_id' => $ref, 'action' => 'crear']))->toBeTrue();
});

it('POST /catalog/products/{id}/departures exige manage_availability', function () {
    actingAsSeed('U03');

    $response = $this->postJson('/api/v1/catalog/products/CUS-HUM-FD/departures', ['departure_date' => '2026-11-22', 'departure_time' => '04:30', 'capacity' => 12, 'meeting_point' => 'Plaza'], critical());

    expect($response)->toBeApiError(403)
        ->and($response->json('required_permissions'))->toContain('catalog.products.manage_availability');
});

it('PATCH /catalog/products/{id}/departures/{departureId} edita con If-Match y rechaza otra versión', function () {
    actingAsSeed('U05');
    $version = (int) departureRow('SAL-0105')->lock_version;

    expect($this->patchJson('/api/v1/catalog/products/CUS-MAPI-FD/departures/SAL-0105', ctrCatDepartureBody('SAL-0105', ['capacity' => 18]), ['Accept' => 'application/json']))->toBeApiError(428, 'IF_MATCH_REQUIRED');

    $this->patchJson('/api/v1/catalog/products/CUS-MAPI-FD/departures/SAL-0105', ctrCatDepartureBody('SAL-0105', ['capacity' => 18]), critical($version))
        ->assertOk()->assertJsonPath('data.capacity', 18);

    expect(departureRow('SAL-0105')->lock_version)->toBe($version + 1)
        ->and(ctrCatAudit(['entity' => 'Salida', 'entity_id' => 'SAL-0105', 'action' => 'modificar']))->toBeTrue()
        ->and($this->patchJson('/api/v1/catalog/products/CUS-MAPI-FD/departures/SAL-0105', ctrCatDepartureBody('SAL-0105'), critical($version)))->toBeApiError(409, 'STALE_VERSION')
        ->and($this->patchJson('/api/v1/catalog/products/CUS-HUM-FD/departures/SAL-0105', ctrCatDepartureBody('SAL-0105'), critical($version + 1)))->toBeApiError(404);
});

it('GET /catalog/products/{id}/availability da días con vendidos, holds y rango', function () {
    actingAsSeed('U05');

    $data = $this->getJson('/api/v1/catalog/products/CUS-MAPI-FD/availability?from=2026-10-14&to=2026-10-17&seats=2')->assertOk()->json('data');
    $days = collect($data['days'])->keyBy('date');

    expect($days)->toHaveCount(4)
        ->and($days['2026-10-14']['sold'])->toBe((int) departureRow('SAL-0109')->sold)
        ->and($days['2026-10-15']['range']['code'])->toBe('RG-0102')
        ->and($data['model'])->not->toBeNull()
        ->and($this->getJson('/api/v1/catalog/products/CUS-MAPI-FD/availability?from=2026-10-01&to=2027-03-01'))->toBeApiError(422);
});

it('GET /catalog/products/{id}/availability-ranges lista los rangos del producto', function () {
    actingAsSeed('U03');

    $codes = collect($this->getJson('/api/v1/catalog/products/CUS-MAPI-FD/availability-ranges')->assertOk()->json('data'))->pluck('code')->all();

    expect($codes)->toBe(['RG-0101', 'RG-0102', 'RG-0103'])
        ->and(collect($this->getJson('/api/v1/catalog/products/CUS-MAPI-FD/availability-ranges?filter[status]=cerrado')->json('data'))->pluck('code')->all())->toBe(['RG-0102']);
});

it('POST /availability-ranges/close-dates agrupa fechas contiguas en rangos y los audita', function () {
    actingAsSeed('U05');

    $data = $this->postJson('/api/v1/catalog/products/CUS-HUM-FD/availability-ranges/close-dates', [
        'dates' => ['2026-11-04', '2026-11-03', '2026-11-06'],
        'status' => 'cerrado',
        'note' => 'Mantenimiento del camino',
        'confirm_sales' => true,
    ], critical())->assertCreated()->json('data');

    expect(collect($data['ranges'])->map(fn ($r) => [$r['date_from'], $r['date_to']])->all())->toBe([['2026-11-03', '2026-11-04'], ['2026-11-06', '2026-11-06']])
        ->and($data['dates'])->toBe(3)
        ->and(ctrCatAudit(['entity' => 'Disponibilidad', 'entity_id' => $data['ranges'][0]['code'], 'action' => 'crear']))->toBeTrue();
});

it('POST /availability-ranges/close-dates pide confirmar cuando hay ventas en esas fechas', function () {
    $sale = withinTenant(tenantA(), fn () => DB::table('booking_reservation_services as s')->join('booking_reservations as r', 'r.id', '=', 's.reservation_id')->join('catalog_products as p', 'p.id', '=', 's.product_id')
        ->where('s.status', '<>', 'cancelado')->whereNotIn('r.status', ['borrador', 'cancelada'])->whereNull('r.deleted_at')->where('s.service_date', '>=', BUSINESS_TODAY)
        ->whereNotExists(fn ($q) => $q->from('catalog_availability_ranges as g')->whereColumn('g.product_id', 's.product_id')->whereNull('g.deleted_at')->where('g.status', '<>', 'disponible')->whereColumn('g.date_from', '<=', 's.service_date')->whereColumn('g.date_to', '>=', 's.service_date'))
        ->orderBy('s.service_date')->first(['p.code', 's.service_date']));
    expect($sale)->not->toBeNull();
    actingAsSeed('U05');
    $body = ['dates' => [substr((string) $sale->service_date, 0, 10)], 'status' => 'agotado'];

    $blocked = $this->postJson("/api/v1/catalog/products/{$sale->code}/availability-ranges/close-dates", $body, critical());

    expect($blocked)->toBeApiError(409, 'CAT-AV-04')
        ->and($blocked->json('details.affected_dates') ?? $blocked->json('affected_dates'))->toContain($body['dates'][0]);

    $this->postJson("/api/v1/catalog/products/{$sale->code}/availability-ranges/close-dates", [...$body, 'confirm_sales' => true], critical())
        ->assertCreated()->assertJsonPath('data.affected_sales.0', $body['dates'][0]);
});

it('POST /availability-ranges/close-dates rechaza fechas pasadas y exige el permiso', function () {
    actingAsSeed('U05');
    expect($this->postJson('/api/v1/catalog/products/CUS-HUM-FD/availability-ranges/close-dates', ['dates' => ['2026-01-10'], 'status' => 'cerrado'], critical()))->toBeApiError(422, 'CAT-AV-05');

    actingAsSeed('U03');
    $denied = $this->postJson('/api/v1/catalog/products/CUS-HUM-FD/availability-ranges/close-dates', ['dates' => ['2026-11-10'], 'status' => 'cerrado'], critical());
    expect($denied)->toBeApiError(403)
        ->and($denied->json('required_permissions'))->toContain('catalog.products.manage_availability');
});

it('GET /catalog/destinations/{id} trae ancestros, hijos y productos de los subdestinos', function () {
    actingAsSeed('U03');

    $data = $this->getJson('/api/v1/catalog/destinations/D18')->assertOk()->json('data');

    expect($data['ref'])->toBe('D18')
        ->and(collect($data['ancestors'])->pluck('ref')->all())->toBe(['D01'])
        ->and(collect($data['children'])->pluck('ref'))->toContain('D19')
        ->and($data)->toHaveKey('products');
    expect($this->getJson('/api/v1/catalog/destinations/D999'))->toBeApiError(404);
});

it('GET /reservations/{id}/travel-docs/gate indica si la emisión de Machu Picchu está bloqueada', function () {
    actingAsSeed('U05');

    $data = $this->getJson('/api/v1/reservations/RES-2026-000348/travel-docs/gate')->assertOk()->json('data');

    expect($data['code'])->toBe('RES-2026-000348')
        ->and($data['applies'])->toBeTrue()
        ->and($data['blocked'])->toBe($data['missing'] !== [])
        ->and($data['services'])->not->toBeEmpty();
    expect($this->getJson('/api/v1/reservations/RES-0000-000000/travel-docs/gate'))->toBeApiError(404);
});
