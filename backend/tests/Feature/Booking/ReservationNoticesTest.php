<?php

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;

function reservationNotices(string $code, string $event): array
{
    $id = reservationRow($code)->id;

    return withinTenant(tenantA(), fn () => DB::table('notif_messages')->where('source_type', 'booking_reservation')->where('source_id', $id)->where('event_code', $event)->pluck('recipient_user_id')->map(fn ($user) => (string) $user)->all());
}

it('la anulación: rechazarla avisa a quien la pidió y pedirla avisa a Gerencia (04 §8)', function () {
    Queue::fake();
    $request = withinTenant(tenantA(), fn () => DB::table('booking_cancel_requests')->where('reservation_id', reservationRow('RES-2026-000349')->id)->where('status', 'pendiente')->first());

    actingAsSeed('U02');
    $this->postJson("/api/v1/reservations/RES-2026-000349/cancel-requests/{$request->id}/reject", ['note' => 'El cliente confirmó que viaja'])->assertOk();
    expect(reservationNotices('RES-2026-000349', 'reserva.anulacion_rechazada'))->toBe([(string) $request->requested_by]);

    actingAsSeed('U03');
    $this->postJson('/api/v1/reservations/RES-2026-000349/cancel-requests', ['reason' => 'Cambio de planes', 'detail' => 'Pospone el viaje a diciembre'])->assertCreated();
    expect(reservationNotices('RES-2026-000349', 'reserva.anulacion_solicitada'))->toContain(idOf('iam_users', 'U02'))->not->toContain(idOf('iam_users', 'U03'));
});

it('reasignar la reserva avisa al nuevo responsable', function () {
    Queue::fake();
    actingAsSeed('U01');
    $target = seedUser('U04')->id;

    $this->postJson('/api/v1/reservations/RES-2026-000347/reassign', ['owner_id' => $target, 'note' => 'Vacaciones'], critical(reservationLock('RES-2026-000347')))->assertOk();

    expect(reservationNotices('RES-2026-000347', 'reserva.reasignada'))->toBe([(string) $target]);
});
