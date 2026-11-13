<?php

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;

beforeEach(function () {
    lockTreasury();
    Queue::fake();
});

function treasuryUser(string $code): string
{
    return withinTenant(tenantA(), fn () => DB::table('iam_users')->where('code', $code)->value('id'));
}

function newPettyCash(object $test): string
{
    return $test->postJson('/api/v1/treasury/accounts', ['kind' => 'petty_cash', 'name' => 'Caja chica de prueba', 'currency' => 'PEN', 'opening_balance' => 500, 'fund_amount' => 500, 'custodian_id' => treasuryUser('U07')])->assertCreated()->json('data.code');
}

it('createTreasuryAccounts da de alta y edita cuentas, y su libro calcula el saldo acumulado', function () {
    actingAsSeed('U01');

    $code = newPettyCash($this);
    $this->patchJson("/api/v1/treasury/accounts/{$code}", ['name' => 'Caja chica Miraflores'])->assertOk();
    $ledger = $this->getJson("/api/v1/treasury/accounts/{$code}/movements")->assertOk()->json('data');

    expect($ledger['name'])->toBe('Caja chica Miraflores')
        ->and($ledger['balance'])->toBe('500.00')
        ->and($this->getJson('/api/v1/treasury/accounts')->json('data'))->toHaveKeys(['counts', 'alerts', 'options']);
    expect($this->patchJson("/api/v1/treasury/accounts/{$code}", ['active' => false]))->toBeApiError(409, 'TES-BR-08');
    expect($this->postJson('/api/v1/treasury/accounts', ['kind' => 'petty_cash', 'name' => 'Sin fondo', 'currency' => 'PEN']))->toBeApiError(422);
});

it('createTreasuryTransfers mueve saldo entre cuentas y convierte con el tipo pactado', function () {
    actingAsSeed('U07');

    $before = $this->getJson('/api/v1/treasury/accounts/CTA-02/movements')->json('data.balance');
    $code = $this->postJson('/api/v1/treasury/transfers', ['from' => 'CTA-01', 'to' => 'CTA-02', 'amount' => 375, 'deal_rate' => 3.75, 'date' => now()->toDateString(), 'reference' => 'OP-778899', 'description' => 'Compra de dólares'])->assertCreated()->json('data.code');
    $after = $this->getJson('/api/v1/treasury/accounts/CTA-02/movements')->json('data.balance');

    expect($code)->toStartWith('TRF-')
        ->and(round((float) $after - (float) $before, 2))->toBe(100.0);
    expect($this->postJson('/api/v1/treasury/transfers', ['from' => 'CTA-01', 'to' => 'CTA-01', 'amount' => 1, 'date' => now()->toDateString(), 'reference' => 'X', 'description' => 'Mismo']))->toBeApiError(422);
    expect($this->postJson('/api/v1/treasury/transfers', ['from' => 'CTA-01', 'to' => 'CTA-03', 'amount' => 99999999, 'date' => now()->toDateString(), 'reference' => 'X', 'description' => 'Demasiado']))->toBeApiError(422, 'TES-BR-02');
});

it('createTreasuryGatewaySettlements liquida la pasarela al banco descontando la comisión', function () {
    actingAsSeed('U07');
    $this->postJson('/api/v1/treasury/transfers', ['from' => 'CTA-01', 'to' => 'CTA-11', 'amount' => 300, 'date' => now()->toDateString(), 'reference' => 'OP-PASARELA', 'description' => 'Fondeo de prueba de la pasarela'])->assertCreated();

    $code = $this->postJson('/api/v1/treasury/gateway/CTA-11/settlements', ['gross' => 100, 'fee_pct' => 4, 'date' => now()->toDateString(), 'batch' => 'LOTE-001'])->assertCreated()->json('data.code');
    $types = collect($this->getJson('/api/v1/treasury/accounts/CTA-11/movements')->json('data.movements'))->pluck('type');

    expect($code)->toStartWith('TRF-')->and($types)->toContain('gateway_fee', 'gateway_settlement');
    expect($this->postJson('/api/v1/treasury/gateway/CTA-01/settlements', ['gross' => 1, 'date' => now()->toDateString(), 'batch' => 'X']))->toBeApiError(422);
});

