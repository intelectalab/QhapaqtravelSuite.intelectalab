<?php

use Illuminate\Support\Facades\Queue;

beforeEach(function () {
    Queue::fake();
    freezeBusinessToday();
});

it('paso 1 de la reserva directa exige un cliente de la cartera y un responsable activo', function () {
    actingAsSeed('U03');
    detachFromPortfolio('CLI-0001', 'U03');

    $this->postJson('/api/v1/reservations/availability-check', ['step' => 1])
        ->assertStatus(422)->assertJsonValidationErrors('client_id');
    expect($this->postJson('/api/v1/reservations/availability-check', ['step' => 1, 'client_id' => 'CLI-0001']))->toBeApiError(422, 'RES-BR-04');
    $this->postJson('/api/v1/reservations/availability-check', ['step' => 1, 'client_id' => 'CLI-0003', 'channel' => 'Directo'])
        ->assertOk()->assertJsonPath('data.ready', true);

    actingAsSeed('U01');
    expect($this->postJson('/api/v1/reservations/availability-check', ['step' => 1, 'client_id' => 'CLI-0003', 'owner_id' => '00000000-0000-7000-8000-000000000000']))->toBeApiError(422, 'VALIDATION_ERROR');
});

it('paso 2 exige producto, salida o fecha y pasajeros, y devuelve el precio', function () {
    actingAsSeed('U01');
    $base = ['step' => 2, 'client_id' => 'CLI-0003', 'product_id' => 'CUS-HUM-FD', 'adt' => 2];

    $this->postJson('/api/v1/reservations/availability-check', [...$base, 'product_id' => null])
        ->assertStatus(422)->assertJsonValidationErrors('product_id');
    expect($this->postJson('/api/v1/reservations/availability-check', $base))->toBeApiError(422, 'RES-BR-06');
    expect($this->postJson('/api/v1/reservations/availability-check', [...$base, 'client_id' => 'CLI-9999', 'departure_id' => departureRow('SAL-0403')->id]))->toBeApiError(422, 'RES-BR-04');

    $plan = $this->postJson('/api/v1/reservations/availability-check', [...$base, 'departure_id' => departureRow('SAL-0403')->id])->assertOk()->json('data');
    expect($plan['priced'])->toBeTrue()
        ->and($plan['available'])->toBeTrue()
        ->and($plan['total'])->toBe(bcmul($plan['adult_price'], '2', 2));
});
