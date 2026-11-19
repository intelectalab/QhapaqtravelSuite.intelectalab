<?php

use App\Jobs\SendInvoiceToFiscalProvider;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;

function noteRow(string $number): ?object
{
    return rowOf('fin_invoices', $number, column: 'number');
}

function acceptNote(string $number): void
{
    $id = (string) noteRow($number)->id;
    withinTenant(tenantA(), fn () => app()->call([new SendInvoiceToFiscalProvider($id), 'handle']));
}

function closeCurrentPeriod(): void
{
    withinTenant(tenantA(), fn () => DB::table('fin_period_closes')->insert(['period' => substr(BUSINESS_TODAY, 0, 7), 'status' => 'cerrado', 'closed_at' => now()]));
}

function refundableReservation(string $code): void
{
    withinTenant(tenantA(), fn () => DB::table('booking_reservation_services')->where('reservation_id', idOf('booking_reservations', $code))->update(['service_date' => DB::raw("service_date + interval '90 days'")]));
}

function noteAudit(string $entityId, string $action): bool
{
    return withinTenant(tenantA(), fn () => DB::table('audit_events')->where('entity_id', $entityId)->where('action', $action)->exists());
}

beforeEach(function () {
    Queue::fake();
    lockSeededBookings();
});

it('createFinanceInvoices emite la nota de débito con su serie, motivo y referencia, y el OSE la acepta sin tocar el original', function () {
    actingAsSeed('U07');

    $data = $this->postJson('/api/v1/finance/invoices', ['doc_type' => '08', 'ref_invoice_id' => 'F001-00001482', 'credit_note_reason_code' => '01', 'amount' => '590.00', 'credit_note_reason' => 'Intereses por 20 días de atraso'], critical())
        ->assertStatus(202)->json('data');

    $note = noteRow('FD01-00000001');
    expect($data['number'])->toBe('FD01-00000001')
        ->and($data['doc_type'])->toBe('08')
        ->and($data['status'])->toBe('pendiente_envio')
        ->and((string) $note->ref_invoice_id)->toBe((string) noteRow('F001-00001482')->id)
        ->and($note->credit_note_reason_code)->toBe('01')
        ->and($note->receivable_id)->toBeNull()
        ->and((string) $note->taxable_amount)->toBe('500.00')
        ->and((string) $note->igv_amount)->toBe('90.00')
        ->and(noteAudit('FD01-00000001', 'emitir'))->toBeTrue();
    Queue::assertPushed(SendInvoiceToFiscalProvider::class);

    acceptNote('FD01-00000001');

    expect(noteRow('FD01-00000001')->status)->toBe('aceptado')
        ->and(noteRow('F001-00001482')->status)->toBe('aceptado');

    $detail = $this->getJson('/api/v1/finance/invoices/F001-00001482')->assertOk()->json('data');
    expect($detail['debitable'])->toBeTrue()
        ->and(collect($detail['debit_reasons'])->pluck('value')->all())->toBe(['01', '02', '03'])
        ->and(collect($detail['credit_notes'])->firstWhere('number', 'FD01-00000001')['doc_type'])->toBe('08');
    expect($this->getJson('/api/v1/finance/invoices/FD01-00000001')->assertOk()->json('data.debitable'))->toBeFalse();
});

it('la nota de débito exige importe, motivo del catálogo 10 y un comprobante aceptado que no sea nota', function () {
    actingAsSeed('U07');
    $base = ['doc_type' => '08', 'ref_invoice_id' => 'F001-00001482', 'credit_note_reason_code' => '02', 'amount' => '100'];

    $this->postJson('/api/v1/finance/invoices', [...$base, 'amount' => null], critical())->assertStatus(422)->assertJsonValidationErrors('amount');
    $this->postJson('/api/v1/finance/invoices', [...$base, 'credit_note_reason_code' => '13'], critical())->assertStatus(422)->assertJsonValidationErrors('credit_note_reason_code');
    expect($this->postJson('/api/v1/finance/invoices', [...$base, 'ref_invoice_id' => 'B001-00008812'], critical()))->toBeApiError(409, 'FIN-BR-41');

    $this->postJson('/api/v1/finance/invoices', ['doc_type' => '07', 'ref_invoice_id' => 'F001-00001482', 'credit_note_reason_code' => '09', 'amount' => '100'], critical())->assertStatus(202);
    acceptNote('FC01-00000001');

    expect($this->postJson('/api/v1/finance/invoices', [...$base, 'ref_invoice_id' => 'FC01-00000001'], critical()))->toBeApiError(409, 'FIN-BR-41');
});

