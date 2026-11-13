<?php

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;

beforeEach(fn () => Queue::fake());

function g4UserId(string $code): string
{
    return withinTenant(tenantA(), fn () => (string) DB::table('iam_users')->where('code', $code)->value('id'));
}

function g4PettyCash(object $test): string
{
    return $test->postJson('/api/v1/treasury/accounts', ['kind' => 'petty_cash', 'name' => 'Caja chica G4', 'currency' => 'PEN', 'opening_balance' => 500, 'fund_amount' => 500, 'custodian_id' => g4UserId('U07')])->assertCreated()->json('data.code');
}

function g4Expense(array $extra = []): array
{
    return ['amount' => 20, 'category' => 'Movilidad local', 'description' => 'Taxi a la oficina', 'receipt_type' => 'invoice', 'series_number' => 'F001-77', 'issuer_ruc' => '20123456789', 'supplier' => 'Taxi Seguro', ...$extra];
}

it('una caja cerrada hoy no se vuelve a abrir el mismo día y responde con un mensaje de negocio', function () {
    actingAsSeed('U01');
    $cash = g4PettyCash($this);

    $this->postJson("/api/v1/treasury/petty-cash/{$cash}/sessions", ['counted' => 500])->assertCreated();
    $this->postJson("/api/v1/treasury/petty-cash/{$cash}/counts", ['kind' => 'closing', 'denominations' => ['100' => 5], 'declaration' => true])->assertCreated();

    expect($this->postJson("/api/v1/treasury/petty-cash/{$cash}/sessions", ['counted' => 500]))->toBeApiError(409, 'TES-BR-06');
    expect(collect($this->getJson('/api/v1/treasury/accounts')->json('data.accounts'))->firstWhere('code', $cash)['session_today'])->toBe('closed');
});

it('el arqueo exige la declaración del responsable cuando se envía sin marcar', function () {
    actingAsSeed('U01');
    $cash = g4PettyCash($this);
    $this->postJson("/api/v1/treasury/petty-cash/{$cash}/sessions", ['counted' => 500])->assertCreated();

    $this->postJson("/api/v1/treasury/petty-cash/{$cash}/counts", ['kind' => 'surprise', 'denominations' => ['100' => 5], 'declaration' => false])->assertUnprocessable();
    $this->postJson("/api/v1/treasury/petty-cash/{$cash}/counts", ['kind' => 'surprise', 'denominations' => ['100' => 5], 'declaration' => true])->assertCreated();
});

it('no se transfiere efectivo a una caja chica sin abrir hoy (TES-BR-05)', function () {
    actingAsSeed('U01');
    $cash = g4PettyCash($this);

    expect($this->postJson('/api/v1/treasury/transfers', ['from' => 'CTA-01', 'to' => $cash, 'amount' => 50, 'date' => now()->toDateString(), 'reference' => 'OP-G4', 'description' => 'Fondeo de caja']))->toBeApiError(409, 'TES-BR-05');

    $this->postJson("/api/v1/treasury/petty-cash/{$cash}/sessions", ['counted' => 500])->assertCreated();
    $this->postJson('/api/v1/treasury/transfers', ['from' => 'CTA-01', 'to' => $cash, 'amount' => 50, 'date' => now()->toDateString(), 'reference' => 'OP-G4', 'description' => 'Fondeo de caja'])->assertCreated();
});

it('el gasto rechaza un comprobante repetido y una reserva inexistente con mensaje de negocio', function () {
    actingAsSeed('U01');
    $cash = g4PettyCash($this);
    $this->postJson("/api/v1/treasury/petty-cash/{$cash}/sessions", ['counted' => 500])->assertCreated();

    $this->postJson("/api/v1/treasury/petty-cash/{$cash}/expenses", g4Expense())->assertCreated();
    expect($this->postJson("/api/v1/treasury/petty-cash/{$cash}/expenses", g4Expense()))->toBeApiError(409, 'TES-BR-12');
    expect($this->postJson("/api/v1/treasury/petty-cash/{$cash}/expenses", g4Expense(['series_number' => 'F001-78', 'reservation' => 'RES-2099-000001'])))->toBeApiError(422);
    expect($this->postJson("/api/v1/treasury/petty-cash/{$cash}/expenses", g4Expense(['series_number' => 'F001-79', 'amount' => 900])))->toBeApiError(422, 'TES-BR-11');
});

