<?php

use Illuminate\Support\Facades\DB;

function simProducto(): string
{
    return (string) withinTenant(tenantA(), fn () => DB::table('catalog_products as p')->join('catalog_rates as r', 'r.product_id', '=', 'p.id')->whereNull('p.deleted_at')->where('r.status', 'vigente')->orderBy('p.code')->value('p.code'));
}

it('el simulador devuelve el estado del día, la cotización y las reglas que intervienen', function () {
    actingAsSeed('U01');

    $data = $this->postJson('/api/v1/admin/booking-rules/simulate', ['product' => simProducto(), 'date' => '2026-10-20', 'adt' => 2, 'chd' => 1])->assertOk()->json('data');

    expect($data['day'])->toHaveKeys(['status', 'label'])
        ->and($data['quote'])->toHaveKeys(['total', 'lines', 'payment_mode', 'modes'])
        ->and($data['pax']['seats'])->toBe(3)
        ->and($data['current_plan'])->toBeTrue()
        ->and(collect($data['rules'])->pluck('code'))->toContain('R-CUTOFF');
});

it('simular como otro plan cambia solo el cálculo y no la suscripción', function () {
    actingAsSeed('U01');
    $plan = withinTenant(tenantA(), fn () => (string) DB::table('tenants as t')->join('plans as p', 'p.id', '=', 't.plan_id')->where('t.id', tenantA()->getKey())->value('p.name'));

    $data = $this->postJson('/api/v1/admin/booking-rules/simulate', ['product' => simProducto(), 'date' => '2026-10-20', 'adt' => 2, 'plan' => 'Starter'])->assertOk()->json('data');
    $restricted = collect($data['rules'])->filter(fn (array $rule): bool => ! $rule['plan_allows']);

    expect($data['plan'])->toBe('Starter')
        ->and($data['current_plan'])->toBeFalse()
        ->and($restricted->every(fn (array $rule): bool => $rule['effective'] === false))->toBeTrue()
        ->and(withinTenant(tenantA(), fn () => (string) DB::table('tenants as t')->join('plans as p', 'p.id', '=', 't.plan_id')->where('t.id', tenantA()->getKey())->value('p.name')))->toBe($plan);
});

it('el simulador valida producto, fecha, pasajeros y plan, y es solo de la administración', function () {
    actingAsSeed('U01');
    $this->postJson('/api/v1/admin/booking-rules/simulate', ['product' => '', 'date' => '20-10-2026', 'adt' => 99, 'plan' => 'Galáctico'])->assertStatus(422)->assertJsonValidationErrors(['product', 'date', 'adt', 'plan']);
    expect($this->postJson('/api/v1/admin/booking-rules/simulate', ['product' => 'PRD-NOPE', 'date' => '2026-10-20', 'adt' => 1]))->toBeApiError(422, 'VALIDATION_ERROR');

    actingAsSeed('U02');
    expect($this->postJson('/api/v1/admin/booking-rules/simulate', ['product' => simProducto(), 'date' => '2026-10-20', 'adt' => 1]))->toBeApiError(403);
});

it('las monedas se activan, se marcan de cobro y respetan FX-02', function () {
    actingAsSeed('U01');
    $list = collect($this->getJson('/api/v1/finance/currencies')->assertOk()->json('data.currencies'))->keyBy('code');

    expect($list['PEN']['is_base'])->toBeTrue()
        ->and($list['PEN']['is_charge'])->toBeTrue()
        ->and($list['USD']['is_charge'])->toBeTrue()
        ->and($list['EUR']['is_charge'])->toBeFalse();

    $this->patchJson('/api/v1/finance/currencies/EUR', ['is_charge' => true])->assertOk()->assertJsonPath('data.is_charge', true);
    expect($this->patchJson('/api/v1/finance/currencies/EUR', ['active' => false]))->toBeApiError(422, 'FX-02')
        ->and($this->patchJson('/api/v1/finance/currencies/PEN', ['active' => false]))->toBeApiError(422, 'FX-02')
        ->and($this->patchJson('/api/v1/finance/currencies/ARS', ['is_charge' => true]))->toBeApiError(422, 'FX-02');

    $this->patchJson('/api/v1/finance/currencies/GBP', ['active' => false])->assertOk();
    $ecommerce = json_decode((string) withinTenant(tenantA(), fn () => DB::table('sys_settings')->where('section', 'ecommerce')->value('values')), true);

    expect(rowOf('fin_currencies', 'GBP')->active)->toBeFalse()
        ->and($ecommerce['chargeCurrencies'])->toBe(['PEN', 'EUR', 'USD'])
        ->and(withinTenant(tenantA(), fn () => DB::table('audit_events')->where('entity', 'Moneda')->where('entity_id', 'EUR')->exists()))->toBeTrue();
});

it('el margen de conversión va de 0 a 15 y ajusta el tipo de cambio al cliente', function () {
    actingAsSeed('U01');

    $this->patchJson('/api/v1/finance/fx-settings', ['margin_pct' => 16, 'alert_pct' => 0])->assertStatus(422)->assertJsonValidationErrors(['margin_pct', 'alert_pct']);
    $this->patchJson('/api/v1/finance/fx-settings', ['margin_pct' => 15, 'alert_pct' => 4])->assertOk()->assertJsonPath('data.margin_pct', 15);

    $usd = collect($this->getJson('/api/v1/finance/currencies')->assertOk()->json('data.currencies'))->firstWhere('code', 'USD');
    $params = json_decode((string) withinTenant(tenantA(), fn () => DB::table('sys_booking_rules')->where('code', 'R-MULTICURRENCY')->value('params')), true);

    expect((float) $params['fxMarginPct'])->toBe(15.0)
        ->and($usd['client_rate'])->toBe(round($usd['rate'] * 0.85, 4));
});

it('Finanzas consulta las monedas pero no las activa ni cambia el margen', function () {
    actingAsSeed('U07');

    $this->getJson('/api/v1/finance/currencies')->assertOk();
    expect($this->patchJson('/api/v1/finance/currencies/USD', ['active' => false]))->toBeApiError(403)
        ->and($this->patchJson('/api/v1/finance/fx-settings', ['margin_pct' => 3, 'alert_pct' => 3]))->toBeApiError(403);
});
