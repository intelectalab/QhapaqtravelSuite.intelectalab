<?php

use Carbon\CarbonImmutable;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;

function finFxLatest(string $currency = 'USD'): object
{
    return withinTenant(tenantA(), fn () => DB::table('fin_fx_rates')->where('currency_code', $currency)->orderByDesc('rate_date')->orderByDesc('effective_at')->first());
}

function finFxRegister(array $body)
{
    Carbon::setTestNow();
    CarbonImmutable::setTestNow();

    try {
        actingAsSeed('U07');

        return test()->postJson('/api/v1/finance/fx-rates', ['rate_date' => BUSINESS_TODAY, ...$body], critical());
    } finally {
        freezeBusinessToday();
    }
}

function finFxUsdReservation(): string
{
    $departure = withinTenant(tenantA(), fn () => DB::table('catalog_product_departures as d')->join('catalog_products as p', 'p.id', '=', 'd.product_id')
        ->where('p.code', 'CUS-MAPI-FD')->where('d.departure_date', '>=', '2026-10-05')->whereRaw('d.capacity - d.sold >= 2')->orderBy('d.departure_date')->value('d.id'));

    return (string) test()->postJson('/api/v1/reservations', ['client_id' => 'CLI-0003', 'product_id' => 'CUS-MAPI-FD', 'departure_id' => $departure, 'adt' => 2, 'confirm' => true], critical())
        ->assertCreated()->json('data.code');
}

beforeEach(fn () => Queue::fake());

it('registrar un tipo de cambio lo deja vigente con el anterior como referencia y queda auditado', function () {
    $previous = finFxLatest();

    finFxRegister(['currency' => 'USD', 'rate' => '3.8125', 'buy' => '3.80', 'sell' => '3.82', 'source' => 'SBS cierre'])
        ->assertCreated()->assertJsonPath('data.currency', 'USD');

    $latest = finFxLatest();
    expect((string) $latest->rate_pen)->toBe('3.812500')
        ->and((string) $latest->previous_rate)->toBe((string) $previous->rate_pen)
        ->and($latest->rate_date)->toBe(BUSINESS_TODAY)
        ->and($latest->source)->toBe('SBS cierre')
        ->and(withinTenant(tenantA(), fn () => DB::table('audit_events')->where(['entity' => 'Tipo de cambio', 'entity_id' => 'USD', 'action' => 'registrar'])->where('after_value', 'like', '3.8125%')->exists()))->toBeTrue();
});

it('sin fecha, el tipo de cambio se registra con la fecha de hoy de la agencia', function () {
    actingAsSeed('U07');

    $this->postJson('/api/v1/finance/fx-rates', ['currency' => 'EUR', 'rate' => '4.0555', 'source' => 'SBS'], critical())->assertCreated();

    expect(withinTenant(tenantA(), fn () => DB::table('fin_fx_rates')->where('currency_code', 'EUR')->where('rate_pen', '4.0555')->value('rate_date')))->toBe(BUSINESS_TODAY);
});

it('el tipo de cambio nuevo es el que usan las reservas en USD del día, incluso si se corrige el mismo día', function () {
    finFxRegister(['currency' => 'USD', 'rate' => '3.7990', 'source' => 'Manual diario'])->assertCreated();
    finFxRegister(['currency' => 'USD', 'rate' => '3.8210', 'source' => 'Corrección SBS'])->assertCreated();

    actingAsSeed('U01');
    $code = finFxUsdReservation();

    expect(reservationRow($code)->currency)->toBe('USD')
        ->and((string) reservationRow($code)->fx_rate)->toBe('3.821000');
});

it('CFG-BR-06: no se registra dos veces el mismo tipo de cambio para la misma fecha', function () {
    actingAsSeed('U07');
    $body = ['currency' => 'EUR', 'rate' => '4.1234', 'source' => 'SBS'];
    $this->postJson('/api/v1/finance/fx-rates', $body, critical())->assertCreated();
    $count = withinTenant(tenantA(), fn () => DB::table('fin_fx_rates')->where('currency_code', 'EUR')->count());

    expect($this->postJson('/api/v1/finance/fx-rates', $body, critical()))->toBeApiError(409, 'CFG-BR-06')
        ->and(withinTenant(tenantA(), fn () => DB::table('fin_fx_rates')->where('currency_code', 'EUR')->count()))->toBe($count);
});

it('valida el rango del tipo de cambio, la fecha y la compra frente a la venta', function () {
    actingAsSeed('U07');
    $count = withinTenant(tenantA(), fn () => DB::table('fin_fx_rates')->count());

    $this->postJson('/api/v1/finance/fx-rates', ['currency' => 'USD', 'rate' => '25', 'source' => 'SBS'], critical())->assertStatus(422)->assertJsonValidationErrors(['rate']);
    $this->postJson('/api/v1/finance/fx-rates', ['currency' => 'USD', 'rate' => '3.8', 'rate_date' => '2026-09-30', 'source' => 'SBS'], critical())->assertStatus(422)->assertJsonValidationErrors(['rate_date']);
    $this->postJson('/api/v1/finance/fx-rates', ['currency' => 'XYZ', 'rate' => '3.8', 'source' => 'SBS'], critical())->assertStatus(422)->assertJsonValidationErrors(['currency']);
    expect($this->postJson('/api/v1/finance/fx-rates', ['currency' => 'USD', 'rate' => '3.8', 'buy' => '3.85', 'sell' => '3.81', 'source' => 'SBS'], critical()))->toBeApiError(422, 'VALIDATION_ERROR')
        ->and(withinTenant(tenantA(), fn () => DB::table('fin_fx_rates')->count()))->toBe($count);
});

it('Ventas y Operaciones no registran tipos de cambio', function (string $user) {
    actingAsSeed($user);

    expect($this->postJson('/api/v1/finance/fx-rates', ['currency' => 'USD', 'rate' => '3.9', 'source' => 'SBS'], critical()))->toBeApiError(403);
})->with(['U03', 'U05']);