it('con el periodo cerrado no se emiten notas de crédito ni de débito (FIN-BR-48)', function () {
    actingAsSeed('U07');
    closeCurrentPeriod();

    expect($this->postJson('/api/v1/finance/invoices', ['doc_type' => '08', 'ref_invoice_id' => 'F001-00001482', 'credit_note_reason_code' => '03', 'amount' => '100'], critical()))->toBeApiError(422, 'FIN-BR-48')
        ->and($this->postJson('/api/v1/finance/invoices', ['doc_type' => '07', 'ref_invoice_id' => 'F001-00001482', 'credit_note_reason_code' => '01'], critical()))->toBeApiError(422, 'FIN-BR-48')
        ->and(noteRow('FD01-00000001'))->toBeNull();
});

it('sin finance.invoicing no se emite la nota de débito', function () {
    actingAsSeed('U02');

    $response = $this->postJson('/api/v1/finance/invoices', ['doc_type' => '08', 'ref_invoice_id' => 'F001-00001482', 'credit_note_reason_code' => '01', 'amount' => '100'], critical());

    expect($response)->toBeApiError(403)
        ->and($response->json('required_permissions'))->toContain('finance.invoicing');
});

it('cancelar una reserva facturada con reembolso emite la nota de crédito sobre el comprobante y la enlaza al reembolso', function () {
    actingAsSeed('U01');
    $code = 'RES-2026-000348';
    refundableReservation($code);

    $this->postJson("/api/v1/reservations/{$code}/cancel", ['reason' => 'Cambio de planes', 'detail' => 'El cliente pospone el viaje.'], critical(reservationLock($code)))->assertOk();

    $note = noteRow('FC01-00000001');
    $cancellation = withinTenant(tenantA(), fn () => DB::table('booking_cancellations')->where('reservation_id', idOf('booking_reservations', $code))->first());
    $refund = withinTenant(tenantA(), fn () => DB::table('fin_payments')->where('id', $cancellation->refund_payment_id)->first());

    expect($note->doc_type)->toBe('07')
        ->and($note->status)->toBe('pendiente_envio')
        ->and((string) $note->ref_invoice_id)->toBe((string) noteRow('F001-00001482')->id)
        ->and((string) $note->total_amount)->toBe('23444.00')
        ->and($note->credit_note_reason_code)->toBe('01')
        ->and((string) $cancellation->credit_note_id)->toBe((string) $note->id)
        ->and($refund->reference)->toBe('Reembolso FC01-00000001 · 7 a 15 días hábiles')
        ->and((string) $refund->amount)->toBe('23444.00');
    Queue::assertPushed(SendInvoiceToFiscalProvider::class);

    acceptNote('FC01-00000001');

    expect(noteRow('F001-00001482')->status)->toBe('anulado');
});

it('si el comprobante de la reserva aún no está aceptado, la cancelación sigue y deja anotada la nota pendiente', function () {
    actingAsSeed('U01');
    $code = 'RES-2026-000348';
    refundableReservation($code);
    withinTenant(tenantA(), fn () => DB::table('fin_invoices')->where('number', 'F001-00001482')->update(['status' => 'emitido']));

    $this->postJson("/api/v1/reservations/{$code}/cancel", ['reason' => 'Cambio de planes', 'detail' => 'El cliente pospone el viaje.'], critical(reservationLock($code)))->assertOk();

    $cancellation = withinTenant(tenantA(), fn () => DB::table('booking_cancellations')->where('reservation_id', idOf('booking_reservations', $code))->first());

    expect(noteRow('FC01-00000001'))->toBeNull()
        ->and($cancellation->credit_note_id)->toBeNull()
        ->and($cancellation->refund_payment_id)->not->toBeNull()
        ->and(reservationRow($code)->status)->toBe('cancelada')
        ->and(noteAudit($code, 'nota_credito_pendiente'))->toBeTrue();
});