it('caja chica: apertura, gasto con comprobante, arqueo con diferencia, aprobación por otra persona y visto bueno', function () {
    actingAsSeed('U01');
    $cash = newPettyCash($this);

    $this->postJson("/api/v1/treasury/petty-cash/{$cash}/sessions", ['counted' => 500])->assertCreated();
    expect($this->postJson("/api/v1/treasury/petty-cash/{$cash}/sessions", ['counted' => 500]))->toBeApiError(409, 'TES-BR-06');

    $this->postJson("/api/v1/treasury/petty-cash/{$cash}/expenses", ['amount' => 50, 'category' => 'Movilidad', 'description' => 'Taxi al aeropuerto', 'receipt_type' => 'sales_receipt', 'series_number' => 'B001-123', 'supplier' => 'Taxi Seguro'])->assertCreated();
    expect($this->postJson("/api/v1/treasury/petty-cash/{$cash}/expenses", ['amount' => 900, 'category' => 'Movilidad', 'description' => 'Muy alto', 'receipt_type' => 'ticket', 'series_number' => 'T-1', 'supplier' => 'X']))->toBeApiError(422, 'TES-BR-11');

    expect($this->postJson("/api/v1/treasury/petty-cash/{$cash}/counts", ['kind' => 'closing', 'denominations' => ['200' => 2, '20' => 1]]))->toBeApiError(422, 'TES-BR-13');
    $count = $this->postJson("/api/v1/treasury/petty-cash/{$cash}/counts", ['kind' => 'closing', 'denominations' => ['200' => 2, '20' => 1], 'note' => 'Faltan 30 soles de un vuelto'])->assertCreated()->json('data.code');

    expect($this->postJson("/api/v1/treasury/counts/{$count}/approve"))->toBeApiError(403, 'TES-BR-14');
    actingAsSeed('U07');
    $this->postJson("/api/v1/treasury/counts/{$count}/approve", ['note' => 'Revisado con la custodia'])->assertOk();
    $this->postJson("/api/v1/treasury/counts/{$count}/validate")->assertOk();

    expect($this->getJson("/api/v1/treasury/accounts/{$cash}/movements")->json('data.balance'))->toBe('420.00');
});

it('reposición de caja: solicitar, aprobar por otra persona, rechazar y pagar desde un banco', function () {
    actingAsSeed('U01');
    $cash = newPettyCash($this);
    $this->postJson("/api/v1/treasury/petty-cash/{$cash}/sessions", ['counted' => 500])->assertCreated();
    $this->postJson("/api/v1/treasury/petty-cash/{$cash}/expenses", ['amount' => 120, 'category' => 'Útiles', 'description' => 'Papel y tinta', 'receipt_type' => 'sales_receipt', 'series_number' => 'B002-9', 'supplier' => 'Librería'])->assertCreated();

    $first = $this->postJson("/api/v1/treasury/petty-cash/{$cash}/replenishments", ['note' => 'Fin de semana'])->assertCreated()->json('data.code');
    expect($this->postJson("/api/v1/treasury/replenishments/{$first}/approve"))->toBeApiError(403, 'TES-BR-14');

    actingAsSeed('U07');
    $this->postJson("/api/v1/treasury/replenishments/{$first}/reject", ['reason' => 'Falta rendir un comprobante'])->assertOk();

    actingAsSeed('U01');
    $second = $this->postJson("/api/v1/treasury/petty-cash/{$cash}/replenishments")->assertCreated()->json('data.code');
    actingAsSeed('U07');
    $this->postJson("/api/v1/treasury/replenishments/{$second}/approve")->assertOk();
    $transfer = $this->postJson("/api/v1/treasury/replenishments/{$second}/pay", ['from' => 'CTA-01', 'date' => now()->toDateString(), 'reference' => 'OP-555'])->assertCreated()->json('data.code');

    expect($transfer)->toStartWith('TRF-')
        ->and($this->getJson("/api/v1/treasury/accounts/{$cash}/movements")->json('data.balance'))->toBe('500.00');
});

it('el flujo proyectado agrupa cobros, pagos y egresos fijos en 30, 60 y 90 días', function () {
    actingAsSeed('U07');

    $flow = $this->getJson('/api/v1/treasury/cash-flow')->assertOk()->json('data');

    expect($flow['horizons'])->toHaveCount(3)
        ->and($flow['horizons'][0])->toHaveKeys(['label', 'in', 'out', 'net', 'closing'])
        ->and(collect($flow['items'])->pluck('source'))->toContain('Egreso fijo');
});

