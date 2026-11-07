<?php

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;

beforeEach(fn () => Queue::fake());

it('listReservations pagina por cursor, filtra por estado y trae los KPIs', function () {
    actingAsSeed('U01');

    $page = $this->getJson('/api/v1/reservations?page[size]=3')->assertOk();
    $confirmed = $this->getJson('/api/v1/reservations?filter[status]=confirmada&page[size]=100')->assertOk()->json('data');

    expect($page->json('data'))->toHaveCount(3)
        ->and($page->json('meta.next_cursor'))->not->toBeNull()
        ->and($page->json('meta.kpis'))->toHaveKeys(['confirmed', 'in_operation', 'pending', 'traveling_pax'])
        ->and(collect($confirmed)->pluck('status')->unique()->all())->toBe(['confirmada'])
        ->and($page->json('meta.kpis.confirmed'))->toBe(count($confirmed));
    expect($this->getJson('/api/v1/reservations?filter[status]=inventada'))->toBeApiError(422, 'FILTER_INVALID');
});

it('Ventas solo lista y cuenta sus reservas', function () {
    actingAsSeed('U03');

    $codes = collect($this->getJson('/api/v1/reservations?page[size]=100')->assertOk()->json('data'))->pluck('code');
    $kpis = $this->getJson('/api/v1/reservations/kpis')->assertOk()->json('data');

    expect($codes)->toContain('RES-2026-000347')
        ->and($codes)->not->toContain('RES-2026-000350')
        ->and($kpis['total'])->toBe($codes->count());
});

it('reservationsConfirm confirma un borrador, exige If-Match y crea las cuotas 40/60', function () {
    actingAsSeed('U01');

    expect($this->postJson('/api/v1/reservations/RES-2026-000349/confirm', [], ['Accept' => 'application/json']))->toBeApiError(428, 'IF_MATCH_REQUIRED');

    $this->postJson('/api/v1/reservations/RES-2026-000349/confirm', [], critical(reservationLock('RES-2026-000349')))
        ->assertOk()->assertJsonPath('data.status', 'confirmada');
    $kinds = withinTenant(tenantA(), fn () => DB::table('fin_receivables')->where('reservation_id', reservationRow('RES-2026-000349')->id)->orderBy('kind')->pluck('kind')->all());

    expect($kinds)->toBe(['anticipo', 'saldo'])
        ->and(collect($this->getJson('/api/v1/reservations/RES-2026-000349/history')->json('data'))->pluck('action')->all())->toContain('confirmar');
    expect($this->postJson('/api/v1/reservations/RES-2026-000348/confirm', [], critical(reservationLock('RES-2026-000348'))))->toBeApiError(409, 'RES-BR-07');
});

it('reservationsStartOperation respeta la fecha de viaje y reservationsComplete solo cierra lo que está en operación', function () {
    freezeBusinessToday();
    actingAsSeed('U01');

    expect($this->postJson('/api/v1/reservations/RES-2026-000350/start-operation', [], critical(reservationLock('RES-2026-000350'))))->toBeApiError(409, 'RES-BR-08');
    expect($this->postJson('/api/v1/reservations/RES-2026-000350/complete', [], critical(reservationLock('RES-2026-000350'))))->toBeApiError(409, 'RES-BR-08');

    expect($this->postJson('/api/v1/reservations/RES-2026-000348/start-operation', [], critical(reservationLock('RES-2026-000348'))))->toBeApiError(409, 'RES-BR-08');
    withinTenant(tenantA(), fn () => DB::table('booking_reservations')->where('code', 'RES-2026-000348')->update(['travel_from' => '2026-09-30']));

    $this->postJson('/api/v1/reservations/RES-2026-000348/start-operation', [], critical(reservationLock('RES-2026-000348')))->assertOk()->assertJsonPath('data.status', 'en_operacion');
    $this->postJson('/api/v1/reservations/RES-2026-000348/complete', [], critical(reservationLock('RES-2026-000348')))->assertOk()->assertJsonPath('data.status', 'completada');
});

it('reservationsReassign es de Gerencia, exige If-Match y no reasigna al mismo asesor', function () {
    $target = seedUser('U04')->id;

    actingAsSeed('U03');
    expect($this->postJson('/api/v1/reservations/RES-2026-000347/reassign', ['owner_id' => $target], critical(reservationLock('RES-2026-000347'))))->toBeApiError(403);

    actingAsSeed('U01');
    expect($this->postJson('/api/v1/reservations/RES-2026-000347/reassign', ['owner_id' => $target], ['Accept' => 'application/json']))->toBeApiError(428, 'IF_MATCH_REQUIRED');
    $this->postJson('/api/v1/reservations/RES-2026-000347/reassign', ['owner_id' => $target, 'note' => 'Vacaciones'], critical(reservationLock('RES-2026-000347')))
        ->assertOk()->assertJsonPath('data.owner_id', $target);
    expect($this->postJson('/api/v1/reservations/RES-2026-000347/reassign', ['owner_id' => $target], critical(reservationLock('RES-2026-000347'))))->toBeApiError(409, 'RES-BR-51');
});

