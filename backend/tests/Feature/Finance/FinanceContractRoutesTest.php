<?php

use Illuminate\Support\Facades\DB;

beforeEach(fn () => lockTreasury());

it('la conciliación bancaria responde en /finance/bank-lines', function () {
    actingAsSeed('U07');

    $this->getJson('/api/v1/finance/bank-lines')->assertOk();
    $this->postJson('/api/v1/finance/bank-lines/BNK-1/confirm', [], critical())->assertOk()->assertJsonPath('data.code', 'BNK-1');

    expect($this->getJson('/api/v1/finance/reconciliation')->status())->toBe(404)
        ->and(routeExists('POST', '/api/v1/finance/reconciliation/BNK-1/confirm'))->toBeFalse();
});

it('el pago de una cuota se registra en POST /finance/payments', function () {
    actingAsSeed('U07');
    $before = (string) rowOf('fin_receivables', 'CXC-00713')->paid_amount;

    $this->postJson('/api/v1/finance/payments', ['receivable_id' => 'CXC-00713', 'method' => 'transferencia_bcp', 'amount' => '10.00', 'paid_on' => BUSINESS_TODAY, 'reference' => 'OP-PEST'], critical())->assertCreated();

    expect(withinTenant(tenantA(), fn () => DB::table('fin_payments')->where('reference', 'OP-PEST')->exists()))->toBeTrue()
        ->and((string) rowOf('fin_receivables', 'CXC-00713')->paid_amount)->not->toBe($before)
        ->and(routeExists('POST', '/api/v1/finance/receivables/CXC-00713/payments'))->toBeFalse();
});

it('la tesorería responde en /treasury/accounts y /treasury/movements', function () {
    actingAsSeed('U07');

    $this->getJson('/api/v1/treasury/accounts')->assertOk()->assertJsonStructure(['data' => ['accounts', 'movements', 'kpis']]);
    $code = $this->postJson('/api/v1/treasury/movements', ['account' => 'CTA-01', 'direction' => 'in', 'amount' => '15.00', 'date' => BUSINESS_TODAY, 'category' => 'Intereses bancarios', 'description' => 'Ingreso de prueba', 'reference' => 'OP-0001'], critical())->assertCreated()->json('data.code');
    $this->postJson("/api/v1/treasury/movements/{$code}/void", ['reason' => 'Registro de prueba'], critical())->assertOk();

    expect(rowOf('fin_treasury_movements', $code)->status)->not->toBe('posted')
        ->and($this->getJson('/api/v1/finance/treasury')->status())->toBe(404)
        ->and(routeExists('POST', '/api/v1/finance/treasury/movements'))->toBeFalse();
});
