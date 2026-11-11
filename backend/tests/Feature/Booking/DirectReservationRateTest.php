<?php

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;

beforeEach(function () {
    lockSeededBookings();
    Queue::fake();
    freezeBusinessToday();
});

it('la reserva directa propone la tarifa del canal y deja elegir otra vigente (04 §4.7)', function () {
    actingAsSeed('U01');
    $base = ['step' => 2, 'client_id' => 'CLI-0003', 'product_id' => 'CUS-HUM-FD', 'adt' => 2, 'departure_id' => departureRow('SAL-0403')->id];

    $suggested = $this->postJson('/api/v1/reservations/availability-check', $base)->assertOk()->json('data');
    expect($suggested['rate_ref'])->toBe('TAR-031')
        ->and(collect($suggested['rates'])->pluck('ref'))->toContain('TAR-032')
        ->and(collect($suggested['rates'])->pluck('segment'))->not->toContain('Niño');

    $b2b = withinTenant(tenantA(), fn () => DB::table('catalog_rates')->where('ref', 'TAR-032')->value('id'));
    $chosen = $this->postJson('/api/v1/reservations/availability-check', [...$base, 'rate_id' => $b2b])->assertOk()->json('data');
    expect($chosen['rate_ref'])->toBe('TAR-032')
        ->and((float) $chosen['adult_price'])->toBeLessThan((float) $suggested['adult_price']);

    $foreign = withinTenant(tenantA(), fn () => DB::table('catalog_rates')->where('ref', 'TAR-001')->value('id'));
    expect($this->postJson('/api/v1/reservations/availability-check', [...$base, 'rate_id' => $foreign]))->toBeApiError(422, 'PRD-BR-005');
});

it('la reserva directa guarda la tarifa usada en la foto del catálogo', function () {
    actingAsSeed('U01');
    $b2b = withinTenant(tenantA(), fn () => DB::table('catalog_rates')->where('ref', 'TAR-032')->value('id'));

    $code = $this->postJson('/api/v1/reservations', ['client_id' => 'CLI-0003', 'product_id' => 'CUS-HUM-FD', 'adt' => 1, 'departure_id' => departureRow('SAL-0403')->id, 'rate_id' => $b2b], ['Idempotency-Key' => idem('direct-rate')])
        ->assertCreated()->json('data.code');

    $snapshot = json_decode((string) reservationRow($code)->catalog_snapshot, true);
    expect($snapshot['rate']['ref'])->toBe('TAR-032');
});
