<?php

use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Queue;

beforeEach(function () {
    lockSeededBookings();
    Queue::fake();
    freezeBusinessToday();
});

function passengerBody(array $overrides = []): array
{
    return ['full_name' => 'Ana Torres Quispe', 'pax_type' => 'ADT', 'doc_type' => 'DNI', 'doc_number' => '45879632', 'nationality' => 'Peruana', 'birth_date' => '1990-04-12', ...$overrides];
}

it('RES-BR-09: documento, nacionalidad y nacimiento del pasajero son obligatorios', function () {
    actingAsSeed('U01');

    $this->postJson('/api/v1/reservations/RES-2026-000349/passengers', passengerBody(['doc_number' => null, 'nationality' => '', 'birth_date' => null]), critical(reservationLock('RES-2026-000349')))
        ->assertStatus(422)->assertJsonValidationErrors(['doc_number', 'nationality', 'birth_date']);
});

it('RES-V21-04: avisa sin bloquear cuando la edad a la fecha del viaje no corresponde al tipo', function () {
    actingAsSeed('U01');
    $travel = reservationRow('RES-2026-000349')->travel_from;
    $birth = CarbonImmutable::parse($travel)->subYears(7)->toDateString();

    $saved = $this->postJson('/api/v1/reservations/RES-2026-000349/passengers', passengerBody(['full_name' => 'Mateo Torres', 'birth_date' => $birth]), critical(reservationLock('RES-2026-000349')))
        ->assertCreated()->json('data');
    expect($saved['age'])->toBe(7)->and($saved['warning'])->toContain('Con 7 años')->toContain('registrado como adulto');

    $ok = $this->postJson('/api/v1/reservations/RES-2026-000349/passengers', passengerBody(['full_name' => 'Lucía Torres']), critical(reservationLock('RES-2026-000349')))
        ->assertCreated()->json('data');
    expect($ok['warning'])->toBeNull();

    $listed = collect($this->getJson('/api/v1/reservations/RES-2026-000349')->assertOk()->json('data.passengers'))->firstWhere('full_name', 'Mateo Torres');
    expect($listed['age_warning'])->toBe($saved['warning']);
});
