<?php

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;

function b2bAgencyCredit(): string
{
    return bcadd((string) rowOf('channel_b2b_agencies', 'AGB-01')->credit_used, '0', 2);
}

function b2bPassenger(string $code, int $seq): object
{
    return withinTenant(tenantA(), fn () => DB::table('booking_passengers')->where('reservation_id', reservationRow($code)->id)->where('seq', $seq)->first());
}

function b2bAudit(string $entity, string $code, string $action): bool
{
    return withinTenant(tenantA(), fn () => DB::table('audit_events')->where(['entity' => $entity, 'entity_id' => $code, 'action' => $action])->exists());
}

function b2bCreditReservation(): array
{
    actingAsSeed('U13');
    $body = ['product' => 'CUS-HUM-FD', 'date' => '2026-10-06', 'adults' => 2];
    $price = test()->postJson('/api/v1/b2b/reservations/quote-price', $body)->assertOk()->json('data');
    $code = (string) test()->postJson('/api/v1/b2b/reservations', [...$body, 'pay_mode' => 'credito', 'agency_ref' => 'WAY-9001'], critical())->assertOk()->json('data.code');
    $receivable = withinTenant(tenantA(), fn () => DB::table('fin_receivables')->where('reservation_id', reservationRow($code)->id)->first());

    return ['code' => $code, 'credit' => $price['credit']['amount'], 'receivable' => $receivable];
}

function b2bLatestReport(string $receivableId): ?object
{
    return withinTenant(tenantA(), fn () => DB::table('fin_payments')->where('receivable_id', $receivableId)->where('source', 'b2b')->orderByDesc('created_at')->first());
}

beforeEach(fn () => Queue::fake());

it('la agencia nomina a un pasajero y el dato queda en la reserva sin marcador de pendiente', function () {
    actingAsSeed('U13');

    $this->putJson('/api/v1/b2b/reservations/RES-2026-000345/passengers/2', ['full_name' => 'Rosa Quispe Mamani', 'doc_type' => 'DNI', 'doc_number' => '4123 5566', 'nationality' => 'Peruana', 'birth_date' => '1990-04-12'])->assertOk();

    $passenger = b2bPassenger('RES-2026-000345', 2);
    expect($passenger->full_name)->toBe('Rosa Quispe Mamani')
        ->and($passenger->doc_type)->toBe('DNI')
        ->and($passenger->doc_number)->toBe('41235566')
        ->and($passenger->nationality)->toBe('Peruana')
        ->and((int) $passenger->age)->toBe(36)
        ->and($passenger->is_placeholder)->toBeFalse()
        ->and($passenger->pending)->toBeFalse()
        ->and(b2bPassenger('RES-2026-000345', 1)->full_name)->toBe('Pasajero Wayra 1')
        ->and(b2bAudit('Reserva', 'RES-2026-000345', 'editar_pasajero_b2b'))->toBeTrue();

    actingAsSeed('U01');
    $names = collect($this->getJson('/api/v1/reservations/RES-2026-000345')->assertOk()->json('data.passengers'))->pluck('full_name');
    expect($names)->toContain('Rosa Quispe Mamani');
});

it('nominar sin documento deja al pasajero pendiente de documento', function () {
    actingAsSeed('U13');

    $this->putJson('/api/v1/b2b/reservations/RES-2026-000345/passengers/3', ['full_name' => 'Elena Quispe'])->assertOk();

    expect(b2bPassenger('RES-2026-000345', 3)->pending)->toBeTrue()
        ->and(b2bPassenger('RES-2026-000345', 3)->doc_number)->toBeNull();
});

it('valida nombre, documento y fecha de nacimiento del pasajero', function () {
    actingAsSeed('U13');

    $this->putJson('/api/v1/b2b/reservations/RES-2026-000345/passengers/2', ['full_name' => 'R', 'doc_number' => '12', 'birth_date' => '2027-01-01'])
        ->assertStatus(422)->assertJsonValidationErrors(['full_name', 'doc_type', 'doc_number', 'birth_date']);

    expect(b2bPassenger('RES-2026-000345', 2)->full_name)->toBe('Pasajero Wayra 2');
});

it('un pasajero inexistente responde 404 y una reserva cerrada no admite cambios', function () {
    actingAsSeed('U13');
    expect($this->putJson('/api/v1/b2b/reservations/RES-2026-000345/passengers/99', ['full_name' => 'Rosa Quispe']))->toBeApiError(404)
        ->and($this->putJson('/api/v1/b2b/reservations/RES-2026-000348/passengers/1', ['full_name' => 'Rosa Quispe']))->toBeApiError(404);

    withinTenant(tenantA(), fn () => DB::table('booking_reservations')->where('code', 'RES-2026-000345')->update(['status' => 'completada']));
    expect($this->putJson('/api/v1/b2b/reservations/RES-2026-000345/passengers/2', ['full_name' => 'Rosa Quispe']))->toBeApiError(409, 'RESERVATION_CLOSED');
});