it('reservationsServicesRequest y reservationsServicesConfirm llevan el servicio hasta confirmado', function () {
    actingAsSeed('U05');

    $this->postJson('/api/v1/reservations/RES-2026-000349/services/RS-3491/request', ['note' => 'Grupo con niños'])->assertOk()->assertJsonPath('data.status', 'solicitado');
    $requests = withinTenant(tenantA(), fn () => DB::table('ops_supplier_requests')->where('reservation_service_id', serviceRow('RS-3491')->id)->where('channel', 'email')->count());
    expect($requests)->toBe(1);
    expect($this->postJson('/api/v1/reservations/RES-2026-000349/services/RS-3491/request', []))->toBeApiError(409);

    expect($this->postJson('/api/v1/reservations/RES-2026-000344/services/RS-3441/confirm', ['confirmation_code' => 'AB']))->toBeApiError(422);
    $this->postJson('/api/v1/reservations/RES-2026-000344/services/RS-3441/confirm', ['confirmation_code' => 'pr-7781', 'time' => '06:10'])
        ->assertOk()->assertJsonPath('data.status', 'confirmado')->assertJsonPath('data.confirmation_code', 'PR-7781');
    expect(reservationRow('RES-2026-000344')->status)->toBe('pendiente_proveedor');

    $this->postJson('/api/v1/reservations/RES-2026-000344/services/RS-3442/confirm', ['confirmation_code' => 'HTR-2201'])->assertOk();
    expect(reservationRow('RES-2026-000344')->status)->toBe('confirmada');
});

it('reservationsServicesReject exige motivo y deja la reserva pendiente de proveedor', function () {
    actingAsSeed('U05');

    expect($this->postJson('/api/v1/reservations/RES-2026-000348/services/RS-3487/reject', ['reason' => 'Inventado', 'detail' => 'x']))->toBeApiError(422);
    $this->postJson('/api/v1/reservations/RES-2026-000348/services/RS-3487/reject', ['reason' => 'Sin disponibilidad (sold out)', 'detail' => 'Flota completa ese día'])
        ->assertOk()->assertJsonPath('data.status', 'rechazado');

    expect(reservationRow('RES-2026-000348')->status)->toBe('pendiente_proveedor');
});

it('reservationsServicesRequestPending pide todos los servicios pendientes', function () {
    actingAsSeed('U05');

    $data = $this->postJson('/api/v1/reservations/RES-2026-000348/services/request-pending')->assertOk()->json('data');

    expect($data['requested'])->toBe(['RS-3488'])
        ->and(serviceRow('RS-3488')->status)->toBe('solicitado');
});

it('reservationsCancellationPreview y el rechazo de la solicitud de anulación por id', function () {
    actingAsSeed('U01');

    $preview = $this->postJson('/api/v1/reservations/RES-2026-000349/cancellation/preview')->assertOk()->json('data');
    expect($preview)->toHaveKeys(['penalty', 'refund', 'lines', 'request_id'])
        ->and($preview['request_id'])->not->toBeNull();
    expect($this->getJson('/api/v1/reservations/RES-2026-000349/cancellation')->status())->toBeIn([404, 405]);

    $this->postJson("/api/v1/reservations/RES-2026-000349/cancel-requests/{$preview['request_id']}/reject", ['note' => 'El cliente confirmó que viaja'])
        ->assertOk()->assertJsonPath('data.status', 'rechazada');
});

it('reservationsReceivablesGenerate crea las cuotas una sola vez', function () {
    actingAsSeed('U07');

    $created = $this->postJson('/api/v1/reservations/RES-2026-000349/receivables/generate', [], critical())->assertOk()->json('data.receivables');

    expect(collect($created)->pluck('kind')->all())->toBe(['anticipo', 'saldo']);
    expect($this->postJson('/api/v1/reservations/RES-2026-000349/receivables/generate', [], critical()))->toBeApiError(409, 'RES-BR-41');
});

it('reservationsOperationOrder genera la orden operativa de una reserva pendiente de proveedor', function () {
    actingAsSeed('U05');

    $response = $this->postJson('/api/v1/reservations/RES-2026-000344/operation-order', ['coordinator_id' => seedUser('U05')->id], critical())->assertOk();

    expect($response->json('meta.order_code'))->toStartWith('OP-');
    expect($this->postJson('/api/v1/reservations/RES-2026-000349/operation-order', [], critical()))->toBeApiError(409, 'RES-BR-42');
});

it('replaceReservationsPassengers y deleteReservationsPassengers exigen If-Match', function () {
    actingAsSeed('U01');
    $passenger = withinTenant(tenantA(), fn () => DB::table('booking_passengers')->where('reservation_id', reservationRow('RES-2026-000344')->id)->orderBy('seq')->first());
    $payload = ['full_name' => 'Ana Torres Quispe', 'pax_type' => 'ADT', 'doc_type' => 'DNI', 'doc_number' => '45781236'];

    expect($this->putJson("/api/v1/reservations/RES-2026-000344/passengers/{$passenger->id}", $payload, ['Accept' => 'application/json']))->toBeApiError(428, 'IF_MATCH_REQUIRED');
    $this->putJson("/api/v1/reservations/RES-2026-000344/passengers/{$passenger->id}", $payload, critical(reservationLock('RES-2026-000344')))
        ->assertOk()->assertJsonPath('data.full_name', 'Ana Torres Quispe');
    $this->deleteJson("/api/v1/reservations/RES-2026-000344/passengers/{$passenger->id}", [], critical(reservationLock('RES-2026-000344')))->assertNoContent();
});

it('getReservationsHistory reúne la auditoría de la reserva y de sus servicios', function () {
    actingAsSeed('U05');
    $this->postJson('/api/v1/reservations/RES-2026-000349/services/RS-3491/request')->assertOk();

    $events = collect($this->getJson('/api/v1/reservations/RES-2026-000349/history')->assertOk()->json('data'));

    expect($events->where('entity', 'Servicio reserva')->pluck('action')->all())->toContain('solicitar');

    actingAsSeed('U04');
    expect($this->getJson('/api/v1/reservations/RES-2026-000349/history'))->toBeApiError(403, 'SEC-BR-09');
});
