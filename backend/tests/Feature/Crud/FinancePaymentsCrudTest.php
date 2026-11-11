<?php

use Illuminate\Support\Facades\DB;

beforeEach(fn () => lockTreasury());

function finPagLock(string $code): int
{
    return (int) rowOf('fin_payments', $code)->lock_version;
}

function finPagAudit(string $code, string $action): bool
{
    return withinTenant(tenantA(), fn () => DB::table('audit_events')->where(['entity' => 'Pago', 'entity_id' => $code, 'action' => $action])->exists());
}

function finPagHistory(string $code): array
{
    return withinTenant(tenantA(), fn () => DB::table('fin_status_history')->where('entity_type', 'payment')->where('entity_id', idOf('fin_payments', $code))->orderBy('created_at')->pluck('status')->all());
}

it('rechazar un pago pendiente lo deja rechazado con su motivo y la cuota conserva su saldo', function () {
    actingAsSeed('U07');
    $payment = rowOf('fin_payments', 'PAG-01922');
    $receivable = withinTenant(tenantA(), fn () => DB::table('fin_receivables')->where('id', $payment->receivable_id)->first());

    $this->postJson('/api/v1/finance/payments/PAG-01922/reject', ['reason' => 'El abono no figura en el banco'], critical(finPagLock('PAG-01922')))->assertOk();

    $after = rowOf('fin_payments', 'PAG-01922');
    $receivableAfter = withinTenant(tenantA(), fn () => DB::table('fin_receivables')->where('id', $payment->receivable_id)->first());
    expect($after->status)->toBe('rechazado')
        ->and($after->reject_reason)->toBe('El abono no figura en el banco')
        ->and((int) $after->lock_version)->toBe((int) $payment->lock_version + 1)
        ->and((string) $receivableAfter->paid_amount)->toBe((string) $receivable->paid_amount)
        ->and($receivableAfter->status)->toBe($receivable->status)
        ->and(finPagHistory('PAG-01922'))->toContain('rechazado')
        ->and(finPagAudit('PAG-01922', 'rechazar'))->toBeTrue();
});

it('FIN-BR-13: solo se rechazan pagos pendientes', function () {
    actingAsSeed('U07');
    $this->postJson('/api/v1/finance/payments/PAG-01922/reject', ['reason' => 'Comprobante ilegible'], critical(finPagLock('PAG-01922')))->assertOk();

    expect($this->postJson('/api/v1/finance/payments/PAG-01922/reject', ['reason' => 'Comprobante ilegible'], critical(finPagLock('PAG-01922'))))->toBeApiError(409, 'FIN-BR-13')
        ->and($this->postJson('/api/v1/finance/payments/PAG-01921/reject', ['reason' => 'Comprobante ilegible'], critical(finPagLock('PAG-01921'))))->toBeApiError(409, 'FIN-BR-13')
        ->and(rowOf('fin_payments', 'PAG-01921')->status)->toBe('aplicado');
});

it('rechazar exige motivo, la versión vigente y el perfil operativo', function () {
    actingAsSeed('U07');
    $this->postJson('/api/v1/finance/payments/PAG-01922/reject', ['reason' => 'no'], critical(finPagLock('PAG-01922')))->assertStatus(422)->assertJsonValidationErrors(['reason']);
    expect($this->postJson('/api/v1/finance/payments/PAG-01922/reject', ['reason' => 'Comprobante ilegible'], critical(finPagLock('PAG-01922') + 5)))->toBeApiError(409, 'STALE_VERSION');

    actingAsSeed('U02');
    expect($this->postJson('/api/v1/finance/payments/PAG-01922/reject', ['reason' => 'Comprobante ilegible'], critical(finPagLock('PAG-01922'))))->toBeApiError(403);
    expect(rowOf('fin_payments', 'PAG-01922')->status)->toBe('pendiente');
});

it('revertir un pago aplicado lo desaplica y devuelve el saldo exacto a la cuota', function () {
    actingAsSeed('U07');
    expect((string) rowOf('fin_receivables', 'CXC-00713')->paid_amount)->toBe('400.00');

    $this->postJson('/api/v1/finance/payments/PAG-01921/revert', ['reason' => 'Yape devuelto por el banco'], critical(finPagLock('PAG-01921')))->assertOk();

    $payment = rowOf('fin_payments', 'PAG-01921');
    $receivable = rowOf('fin_receivables', 'CXC-00713');
    expect($payment->status)->toBe('revertido')
        ->and($payment->revert_reason)->toBe('Yape devuelto por el banco')
        ->and($payment->reverted_at)->not->toBeNull()
        ->and((string) $receivable->paid_amount)->toBe('0.00')
        ->and($receivable->status)->not->toBe('pagada')
        ->and(withinTenant(tenantA(), fn () => DB::table('fin_payment_applications')->where('payment_id', $payment->id)->whereNull('reversed_at')->exists()))->toBeFalse()
        ->and(finPagHistory('PAG-01921'))->toContain('revertido')
        ->and(withinTenant(tenantA(), fn () => DB::table('audit_events')->where(['entity' => 'Pago', 'entity_id' => 'PAG-01921', 'action' => 'revertir'])->where('after_value', 'like', '%saldo CXC-00713: 510.00 → 910.00')->exists()))->toBeTrue();
});

it('FIN-BR-16: un pago revertido no se vuelve a revertir y un pendiente no se revierte', function () {
    actingAsSeed('U07');
    $this->postJson('/api/v1/finance/payments/PAG-01921/revert', ['reason' => 'Yape devuelto por el banco'], critical(finPagLock('PAG-01921')))->assertOk();

    expect($this->postJson('/api/v1/finance/payments/PAG-01921/revert', ['reason' => 'Otra vez la misma'], critical(finPagLock('PAG-01921'))))->toBeApiError(409, 'FIN-BR-16')
        ->and($this->postJson('/api/v1/finance/payments/PAG-01922/revert', ['reason' => 'No corresponde'], critical(finPagLock('PAG-01922'))))->toBeApiError(409, 'FIN-BR-16')
        ->and((string) rowOf('fin_receivables', 'CXC-00713')->paid_amount)->toBe('0.00');
});

it('revertir exige finance.payments.revert, motivo e Idempotency-Key', function () {
    actingAsSeed('U02');
    expect($this->postJson('/api/v1/finance/payments/PAG-01921/revert', ['reason' => 'Yape devuelto'], critical(finPagLock('PAG-01921'))))->toBeApiError(403);

    actingAsSeed('U08');
    expect($this->postJson('/api/v1/finance/payments/PAG-01921/revert', ['reason' => 'Yape devuelto'], critical(finPagLock('PAG-01921'))))->toBeApiError(403);

    actingAsSeed('U07');
    $this->postJson('/api/v1/finance/payments/PAG-01921/revert', ['reason' => ''], critical(finPagLock('PAG-01921')))->assertStatus(422)->assertJsonValidationErrors(['reason']);
    expect($this->postJson('/api/v1/finance/payments/PAG-01921/revert', ['reason' => 'Yape devuelto'], ['If-Match' => (string) finPagLock('PAG-01921'), 'Accept' => 'application/json']))->toBeApiError(422, 'IDEMPOTENCY_KEY_REQUIRED')
        ->and(rowOf('fin_payments', 'PAG-01921')->status)->toBe('aplicado');
});
