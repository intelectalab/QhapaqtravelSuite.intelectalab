<?php

use Illuminate\Support\Facades\DB;

function finBnkAudit(string $code, string $action): bool
{
    return withinTenant(tenantA(), fn () => DB::table('audit_events')->where(['entity' => 'Conciliación', 'entity_id' => $code, 'action' => $action])->exists());
}

it('rechazar una coincidencia sugerida deja la línea en excepción y el pago sigue pendiente y libre', function () {
    actingAsSeed('U07');
    $line = rowOf('fin_bank_lines', 'BNK-1');
    $payment = withinTenant(tenantA(), fn () => DB::table('fin_payments')->where('id', $line->matched_payment_id)->first());

    $this->postJson('/api/v1/finance/bank-lines/BNK-1/reject', [], critical())->assertOk()->assertJsonPath('data.code', 'BNK-1');

    $after = rowOf('fin_bank_lines', 'BNK-1');
    expect($after->status)->toBe('excepcion')
        ->and($after->matched_payment_id)->toBeNull()
        ->and($after->matched_payable_id)->toBeNull()
        ->and(rowOf('fin_payments', $payment->code)->status)->toBe($payment->status)
        ->and(withinTenant(tenantA(), fn () => DB::table('fin_bank_lines')->where('matched_payment_id', $payment->id)->exists()))->toBeFalse()
        ->and(finBnkAudit('BNK-1', 'rechazar_match'))->toBeTrue();
});

it('FIN-BR-53: solo se rechazan líneas con una sugerencia', function (string $code) {
    actingAsSeed('U07');
    $status = rowOf('fin_bank_lines', $code)->status;

    expect($this->postJson("/api/v1/finance/bank-lines/{$code}/reject", [], critical()))->toBeApiError(409, 'FIN-BR-53')
        ->and(rowOf('fin_bank_lines', $code)->status)->toBe($status);
})->with(['BNK-2', 'BNK-3']);

it('resolver una excepción de abono como otro ingreso concilia la línea con su sustento', function () {
    $user = actingAsSeed('U07');
    $before = $this->getJson('/api/v1/finance/bank-lines')->assertOk()->json('data.kpis');

    $this->postJson('/api/v1/finance/bank-lines/BNK-3/resolve', ['resolution' => 'otro_ingreso', 'note' => 'Devolución de garantía del hotel'], critical())->assertOk();

    $line = rowOf('fin_bank_lines', 'BNK-3');
    $after = $this->getJson('/api/v1/finance/bank-lines')->assertOk()->json('data');
    expect($line->status)->toBe('conciliado')
        ->and($line->resolution)->toBe('otro_ingreso')
        ->and($line->resolution_note)->toBe('Devolución de garantía del hotel')
        ->and($line->resolved_by)->toBe($user->id)
        ->and(collect($after['rows'])->firstWhere('code', 'BNK-3')['status'])->toBe('conciliado')
        ->and($after['kpis']['exceptions'])->toBe($before['exceptions'] - 1)
        ->and($after['kpis']['reconciled'])->toBe($before['reconciled'] + 1)
        ->and(finBnkAudit('BNK-3', 'resolver_excepcion'))->toBeTrue();
});

it('una sugerencia rechazada se resuelve después como otro ingreso sin tocar el pago', function () {
    actingAsSeed('U07');
    $payment = withinTenant(tenantA(), fn () => DB::table('fin_payments')->where('id', rowOf('fin_bank_lines', 'BNK-1')->matched_payment_id)->first());
    $this->postJson('/api/v1/finance/bank-lines/BNK-1/reject', [], critical())->assertOk();

    $this->postJson('/api/v1/finance/bank-lines/BNK-1/resolve', ['resolution' => 'otro_ingreso', 'note' => 'Abono de un cliente sin reserva'], critical())->assertOk();

    expect(rowOf('fin_bank_lines', 'BNK-1')->status)->toBe('conciliado')
        ->and(rowOf('fin_payments', $payment->code)->status)->toBe($payment->status);
});

it('FIN-BR-54: un abono no se resuelve como gasto bancario y una línea conciliada no se resuelve', function () {
    actingAsSeed('U07');

    expect($this->postJson('/api/v1/finance/bank-lines/BNK-3/resolve', ['resolution' => 'gasto_bancario', 'note' => 'Comisión de mantenimiento'], critical()))->toBeApiError(422, 'FIN-BR-54')
        ->and($this->postJson('/api/v1/finance/bank-lines/BNK-2/resolve', ['resolution' => 'otro_ingreso', 'note' => 'Abono de prueba'], critical()))->toBeApiError(409, 'FIN-BR-54')
        ->and(rowOf('fin_bank_lines', 'BNK-3')->status)->toBe('excepcion');
});

it('resolver exige sustento y una resolución válida', function () {
    actingAsSeed('U07');

    $this->postJson('/api/v1/finance/bank-lines/BNK-3/resolve', ['resolution' => 'ignorar', 'note' => 'ok'], critical())
        ->assertStatus(422)->assertJsonValidationErrors(['resolution', 'note']);
});

it('una línea de una conciliación cerrada no se rechaza ni se resuelve', function () {
    actingAsSeed('U07');
    withinTenant(tenantA(), function () {
        $closure = DB::table('fin_reconciliation_closures')->insertGetId(['code' => 'CRC-PEST', 'period' => '2026-09', 'closed_by' => seedUser('U07')->id, 'closed_at' => now(), 'lines_count' => 1, 'credits' => '350.00', 'debits' => '0.00', 'net' => '350.00', 'matched_count' => 0, 'others_count' => 1], 'id');
        DB::table('fin_bank_lines')->where('code', 'BNK-3')->update(['closure_id' => $closure]);
    });

    expect($this->postJson('/api/v1/finance/bank-lines/BNK-3/resolve', ['resolution' => 'otro_ingreso', 'note' => 'Devolución de garantía'], critical()))->toBeApiError(409, 'FIN-BR-55');
});

it('Gerencia y Contabilidad no operan la conciliación', function (string $user) {
    actingAsSeed($user);

    expect($this->postJson('/api/v1/finance/bank-lines/BNK-1/reject', [], critical()))->toBeApiError(403)
        ->and($this->postJson('/api/v1/finance/bank-lines/BNK-3/resolve', ['resolution' => 'otro_ingreso', 'note' => 'Devolución de garantía'], critical()))->toBeApiError(403);
})->with(['U02', 'U08']);
