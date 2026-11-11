<?php

use App\Domain\Finance\Actions\TreasurySync;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;

beforeEach(function () {
    lockSeededBookings();
    lockTreasury();
    Queue::fake();
});

function syncMovements(string $key): array
{
    return withinTenant(tenantA(), fn () => DB::table('fin_treasury_movements as m')->join('fin_treasury_accounts as a', 'a.id', '=', 'm.account_id')->where('m.source_key', $key)
        ->get(['m.code', DB::raw('trim(m.direction) as direction'), 'm.type', 'm.amount', 'm.currency', 'm.orig_amount', 'm.orig_currency', 'm.source_type', 'm.status', 'a.code as account'])->all());
}

function syncAudited(array $where): bool
{
    return withinTenant(tenantA(), fn () => DB::table('audit_events')->where($where)->exists());
}

function syncPaymentLock(string $code): int
{
    return (int) rowOf('fin_payments', $code)->lock_version;
}

function syncAccountBalance(object $test, string $code): float
{
    return (float) collect($test->getJson('/api/v1/treasury/accounts')->assertOk()->json('data.accounts'))->firstWhere('code', $code)['balance'];
}

it('TES-BR-04: validar un cobro genera un solo ingreso en la cuenta del medio de pago y sube el saldo del banco', function () {
    actingAsSeed('U07');
    $before = syncAccountBalance($this, 'CTA-04');

    $this->postJson('/api/v1/finance/payments/PAG-01922/confirm', [], critical(syncPaymentLock('PAG-01922')))->assertOk();

    $movements = syncMovements('PAG:PAG-01922');
    expect(rowOf('fin_payments', 'PAG-01922')->status)->toBe('aplicado')
        ->and($movements)->toHaveCount(1)
        ->and($movements[0]->account)->toBe('CTA-04')
        ->and($movements[0]->direction)->toBe('in')
        ->and($movements[0]->type)->toBe('collection')
        ->and($movements[0]->source_type)->toBe('payment')
        ->and((string) $movements[0]->amount)->toBe('510.00')
        ->and($movements[0]->currency)->toBe('USD')
        ->and(syncAccountBalance($this, 'CTA-04'))->toBe(round($before + 510, 2))
        ->and(syncAudited(['entity' => 'Movimiento de tesorería', 'entity_id' => $movements[0]->code, 'action' => 'sincronizar']))->toBeTrue();

    expect(withinTenant(tenantA(), fn () => app(TreasurySync::class)->payment(idOf('fin_payments', 'PAG-01922'), null)))->toBeNull()
        ->and(syncMovements('PAG:PAG-01922'))->toHaveCount(1);
});

it('TES-BR-04: un cobro en dólares por Plin entra en soles a Interbank y guarda el monto original', function () {
    actingAsSeed('U07');

    $code = $this->postJson('/api/v1/finance/payments', ['receivable_id' => 'CXC-00714', 'method' => 'plin', 'amount' => '100.00', 'fx_rate' => 3.8, 'paid_on' => BUSINESS_TODAY, 'reference' => 'PLIN-0091'], critical())->assertCreated()->json('data.payment');

    $movements = syncMovements("PAG:{$code}");
    expect($movements)->toHaveCount(1)
        ->and($movements[0]->account)->toBe('CTA-03')
        ->and($movements[0]->currency)->toBe('PEN')
        ->and((string) $movements[0]->amount)->toBe('380.00')
        ->and((string) $movements[0]->orig_amount)->toBe('100.00')
        ->and($movements[0]->orig_currency)->toBe('USD');
});

it('TES-BR-04: revertir un cobro genera un egreso en la misma cuenta y no se repite', function () {
    actingAsSeed('U07');
    $income = syncMovements('PAG:PAG-01921')[0];

    $this->postJson('/api/v1/finance/payments/PAG-01921/revert', ['reason' => 'Yape devuelto por el banco'], critical(syncPaymentLock('PAG-01921')))->assertOk();

    $reversal = syncMovements('REV:PAG-01921');
    expect($reversal)->toHaveCount(1)
        ->and($reversal[0]->account)->toBe($income->account)
        ->and($reversal[0]->direction)->toBe('out')
        ->and($reversal[0]->type)->toBe('collection_reversal')
        ->and($reversal[0]->source_type)->toBe('payment_reversal')
        ->and((string) $reversal[0]->amount)->toBe((string) $income->amount);

    expect($this->postJson('/api/v1/finance/payments/PAG-01921/revert', ['reason' => 'Otra vez la misma'], critical(syncPaymentLock('PAG-01921'))))->toBeApiError(409, 'FIN-BR-16')
        ->and(syncMovements('REV:PAG-01921'))->toHaveCount(1);
});

