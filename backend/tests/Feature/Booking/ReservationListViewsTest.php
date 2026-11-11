<?php

use Illuminate\Support\Facades\Queue;

beforeEach(function () {
    Queue::fake();
    freezeBusinessToday();
});

it('V9 / 04 §2: la ocupación por fecha suma pasajeros por día, los próximos 14 días y las salidas con cupo', function () {
    actingAsSeed('U01');

    $data = $this->getJson('/api/v1/reservations/occupancy?month=2026-10')->assertOk()->json('data');
    expect($data['month'])->toBe('2026-10')
        ->and($data['days'])->toHaveCount(31)
        ->and($data['next'])->toHaveCount(14)
        ->and(collect($data['days'])->sum('pax'))->toBeGreaterThan(0)
        ->and($data['departures'])->toBeArray();

    $this->getJson('/api/v1/reservations/occupancy?month=octubre')->assertStatus(422);
    $this->getJson('/api/v1/reservations/RES-2026-000348')->assertOk();
});

it('V9: Ventas solo cuenta los pasajeros de su cartera en la ocupación', function () {
    actingAsSeed('U01');
    $all = collect($this->getJson('/api/v1/reservations/occupancy?month=2026-10')->json('data.days'))->sum('reservations');

    actingAsSeed('U03');
    $own = collect($this->getJson('/api/v1/reservations/occupancy?month=2026-10')->json('data.days'))->sum('reservations');
    expect($own)->toBeLessThan($all);
});

it('V10: la fila de la lista trae servicios confirmados de requeridos, costo de proveedores para quien lo ve, origen y anulación pedida', function () {
    actingAsSeed('U05');
    $row = collect($this->getJson('/api/v1/reservations?limit=50')->assertOk()->json('data'))->firstWhere('code', 'RES-2026-000348');

    expect($row['services']['total'])->toBeGreaterThan(0)
        ->and($row['services']['confirmed'])->toBeLessThanOrEqual($row['services']['total'])
        ->and($row)->toHaveKey('supplier_cost_pen')
        ->and($row)->not->toHaveKey('total')
        ->and($row['origin'])->toHaveKeys(['kind', 'label'])
        ->and($row['cancel_requested'])->toBeBool();
});

it('V5: la lista de cotizaciones trae el estado de la aprobación interna y el contador de Gerencia', function () {
    actingAsSeed('U02');
    $list = $this->getJson('/api/v1/quotes?limit=50')->assertOk()->json();

    expect($list['meta']['kpis'])->toHaveKeys(['pending_internal', 'followup_pen'])
        ->and(collect($list['data'])->first())->toHaveKeys(['internal_status', 'version_count']);

    actingAsSeed('U03');
    expect($this->getJson('/api/v1/quotes')->json('meta.kpis.pending_internal'))->toBeNull();
});
