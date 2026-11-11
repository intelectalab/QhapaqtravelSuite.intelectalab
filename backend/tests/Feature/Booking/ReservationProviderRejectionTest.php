<?php

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;

beforeEach(function () {
    lockSeededBookings();
    Queue::fake();
    freezeBusinessToday();
});

function providerIdOf(string $ref): string
{
    return (string) withinTenant(tenantA(), fn () => DB::table('catalog_providers')->where('ref', $ref)->value('id'));
}

it('K6 / RES-BR-13: el rechazo posterior de un servicio confirmado lo deja rechazado, propone otro proveedor y la reserva vuelve a pendiente de proveedor', function () {
    actingAsSeed('U01');

    $detail = $this->getJson('/api/v1/reservations/RES-2026-000348')->assertOk()->json('data');
    $hotel = collect($detail['services'])->firstWhere('code', 'RS-3482');
    expect(collect($hotel['alternatives'])->pluck('id'))->toContain(providerIdOf('PRV-002'))
        ->and(collect($hotel['alternatives'])->pluck('id'))->not->toContain(providerIdOf('PRV-001'));

    $this->postJson('/api/v1/reservations/RES-2026-000348/services/RS-3482/reject', [
        'reason' => 'Sin disponibilidad (sold out)',
        'detail' => 'El hotel avisó overbooking.',
        'alternative_provider_id' => providerIdOf('PRV-002'),
    ], critical(reservationLock('RES-2026-000348')))->assertOk()->assertJsonPath('data.status', 'rechazado');

    $alternative = withinTenant(tenantA(), fn () => DB::table('booking_reservation_services')->where('alt_of_id', serviceRow('RS-3482')->id)->first(['status', 'provider_id', 'service_date']));
    expect($alternative->status)->toBe('pendiente')
        ->and($alternative->provider_id)->toBe(providerIdOf('PRV-002'))
        ->and($alternative->service_date)->toBe(serviceRow('RS-3482')->service_date)
        ->and(reservationRow('RES-2026-000348')->status)->toBe('pendiente_proveedor')
        ->and(withinTenant(tenantA(), fn () => DB::table('audit_events')->where('entity_id', 'RS-3482')->where('action', 'rechazo_posterior')->exists()))->toBeTrue();
});

it('RES-BR-13: el proveedor alternativo tiene que ser otro activo del mismo tipo', function () {
    actingAsSeed('U01');

    $response = $this->postJson('/api/v1/reservations/RES-2026-000348/services/RS-3482/reject', [
        'reason' => 'Otro',
        'detail' => 'Cambio de proveedor.',
        'alternative_provider_id' => providerIdOf('PRV-004'),
    ], critical(reservationLock('RES-2026-000348')));

    expect($response)->toBeApiError(422, 'RES-BR-13');
    expect(serviceRow('RS-3482')->status)->toBe('confirmado');
});

it('V7: la vista previa de confirmación lista cada servicio y bloquea con reprogramar si la salida no tiene cupo', function () {
    actingAsSeed('U01');

    $ready = $this->getJson('/api/v1/reservations/RES-2026-000349/confirm-preview')->assertOk()->json('data');
    expect($ready['services'])->not->toBeEmpty()
        ->and($ready['services'][0]['ok'])->toBeTrue();

    $code = $this->postJson('/api/v1/reservations', ['client_id' => 'CLI-0003', 'product_id' => 'CUS-HUM-FD', 'adt' => 2, 'departure_id' => departureRow('SAL-0403')->id], ['Idempotency-Key' => idem('confirm-preview')])
        ->assertCreated()->json('data.code');
    withinTenant(tenantA(), function () use ($code) {
        $reservation = DB::table('booking_reservations')->where('code', $code)->value('id');
        DB::table('booking_inventory_holds')->where('reservation_id', $reservation)->delete();
        DB::table('catalog_product_departures')->where('ref', 'SAL-0403')->update(['sold' => DB::raw('capacity')]);
    });

    $blocked = $this->getJson("/api/v1/reservations/{$code}/confirm-preview")->assertOk()->json('data');
    $service = collect($blocked['services'])->firstWhere('kind', 'cupo');
    expect($blocked['blocked'])->toBeTrue()
        ->and($blocked['reschedule'])->toBeTrue()
        ->and($service['ok'])->toBeFalse()
        ->and($service['message'])->toContain('SAL-0403');
});

it('V7: la vista previa respeta la cartera y el permiso de modificar', function () {
    actingAsSeed('U07');
    $this->getJson('/api/v1/reservations/RES-2026-000349/confirm-preview')->assertForbidden();
});