it('el resumen de tesorería trae composición, saldo de 28 días, proyección a 30 días, estado de cada caja y auditoría por movimiento', function () {
    actingAsSeed('U07');

    $data = $this->getJson('/api/v1/treasury/accounts')->assertOk()->json('data');

    expect($data['composition'])->toHaveCount(4)
        ->and($data['balance_history'])->toHaveCount(10)
        ->and(end($data['balance_history'])['pen'])->toEqual($data['kpis']['total_pen'])
        ->and($data['kpis'])->toHaveKey('projected_30_pen')
        ->and($data['options'])->toHaveKeys(['threshold_pct', 'petty_tolerance', 'expense_categories', 'reservations'])
        ->and($data['movements'][0])->toHaveKey('audit')
        ->and(collect($data['accounts'])->firstWhere('kind', 'petty_cash'))->toHaveKeys(['session_today', 'cci', 'custodian_id', 'sede_id']);
});

it('el flujo proyectado respeta los interruptores, desglosa por concepto y arma 13 semanas', function () {
    actingAsSeed('U07');

    $full = $this->getJson('/api/v1/treasury/cash-flow')->assertOk()->json('data');
    $lean = $this->getJson('/api/v1/treasury/cash-flow?include_overdue=0&include_fixed=0')->assertOk()->json('data');
    $month = $this->getJson('/api/v1/treasury/cash-flow?horizon=30')->assertOk()->json('data');

    expect($full['weeks'])->toHaveCount(13)
        ->and($full['horizons'][0])->toHaveKeys(['opening', 'cxc', 'cxp', 'commissions', 'fixed', 'closing'])
        ->and($full['options'])->toBe(['include_overdue' => true, 'include_fixed' => true])
        ->and(collect($lean['items'])->where('type', 'fixed'))->toBeEmpty()
        ->and(collect($lean['items'])->where('type', 'cxc')->where('overdue', true))->toBeEmpty()
        ->and(collect($month['items'])->every(fn (array $item) => $item['date'] <= now()->addDays(30)->toDateString()))->toBeTrue();
    $this->getJson('/api/v1/treasury/cash-flow?horizon=45')->assertUnprocessable();
});

it('el libro de la cuenta trae el origen de cada movimiento y el saldo en soles', function () {
    actingAsSeed('U07');

    $ledger = $this->getJson('/api/v1/treasury/accounts/CTA-01/movements')->assertOk()->json('data');

    expect($ledger)->toHaveKeys(['balance_pen', 'usd_rate', 'categories'])
        ->and($ledger['movements'][0] ?? ['origin' => null, 'balance' => '0'])->toHaveKeys(['origin', 'balance', 'receipt']);
});

it('la apertura y cierre diario dice quién cerró', function () {
    actingAsSeed('U01');
    $cash = g4PettyCash($this);
    $this->postJson("/api/v1/treasury/petty-cash/{$cash}/sessions", ['counted' => 500])->assertCreated();
    $this->postJson("/api/v1/treasury/petty-cash/{$cash}/counts", ['kind' => 'closing', 'denominations' => ['100' => 5]])->assertCreated();

    $session = collect($this->getJson('/api/v1/treasury/accounts')->json('data.sessions'))->firstWhere('account_code', $cash);

    expect($session['closed_by'])->not->toBeNull()->and($session['count'])->not->toBeNull();
});

it('la diferencia cambiaria detalla la diferencia realizada por operación', function () {
    actingAsSeed('U07');

    $rows = $this->getJson('/api/v1/treasury/fx/revaluation-preview')->assertOk()->json('data.rows');

    expect($rows)->not->toBeEmpty()->and($rows[0])->toHaveKey('realized_operations');
});