it('el cliente directo no entra al portal B2B', function () {
    actingAsSeed('U14');

    expect($this->putJson('/api/v1/b2b/reservations/RES-2026-000345/passengers/2', ['full_name' => 'Rosa Quispe']))->toBeApiError(403)
        ->and($this->deleteJson('/api/v1/b2b/reservations/RES-2026-000345/cancel-request'))->toBeApiError(403)
        ->and($this->postJson('/api/v1/b2b/settlement-requests', [], critical()))->toBeApiError(403);
});

it('retirar la solicitud de anulación la saca de la reserva y de la bandeja de aprobaciones', function () {
    actingAsSeed('U13');
    $this->postJson('/api/v1/b2b/reservations/RES-2026-000345/cancel-request', ['reason' => 'Cambio de planes', 'detail' => 'El grupo cambia de fecha.'])->assertSuccessful();

    actingAsSeed('U02');
    expect($this->getJson('/api/v1/reservations/RES-2026-000345')->assertOk()->json('data.cancel_request'))->not->toBeNull();

    actingAsSeed('U13');
    $this->deleteJson('/api/v1/b2b/reservations/RES-2026-000345/cancel-request')->assertOk()->assertJsonPath('data.code', 'RES-2026-000345');

    $request = withinTenant(tenantA(), fn () => DB::table('booking_cancel_requests')->where('reservation_id', reservationRow('RES-2026-000345')->id)->orderByDesc('created_at')->first());
    expect($request->status)->toBe('retirada')
        ->and($request->decision_note)->toBe('Retirada por la agencia')
        ->and(reservationRow('RES-2026-000345')->status)->toBe('pendiente_pago')
        ->and(b2bAudit('Reserva', 'RES-2026-000345', 'retirar_anulacion'))->toBeTrue();

    actingAsSeed('U02');
    expect($this->getJson('/api/v1/reservations/RES-2026-000345')->assertOk()->json('data.cancel_request'))->toBeNull()
        ->and(collect($this->getJson('/api/v1/approvals')->assertOk()->json('data.items'))->where('code', 'RES-2026-000345')->where('status', 'pendiente')->count())->toBe(0);
});

it('sin solicitud pendiente no hay nada que retirar, y la agencia puede volver a solicitar', function () {
    actingAsSeed('U13');
    expect($this->deleteJson('/api/v1/b2b/reservations/RES-2026-000345/cancel-request'))->toBeApiError(404);

    $this->postJson('/api/v1/b2b/reservations/RES-2026-000345/cancel-request', ['reason' => 'Cambio de planes', 'detail' => 'El grupo cambia de fecha.'])->assertSuccessful();
    $this->deleteJson('/api/v1/b2b/reservations/RES-2026-000345/cancel-request')->assertOk();
    expect($this->deleteJson('/api/v1/b2b/reservations/RES-2026-000345/cancel-request'))->toBeApiError(404);

    $this->postJson('/api/v1/b2b/reservations/RES-2026-000345/cancel-request', ['reason' => 'Cambio de planes', 'detail' => 'Ahora sí anulamos.'])->assertSuccessful();
});

it('el pago informado por la agencia queda por validar en Finanzas y al aplicarse libera su crédito', function () {
    $before = b2bAgencyCredit();
    ['code' => $code, 'credit' => $credit, 'receivable' => $receivable] = b2bCreditReservation();
    expect(b2bAgencyCredit())->toBe(bcadd($before, $credit, 2));

    $this->postJson("/api/v1/b2b/receivables/{$receivable->code}/payment-reports", ['amount' => (string) $receivable->amount, 'method' => 'transferencia_bcp', 'reference' => 'OP-55667788', 'note' => 'Transferencia del grupo'], critical())->assertOk();

    $payment = b2bLatestReport($receivable->id);
    expect($payment->status)->toBe('pendiente')
        ->and((string) $payment->amount)->toBe((string) $receivable->amount)
        ->and($payment->reported_by_agency)->toBeTrue()
        ->and($payment->reference)->toBe('OP-55667788')
        ->and(b2bAgencyCredit())->toBe(bcadd($before, $credit, 2))
        ->and(b2bAudit('Pago', $payment->code, 'informar_b2b'))->toBeTrue();

    actingAsSeed('U07');
    $listed = collect($this->getJson('/api/v1/finance/payments')->assertOk()->json('data.rows'))->firstWhere('code', $payment->code);
    expect($listed['status'])->toBe('pendiente');

    $this->postJson("/api/v1/finance/payments/{$payment->code}/confirm", ['receivable' => $receivable->code], critical())->assertOk();

    expect(rowOf('fin_payments', $payment->code)->status)->toBe('aplicado')
        ->and(rowOf('fin_receivables', $receivable->code)->status)->toBe('pagada')
        ->and(b2bAgencyCredit())->toBe($before)
        ->and(reservationRow($code)->status)->toBe('confirmada');

    $this->postJson("/api/v1/finance/payments/{$payment->code}/revert", ['reason' => 'Transferencia rechazada por el banco'], critical((int) rowOf('fin_payments', $payment->code)->lock_version))->assertOk();
    expect(b2bAgencyCredit())->toBe(bcadd($before, $credit, 2))
        ->and(rowOf('fin_receivables', $receivable->code)->status)->not->toBe('pagada');
});

