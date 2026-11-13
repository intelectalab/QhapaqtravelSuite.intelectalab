<?php

use Illuminate\Support\Facades\DB;

function partialServices(string $reservation): array
{
    return withinTenant(tenantA(), fn () => DB::table('booking_reservation_services')->where('reservation_id', reservationRow($reservation)->id)
        ->whereNotIn('status', ['cancelado', 'completado', 'rechazado'])->orderBy('service_date')->pluck('code')->all());
}

function openBalance(string $reservation): float
{
    return (float) withinTenant(tenantA(), fn () => DB::table('fin_receivables')->where('reservation_id', reservationRow($reservation)->id)->whereNull('deleted_at')->whereNotIn('status', ['pagada', 'cancelada'])->sum(DB::raw('amount - paid_amount')));
}

it('v2.5 (04 §4): cancelar parte de los servicios deja la reserva parcial, baja el total y recalcula las cuotas', function () {
    actingAsSeed('U01');
    $services = partialServices('RES-2026-000348');
    expect(count($services))->toBeGreaterThan(1);
    $target = $services[0];
    $before = reservationRow('RES-2026-000348');
    $balanceBefore = openBalance('RES-2026-000348');

    $preview = $this->postJson('/api/v1/reservations/RES-2026-000348/services/cancel/preview', ['services' => [$target]])->assertOk()->json('data');
    expect($preview['services'])->toBe([$target])
        ->and((float) $preview['new_total'])->toBe(round((float) $before->total_amount - (float) $preview['credit'], 2));

    $this->postJson('/api/v1/reservations/RES-2026-000348/services/cancel', ['services' => [$target], 'reason' => 'Cambio de planes', 'detail' => 'El cliente ya no hará el traslado.'], critical(reservationLock('RES-2026-000348')))->assertOk();

    $after = reservationRow('RES-2026-000348');
    expect($after->status)->toBe('parcial')
        ->and((float) $after->total_amount)->toBe((float) $preview['new_total'])
        ->and(withinTenant(tenantA(), fn () => DB::table('booking_reservation_services')->where('code', $target)->value('status')))->toBe('cancelado')
        ->and(round(openBalance('RES-2026-000348'), 2))->toBe(round(max(0, $balanceBefore - (float) $preview['credit']), 2))
        ->and(withinTenant(tenantA(), fn () => DB::table('audit_events')->where(['entity' => 'Reserva', 'entity_id' => 'RES-2026-000348', 'action' => 'cancelar_servicios'])->exists()))->toBeTrue();
});

it('no se cancelan todos los servicios por esta vía ni servicios ajenos, y Ventas no cancela', function () {
    actingAsSeed('U01');
    $services = partialServices('RES-2026-000348');

    expect($this->postJson('/api/v1/reservations/RES-2026-000348/services/cancel/preview', ['services' => $services]))->toBeApiError(409, 'RES-PARTIAL-ALL')
        ->and($this->postJson('/api/v1/reservations/RES-2026-000348/services/cancel/preview', ['services' => ['RS-NOEXISTE']]))->toBeApiError(422, 'RES-PARTIAL-SERVICES');

    actingAsSeed('U03');
    expect($this->postJson('/api/v1/reservations/RES-2026-000348/services/cancel/preview', ['services' => [$services[0]]]))->toBeApiError(403);
});
