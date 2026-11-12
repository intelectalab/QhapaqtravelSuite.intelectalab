<?php

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;

function directBody(array $overrides = []): array
{
    return [
        'client_id' => 'CLI-0003',
        'product_id' => 'CUS-HUM-FD',
        'departure_id' => departureRow('SAL-0403')->id,
        'adt' => 2,
        'chd' => 0,
        'inf' => 1,
        'confirm' => true,
        ...$overrides,
    ];
}

beforeEach(function () {
    Queue::fake();
    freezeBusinessToday();
});

it('reservationsAvailabilityCheck lista las salidas y calcula el precio sin IGV', function () {
    actingAsSeed('U01');

    $open = $this->postJson('/api/v1/reservations/availability-check', ['product_id' => 'CUS-HUM-FD', 'adt' => 2])->assertOk()->json('data');
    expect($open['priced'])->toBeFalse()
        ->and(collect($open['departures'])->pluck('ref'))->toContain('SAL-0403');

    $priced = $this->postJson('/api/v1/reservations/availability-check', directBody(['client_id' => null]))->assertOk()->json('data');
    expect($priced['priced'])->toBeTrue()
        ->and($priced['available'])->toBeTrue()
        ->and($priced['departure']['free'])->toBe(13)
        ->and($priced['total'])->toBe(bcmul($priced['adult_price'], '2', 2))
        ->and($priced['travel_to'])->toBe($priced['travel_from']);
});

it('valida producto activo, anticipación mínima y al menos un pasajero que pague', function () {
    actingAsSeed('U01');

    expect($this->postJson('/api/v1/reservations/availability-check', ['product_id' => 'CUS-VIN-FD', 'adt' => 2]))->toBeApiError(422, 'PRD-BR-002');
    expect($this->postJson('/api/v1/reservations/availability-check', ['product_id' => 'ICA-PAR-FD', 'adt' => 2, 'date' => '2026-09-30']))->toBeApiError(422, 'RES-BR-06');
    expect($this->postJson('/api/v1/reservations/availability-check', ['product_id' => 'CUS-HUM-FD', 'adt' => 0, 'inf' => 1]))->toBeApiError(422, 'RES-BR-04');
});

it('createReservations confirma, retiene cupo, crea pasajeros y cuotas 40/60', function () {
    actingAsSeed('U01');
    $sold = (int) departureRow('SAL-0403')->sold;

    $response = $this->postJson('/api/v1/reservations', directBody(), critical())->assertCreated()->assertJsonPath('data.status', 'confirmada');
    $code = (string) $response->json('data.code');
    $id = reservationRow($code)->id;
    [$passengers, $receivables, $services] = withinTenant(tenantA(), fn () => [
        DB::table('booking_passengers')->where('reservation_id', $id)->count(),
        DB::table('fin_receivables')->where('reservation_id', $id)->orderBy('kind')->pluck('kind')->all(),
        DB::table('booking_reservation_services')->where('reservation_id', $id)->sum('price_amount'),
    ]);

    expect((int) departureRow('SAL-0403')->sold)->toBe($sold + 2)
        ->and($passengers)->toBe(3)
        ->and($receivables)->toBe(['anticipo', 'saldo'])
        ->and(bcadd((string) $services, '0', 2))->toBe($response->json('data.total_amount'))
        ->and($response->json('data.channel'))->toBe('Directo')
        ->and($response->json('data.quote_id'))->toBeNull();
    expect($this->postJson('/api/v1/reservations', directBody(), ['Accept' => 'application/json']))->toBeApiError(422);
});

it('sin cupo: confirmar responde 409 y el borrador queda pendiente de disponibilidad sin retener', function () {
    actingAsSeed('U01');
    $full = ['departure_id' => departureRow('SAL-0402')->id];

    expect($this->postJson('/api/v1/reservations', directBody($full), critical()))->toBeApiError(409, 'RES-BR-05');
    $this->postJson('/api/v1/reservations', directBody([...$full, 'confirm' => false]), critical())
        ->assertCreated()->assertJsonPath('data.status', 'pendiente_disponibilidad');

    expect((int) departureRow('SAL-0402')->sold)->toBe(20);
});

it('el borrador con cupo retiene la salida', function () {
    actingAsSeed('U01');
    $sold = (int) departureRow('SAL-0404')->sold;

    $this->postJson('/api/v1/reservations', directBody(['departure_id' => departureRow('SAL-0404')->id, 'confirm' => false]), critical())
        ->assertCreated()->assertJsonPath('data.status', 'borrador');

    expect((int) departureRow('SAL-0404')->sold)->toBe($sold + 2);
});

it('Ventas reserva solo para clientes de su cartera y queda como responsable', function () {
    actingAsSeed('U03');
    detachFromPortfolio('CLI-0001', 'U03');

    expect($this->postJson('/api/v1/reservations', directBody(['client_id' => 'CLI-0001']), critical()))->toBeApiError(422, 'RES-BR-04');
    $this->postJson('/api/v1/reservations', directBody(['owner_id' => seedUser('U04')->id]), critical())
        ->assertCreated()->assertJsonPath('data.owner_id', seedUser('U03')->id);
});

it('cobra la tarifa de niño y respeta la moneda de la tarifa', function () {
    actingAsSeed('U01');
    $departure = withinTenant(tenantA(), fn () => DB::table('catalog_product_departures as d')->join('catalog_products as p', 'p.id', '=', 'd.product_id')
        ->where('p.code', 'CUS-MAPI-FD')->where('d.departure_date', '>=', '2026-10-05')->whereRaw('d.capacity - d.sold >= 3')->orderBy('d.departure_date')->value('d.id'));

    $plan = $this->postJson('/api/v1/reservations/availability-check', ['product_id' => 'CUS-MAPI-FD', 'departure_id' => $departure, 'adt' => 2, 'chd' => 1])->assertOk()->json('data');

    expect($plan['currency'])->toBe('USD')
        ->and($plan['child_price'])->not->toBeNull()
        ->and($plan['total'])->toBe(bcadd(bcmul($plan['adult_price'], '2', 2), $plan['child_price'], 2));
});

it('reservations/form-options solo ofrece productos reservables', function () {
    actingAsSeed('U03');
    detachFromPortfolio('CLI-0001', 'U03');

    $data = $this->getJson('/api/v1/reservations/form-options')->assertOk()->json('data');
    $codes = collect($data['products'])->pluck('code');

    expect($codes)->toContain('CUS-HUM-FD')
        ->and($codes)->not->toContain('CUS-VIN-FD')
        ->and($data['advisors'])->toBe([])
        ->and(collect($data['clients'])->pluck('code'))->not->toContain('CLI-0001');
    actingAsSeed('U05');
    expect($this->getJson('/api/v1/reservations/form-options'))->toBeApiError(403);
});