it('B2B-BR-14: el monto informado no supera el saldo y no se informa dos veces el mismo saldo', function () {
    ['receivable' => $receivable] = b2bCreditReservation();
    $over = bcadd((string) $receivable->amount, '0.01', 2);

    expect($this->postJson("/api/v1/b2b/receivables/{$receivable->code}/payment-reports", ['amount' => $over, 'method' => 'transferencia_bcp', 'reference' => 'OP-1'], critical()))->toBeApiError(422, 'B2B-BR-14');

    $this->postJson("/api/v1/b2b/receivables/{$receivable->code}/payment-reports", ['amount' => '100.00', 'method' => 'yape', 'reference' => 'OP-2'], critical())->assertOk();
    $rest = bcsub((string) $receivable->amount, '100.00', 2);
    expect($this->postJson("/api/v1/b2b/receivables/{$receivable->code}/payment-reports", ['amount' => bcadd($rest, '0.01', 2), 'method' => 'yape', 'reference' => 'OP-3'], critical()))->toBeApiError(422, 'B2B-BR-14');
    $this->postJson("/api/v1/b2b/receivables/{$receivable->code}/payment-reports", ['amount' => $rest, 'method' => 'yape', 'reference' => 'OP-4'], critical())->assertOk();
    expect($this->postJson("/api/v1/b2b/receivables/{$receivable->code}/payment-reports", ['amount' => '1.00', 'method' => 'yape', 'reference' => 'OP-5'], critical()))->toBeApiError(422, 'B2B-BR-14');

    expect(withinTenant(tenantA(), fn () => DB::table('fin_payments')->where('receivable_id', $receivable->id)->where('status', 'pendiente')->sum('amount')))->toEqual((string) $receivable->amount);
});

it('el pago informado no admite efectivo ni crédito B2B, exige operación y solo sobre cuotas de la agencia', function () {
    ['receivable' => $receivable] = b2bCreditReservation();

    expect($this->postJson("/api/v1/b2b/receivables/{$receivable->code}/payment-reports", ['amount' => '10', 'method' => 'efectivo', 'reference' => 'OP-1'], critical()))->toBeApiError(422)
        ->and($this->postJson("/api/v1/b2b/receivables/{$receivable->code}/payment-reports", ['amount' => '10', 'method' => 'credito_b2b', 'reference' => 'OP-1'], critical()))->toBeApiError(422);
    $this->postJson("/api/v1/b2b/receivables/{$receivable->code}/payment-reports", ['amount' => '0', 'method' => 'yape', 'reference' => ''], critical())->assertStatus(422)->assertJsonValidationErrors(['amount', 'reference']);
    expect($this->postJson('/api/v1/b2b/receivables/CXC-00711/payment-reports', ['amount' => '10', 'method' => 'yape', 'reference' => 'OP-1'], critical()))->toBeApiError(404)
        ->and(b2bLatestReport($receivable->id))->toBeNull();
});

it('la liquidación solicitada por la agencia agrupa sus comisiones y llega a aprobaciones', function () {
    actingAsSeed('U13');

    $code = $this->postJson('/api/v1/b2b/settlement-requests', [], critical())->assertOk()->json('data.code');
    $request = rowOf('channel_b2b_settlement_requests', $code);

    expect($code)->toStartWith('LIQ-2026-')
        ->and($request->status)->toBe('solicitada')
        ->and((string) $request->amount_pen)->toBe('115.20')
        ->and(rowOf('fin_commissions', 'COM-0299')->settlement_request_id)->toBe($request->id)
        ->and(b2bAudit('Agencia B2B', 'AGB-01', 'solicitar_liquidacion'))->toBeTrue();

    actingAsSeed('U07');
    $item = collect($this->getJson('/api/v1/approvals')->assertOk()->json('data.items'))->firstWhere('code', $code);
    expect($item)->not->toBeNull()
        ->and($item['status'])->toBe('pendiente')
        ->and($item['amount_pen'])->toEqual(115.2);
});

it('B2B-BR-15: sin comisiones pendientes no se solicita liquidación', function () {
    actingAsSeed('U13');
    $this->postJson('/api/v1/b2b/settlement-requests', [], critical())->assertOk();

    expect($this->postJson('/api/v1/b2b/settlement-requests', [], critical()))->toBeApiError(422, 'B2B-BR-15')
        ->and(withinTenant(tenantA(), fn () => DB::table('channel_b2b_settlement_requests')->count()))->toBe(1);
});
