<?php

use Illuminate\Support\Facades\DB;

function activeAssignments(string $reservation): int
{
    return withinTenant(tenantA(), fn () => DB::table('ops_assignments as a')->join('ops_orders as o', 'o.id', '=', 'a.order_id')
        ->join('booking_reservations as r', 'r.id', '=', 'o.reservation_id')->where('r.code', $reservation)
        ->whereNotIn('a.status', ['completada', 'cancelada'])->where(fn ($q) => $q->whereNotNull('a.guide_id')->orWhereNotNull('a.driver_id')->orWhereNotNull('a.vehicle_id'))->count());
}

it('v2.5 (05 §4, 04 §4.6): cancelar la reserva cancela sus asignaciones y libera los recursos', function () {
    actingAsSeed('U01');
    expect(activeAssignments('RES-2026-000348'))->toBeGreaterThan(0);

    $this->postJson('/api/v1/reservations/RES-2026-000348/cancel', ['reason' => 'Cambio de planes', 'detail' => 'El cliente pospone el viaje.'], critical(reservationLock('RES-2026-000348')))->assertOk();

    expect(activeAssignments('RES-2026-000348'))->toBe(0)
        ->and(withinTenant(tenantA(), fn () => DB::table('audit_events')->where('entity', 'Asignación de recurso')->where('entity_id', 'RES-2026-000348')->where('action', 'cancelar')->exists()))->toBeTrue();
});

it('v2.5 (04 §4): una incidencia grave abierta pasa la reserva a incidencia y al resolverla vuelve a en operación', function () {
    actingAsSeed('U01');

    $incident = $this->postJson('/api/v1/ops/incidents', [
        'order_code' => 'OP-2026-0413',
        'type' => 'Horario',
        'severity' => 'alta',
        'title' => 'Bus averiado camino a Ollantaytambo',
        'description' => 'El bus quedó detenido en el km 40; se pide reemplazo.',
    ], critical())->assertCreated()->json('data.code');

    $coordinator = withinTenant(tenantA(), fn () => DB::table('ops_orders')->where('code', 'OP-2026-0413')->value('coordinator_id'));
    $notice = withinTenant(tenantA(), fn () => DB::table('notif_messages')->where('event_code', 'reserva.incidencia')->latest('created_at')->first(['recipient_user_id', 'subject']));
    expect(reservationRow('RES-2026-000348')->status)->toBe('incidencia')
        ->and($notice)->not->toBeNull()
        ->and((string) $notice->recipient_user_id)->toBe((string) $coordinator)
        ->and($notice->subject)->toContain('RES-2026-000348');

    $this->postJson("/api/v1/ops/incidents/{$incident}/resolve", ['resolution' => 'Llegó el bus de reemplazo y el grupo continuó.'], critical((int) rowOf('ops_incidents', $incident)->lock_version))->assertOk();

    expect(reservationRow('RES-2026-000348')->status)->toBe('en_operacion');
});

it('v2.5 (04 §4): una incidencia de severidad media no cambia el estado de la reserva', function () {
    actingAsSeed('U01');

    $this->postJson('/api/v1/ops/incidents', [
        'order_code' => 'OP-2026-0413',
        'type' => 'Horario',
        'severity' => 'media',
        'title' => 'Retraso leve del guía',
        'description' => 'El guía llega 15 minutos tarde al punto de encuentro.',
    ], critical())->assertCreated();

    expect(reservationRow('RES-2026-000348')->status)->toBe('confirmada');
});
