<?php

use App\Jobs\ReleaseAllotments;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;

beforeEach(function () {
    lockSeededBookings();
    freezeBusinessToday();
});

function allotmentDay(string $contract, string $date): object
{
    return withinTenant(tenantA(), fn () => DB::table('catalog_allotment_days as d')->join('catalog_allotments as a', 'a.id', '=', 'd.allotment_id')
        ->where('a.code', $contract)->where('d.service_date', $date)->first(['d.id', 'd.blocked_qty', 'd.released_qty', 'd.used_qty', 'd.pending_qty']));
}

function consumptionState(string $serviceCode): ?string
{
    return withinTenant(tenantA(), fn () => DB::table('catalog_allotment_consumptions as c')->join('booking_reservation_services as s', 's.id', '=', 'c.booking_service_id')
        ->where('s.code', $serviceCode)->value('c.state'));
}

function confirmService(string $reservation, string $service): void
{
    test()->postJson("/api/v1/reservations/{$reservation}/services/{$service}/confirm", ['confirmation_code' => 'TAMBO-778'], critical(reservationLock($reservation)))->assertOk();
}

it('CUP-BR-008: confirmar un servicio consume el cupo y el rechazo posterior lo revierte', function () {
    Queue::fake();
    actingAsSeed('U01');

    confirmService('RES-2026-000348', 'RS-3489');

    $day = allotmentDay('CUP-2026-001', '2026-10-05');
    expect($day->used_qty)->toBe(6)->and($day->pending_qty)->toBe(0)
        ->and(consumptionState('RS-3489'))->toBe('consumido');

    $this->postJson('/api/v1/reservations/RES-2026-000348/services/RS-3489/reject', ['reason' => 'Otro', 'detail' => 'El hotel ya no ofrece late check-out.'], critical(reservationLock('RES-2026-000348')))->assertOk();

    expect(allotmentDay('CUP-2026-001', '2026-10-05')->used_qty)->toBe(0)
        ->and(consumptionState('RS-3489'))->toBe('revertido');
});

it('CUP-BR-006: si la confirmación excede el cupo se marca sobreventa y el servicio queda on request', function () {
    Queue::fake();
    actingAsSeed('U01');
    withinTenant(tenantA(), fn () => DB::table('catalog_allotment_days')->where('id', allotmentDay('CUP-2026-001', '2026-10-05')->id)->update(['released_qty' => 3]));

    confirmService('RES-2026-000348', 'RS-3489');

    expect(serviceRow('RS-3489')->status)->toBe('solicitado')
        ->and(serviceRow('RS-3489')->confirmation_code)->toBeNull()
        ->and(consumptionState('RS-3489'))->toBe('en_tramite')
        ->and(withinTenant(tenantA(), fn () => DB::table('catalog_allotment_events')->where('message', 'like', 'Sobreventa: RS-3489%')->exists()))->toBeTrue()
        ->and(withinTenant(tenantA(), fn () => DB::table('audit_events')->where('entity_id', 'RS-3489')->where('action', 'sobreventa')->exists()))->toBeTrue();
});

it('CUP-BR-005/009: el job de liberación recalcula el consumo antes de soltar y no libera cupos vendidos', function () {
    lockScheduledJobs();
    actingAsSeed('U01');
    confirmService('RES-2026-000348', 'RS-3489');
    $day = allotmentDay('CUP-2026-001', '2026-10-05');
    withinTenant(tenantA(), fn () => DB::table('catalog_allotment_days')->where('id', $day->id)->update(['used_qty' => 0, 'pending_qty' => 0, 'release_deadline' => '2026-01-01']));

    dispatch_sync((new ReleaseAllotments)->forTenant((string) tenantA()->getKey()));

    $after = allotmentDay('CUP-2026-001', '2026-10-05');
    expect($after->used_qty)->toBe(6)
        ->and($after->released_qty)->toBe($day->released_qty);
});