it('TES-BR-07 la apertura debe coincidir con el saldo del último cierre y el gasto va el mismo día', function () {
    actingAsSeed('U01');
    $cash = newPettyCash($this);

    expect($this->postJson("/api/v1/treasury/petty-cash/{$cash}/sessions", ['counted' => 480]))->toBeApiError(409, 'TES-BR-07');
    $this->postJson("/api/v1/treasury/petty-cash/{$cash}/sessions", ['counted' => 500])->assertCreated();
    expect($this->postJson("/api/v1/treasury/petty-cash/{$cash}/expenses", ['amount' => 10, 'category' => 'Movilidad', 'description' => 'Taxi', 'receipt_type' => 'ticket', 'series_number' => 'T-9', 'supplier' => 'Taxi', 'date' => now()->subDays(3)->toDateString()]))->toBeApiError(422, 'TES-BR-05');
});

it('una diferencia dentro de la tolerancia se ajusta al firmar el arqueo', function () {
    actingAsSeed('U01');
    $cash = newPettyCash($this);
    $this->postJson("/api/v1/treasury/petty-cash/{$cash}/sessions", ['counted' => 500])->assertCreated();

    $this->postJson("/api/v1/treasury/petty-cash/{$cash}/counts", ['kind' => 'closing', 'denominations' => ['200' => 2, '50' => 1, '20' => 2, '5' => 1], 'note' => 'Faltan 5 soles'])->assertCreated();

    expect($this->getJson("/api/v1/treasury/accounts/{$cash}/movements")->json('data.balance'))->toBe('495.00');
});

it('la reposición rinde los gastos pendientes, el rechazo los libera y un gasto rendido no se anula', function () {
    actingAsSeed('U01');
    $cash = newPettyCash($this);
    $this->postJson("/api/v1/treasury/petty-cash/{$cash}/sessions", ['counted' => 500])->assertCreated();
    $expense = $this->postJson("/api/v1/treasury/petty-cash/{$cash}/expenses", ['amount' => 80, 'category' => 'Útiles', 'description' => 'Papel', 'receipt_type' => 'sales_receipt', 'series_number' => 'B003-1', 'supplier' => 'Librería'])->assertCreated()->json('data.code');

    $code = $this->postJson("/api/v1/treasury/petty-cash/{$cash}/replenishments")->assertCreated()->json('data.code');
    $replenishment = withinTenant(tenantA(), fn () => DB::table('fin_cash_replenishments')->where('code', $code)->first(['id', 'amount']));
    expect((string) $replenishment->amount)->toBe('80.00')
        ->and(withinTenant(tenantA(), fn () => DB::table('fin_treasury_movements')->where('code', $expense)->value('replenishment_id')))->toBe($replenishment->id);
    expect($this->postJson("/api/v1/treasury/movements/{$expense}/void", ['reason' => 'Error de registro']))->toBeApiError(409, 'TES-BR-10');

    actingAsSeed('U07');
    $this->postJson("/api/v1/treasury/replenishments/{$code}/reject", ['reason' => 'Falta un comprobante'])->assertOk();
    expect(withinTenant(tenantA(), fn () => DB::table('fin_treasury_movements')->where('code', $expense)->value('replenishment_id')))->toBeNull();
});

it('anular una transferencia anula sus dos partidas, también la que paga una reposición', function () {
    actingAsSeed('U07');
    $transfer = rowOf('fin_treasury_movements', 'MOV-000004');

    $this->postJson('/api/v1/treasury/movements/MOV-000004/void', ['reason' => 'Se registró dos veces'])->assertOk();
    $legs = withinTenant(tenantA(), fn () => DB::table('fin_treasury_movements')->where('transfer_id', $transfer->transfer_id)->pluck('status')->unique()->values()->all());
    expect($legs)->toBe(['voided']);

    $payment = rowOf('fin_treasury_movements', 'MOV-000016');
    $this->postJson('/api/v1/treasury/movements/MOV-000016/void', ['reason' => 'Transferencia equivocada'])->assertOk();
    expect(withinTenant(tenantA(), fn () => DB::table('fin_treasury_movements')->where('transfer_id', $payment->transfer_id)->pluck('status')->unique()->values()->all()))->toBe(['voided']);
});
