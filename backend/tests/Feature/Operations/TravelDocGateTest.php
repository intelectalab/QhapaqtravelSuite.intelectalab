<?php

use App\Domain\Booking\Events\ReservationConfirmed;
use App\Domain\Operations\Listeners\CreateTravelDocChecklist;
use App\Domain\Operations\Support\TravelDocChecklist;
use Illuminate\Support\Facades\DB;

function mapiService(): object
{
    $service = withinTenant(tenantA(), fn () => DB::table('booking_reservation_services as s')->join('booking_reservations as r', 'r.id', '=', 's.reservation_id')
        ->whereNull('r.deleted_at')->whereNotIn('r.status', ['cancelada', 'borrador'])->whereIn('s.status', ['confirmado', 'completado'])->where('s.name', '~*', '(machu|huayna)\s*picchu')
        ->first(['s.id', 's.code', 's.reservation_id']));
    expect($service)->not->toBeNull();

    withinTenant(tenantA(), fn () => DB::table('ops_vouchers')->where('reservation_service_id', $service->id)->whereIn('status', ['emitido', 'utilizado'])->update(['status' => 'anulado', 'void_reason' => 'Prueba de bloqueo', 'void_at' => now()]));

    return $service;
}

it('confirmar una reserva le crea el checklist de documentos de cada pasajero sin duplicar ítems', function () {
    $reservation = withinTenant(tenantA(), fn () => DB::table('booking_reservations')->whereNull('deleted_at')->whereNotIn('status', ['cancelada', 'borrador'])
        ->whereExists(fn ($query) => $query->from('booking_passengers as p')->whereColumn('p.reservation_id', 'booking_reservations.id'))->first(['id', 'code']));
    withinTenant(tenantA(), fn () => DB::table('ops_travel_doc_items')->where('reservation_id', $reservation->id)->delete());
    $passengers = withinTenant(tenantA(), fn () => DB::table('booking_passengers')->where('reservation_id', $reservation->id)->count());

    withinTenant(tenantA(), fn () => app(CreateTravelDocChecklist::class)->handle(new ReservationConfirmed((string) tenantA()->getKey(), $reservation->id, $reservation->code)));
    $count = withinTenant(tenantA(), fn () => DB::table('ops_travel_doc_items')->where('reservation_id', $reservation->id)->count());

    expect($count)->toBe($passengers * count(TravelDocChecklist::TYPES))
        ->and(withinTenant(tenantA(), fn () => app(TravelDocChecklist::class)->sync($reservation->id)))->toBe(0);

    actingAsSeed('U05');
    expect(collect($this->getJson('/api/v1/ops/travel-docs')->assertOk()->json('data.items'))->pluck('code'))->toContain($reservation->code);
});

it('no emite el voucher de una entrada nominativa si falta la identidad validada (DOC-BR-010)', function () {
    actingAsSeed('U05');
    $service = mapiService();
    $provider = withinTenant(tenantA(), fn () => DB::table('catalog_providers')->whereNull('deleted_at')->where('status', 'activo')->value('id'));
    withinTenant(tenantA(), fn () => DB::table('ops_travel_doc_items')->where('reservation_id', $service->reservation_id)->where('doc_type', 'id_doc')->update(['status' => 'pendiente']));

    expect($this->postJson('/api/v1/ops/vouchers', ['service_code' => $service->code, 'provider_id' => $provider], critical()))->toBeApiError(422, 'DOC-BR-010');

    withinTenant(tenantA(), fn () => app(TravelDocChecklist::class)->sync($service->reservation_id));
    withinTenant(tenantA(), fn () => DB::table('ops_travel_doc_items')->where('reservation_id', $service->reservation_id)->whereIn('doc_type', ['id_doc', 'minor_auth'])->update(['status' => 'completo', 'expiry_date' => '2040-01-01']));

    $this->postJson('/api/v1/ops/vouchers', ['service_code' => $service->code, 'provider_id' => $provider], critical())->assertCreated();
});