it('TES-BR-04: cada pago a proveedor genera un egreso en la cuenta de origen', function () {
    actingAsSeed('U07');
    $version = fn () => (string) rowOf('fin_payables', 'CXP-00402')->lock_version;

    $first = $this->postJson('/api/v1/finance/payables/CXP-00402/payouts', ['method' => 'transferencia', 'amount' => '1000.00', 'paid_on' => BUSINESS_TODAY, 'operation_ref' => 'OP-BBVA-1', 'bank_account' => 'CTA-05'], [...critical(), 'If-Match' => $version()])->assertCreated()->json('data.payout');
    $second = $this->postJson('/api/v1/finance/payables/CXP-00402/payouts', ['method' => 'transferencia', 'amount' => '500.00', 'paid_on' => BUSINESS_TODAY, 'operation_ref' => 'OP-2'], [...critical(), 'If-Match' => $version()])->assertCreated()->json('data.payout');

    $bbva = syncMovements("PPR:{$first}");
    $fallback = syncMovements("PPR:{$second}");
    expect($bbva)->toHaveCount(1)
        ->and($bbva[0]->account)->toBe('CTA-05')
        ->and($bbva[0]->direction)->toBe('out')
        ->and($bbva[0]->type)->toBe('supplier_payment')
        ->and((string) $bbva[0]->amount)->toBe('1000.00')
        ->and($fallback)->toHaveCount(1)
        ->and($fallback[0]->account)->toBe('CTA-01');
});

it('TES-BR-04: el crédito B2B y los reembolsos no mueven caja', function () {
    actingAsSeed('U07');
    $sync = app(TreasurySync::class);

    $id = idOf('fin_payments', 'PAG-01922');
    $as = fn (array $values) => withinTenant(tenantA(), fn () => DB::table('fin_payments')->where('id', $id)->update($values));

    $as(['method' => 'credito_b2b', 'status' => 'aplicado']);
    expect(withinTenant(tenantA(), fn () => $sync->payment($id, null)))->toBeNull();

    $as(['method' => 'transferencia_bcp', 'kind' => 'reembolso', 'status' => 'confirmado']);
    expect(withinTenant(tenantA(), fn () => $sync->payment($id, null)))->toBeNull()
        ->and(syncMovements('PAG:PAG-01922'))->toBeEmpty();
});

it('el reproceso registra lo que faltó, respeta los pagos ya sincronizados y es idempotente', function () {
    actingAsSeed('U07');
    withinTenant(tenantA(), fn () => DB::table('fin_payments')->where('code', 'PAG-01922')->update(['status' => 'confirmado']));

    $first = $this->postJson('/api/v1/treasury/sync', [], critical())->assertOk()->json('data');
    $second = $this->postJson('/api/v1/treasury/sync', [], critical())->assertOk()->json('data');

    expect($first['collections'])->toBeGreaterThanOrEqual(1)
        ->and(syncMovements('PAG:PAG-01922'))->toHaveCount(1)
        ->and(syncMovements('PAG:PAG-01921'))->toHaveCount(1)
        ->and(syncMovements('PPR:PPR-1002'))->toBeEmpty()
        ->and($second['total'])->toBe(0);

    actingAsSeed('U03');
    expect($this->postJson('/api/v1/treasury/sync', [], critical()))->toBeApiError(403);
});

it('la cuenta de cada medio de pago se configura por agencia y valida bancos y crédito B2B', function () {
    actingAsSeed('U01');
    $settings = $this->getJson('/api/v1/treasury/settings')->assertOk()->json('data');
    $yape = collect($settings['payment_routing'])->firstWhere('method', 'yape');

    expect($yape)->toMatchArray(['destination' => 'bank', 'bank' => 'BCP', 'currency' => 'PEN'])
        ->and($yape['accounts']['USD'])->not->toBeNull()
        ->and(collect($settings['payment_routing'])->firstWhere('method', 'credito_b2b')['destination'])->toBe('none')
        ->and($settings['routing_banks'])->toContain('BBVA');

    $this->patchJson('/api/v1/treasury/settings', ['payment_routing' => [['method' => 'yape', 'destination' => 'bank', 'bank' => 'BBVA', 'currency' => 'PEN']], 'lock_version' => $settings['lock_version']])->assertOk();
    expect(collect($this->getJson('/api/v1/treasury/settings')->json('data.payment_routing'))->firstWhere('method', 'yape')['bank'])->toBe('BBVA')
        ->and(syncAudited(['entity' => 'Configuración de tesorería', 'action' => 'editar']))->toBeTrue();

    expect($this->patchJson('/api/v1/treasury/settings', ['payment_routing' => [['method' => 'credito_b2b', 'destination' => 'bank', 'bank' => 'BCP']]]))->toBeApiError(422, 'TES-BR-04');
    expect($this->patchJson('/api/v1/treasury/settings', ['payment_routing' => [['method' => 'yape', 'destination' => 'bank', 'bank' => 'Banco Inexistente']]]))->toBeApiError(422);
    expect($this->patchJson('/api/v1/treasury/settings', ['payment_routing' => [['method' => 'yape', 'destination' => 'cofre']]]))->toBeApiError(422);

    actingAsSeed('U07');
    $code = $this->postJson('/api/v1/finance/payments', ['receivable_id' => 'CXC-00714', 'method' => 'yape', 'amount' => '50.00', 'fx_rate' => 3.8, 'paid_on' => BUSINESS_TODAY, 'reference' => 'YAPE-77'], critical())->assertCreated()->json('data.payment');
    expect(syncMovements("PAG:{$code}")[0]->account)->toBe('CTA-05');
});
