<?php

use Illuminate\Support\Facades\DB;

require_once __DIR__.'/../../Datasets/prd011.php';

beforeEach(function () {
    requireRoute('POST', '/api/v1/public/quote');
    requireRoute('PATCH', '/api/v1/admin/booking-rules/R-LODGING');
});

function publicQuote(array $selection)
{
    $key = withinTenant(tenantA(), fn () => DB::table('channel_widget_config')->value('public_key'));

    return test()->withHeaders(['X-KipuControl-Key' => (string) $key, 'Origin' => 'https://www.andeshorizonte.pe'])
        ->postJson('/api/v1/public/quote', ['product' => 'PER-CIR-10D'] + $selection);
}

function ruleLockVersion(string $code): int
{
    return (int) withinTenant(tenantA(), fn () => DB::table('sys_booking_rules')->where('code', $code)->value('lock_version'));
}

function setRule(string $code, bool $enabled): void
{
    actingAsSeed('U01');

    if ((bool) withinTenant(tenantA(), fn () => DB::table('sys_booking_rules')->where('code', $code)->value('enabled')) === $enabled) {
        return;
    }

    test()->patchJson("/api/v1/admin/booking-rules/{$code}", ['enabled' => $enabled], critical(ruleLockVersion($code)))->assertSuccessful();
}

function setTenantPlan(string $plan): void
{
    test()->markTestSkipped("Fase B: falta App\\Domain\\Platform\\Actions\\ChangeTenantPlan para pasar el tenant a {$plan} (PLN-R-01, 13 PLN-BR-04).");
}

it('POST /public/quote devuelve el caso canónico PRD-011 igual que el prototipo', function () {
    $quote = publicQuote(prd011Selection())->assertOk()->json('data');

    expect($quote['total'])->toBe(PRD011_EXPECTED_PEN['total'])
        ->and($quote['deposit'])->toBe(PRD011_EXPECTED_PEN['deposit'])
        ->and($quote['balance'])->toBe(PRD011_EXPECTED_PEN['balance'])
        ->and($quote['rooms'])->toBe(8)
        ->and($quote['nights'])->toBe(9)
        ->and($quote['currency'])->toBe('PEN');
});

it('regla apagada sin efecto: R-LODGING ignora el alojamiento', function () {
    setRule('R-LODGING', false);
    $quote = publicQuote(prd011Selection())->assertOk()->json('data');

    expect($quote['total'])->toBe(PRD011_VARIANTS['rule_off_lodging']['total'])
        ->and($quote['rooms'])->toBe(0)
        ->and(collect($quote['lines'])->where('kind', 'lodging'))->toBeEmpty();
});

it('regla apagada sin efecto: R-PREVIEW-REMOVE no permite quitar ítems (17 §10.5, difiere del prototipo)', function () {
    setRule('R-PREVIEW-REMOVE', false);
    $quote = publicQuote(prd011Selection(['removed' => ['addon-ADD-1101']]))->assertOk()->json('data');

    expect($quote['total'])->toBe(PRD011_EXPECTED_PEN['total'])
        ->and(collect($quote['lines'])->contains('removable', true))->toBeFalse();
});

it('regla apagada sin efecto: R-DEPOSIT deja solo pago total', function () {
    setRule('R-DEPOSIT', false);
    $quote = publicQuote(prd011Selection())->assertOk()->json('data');

    expect($quote['payment_mode'])->toBe('total')
        ->and($quote['modes'])->toBe(['total'])
        ->and($quote['balance'])->toBe('0.00');
});

it('regla apagada R-MULTICURRENCY: moneda distinta de PEN responde 422 (17 §10.5)', function () {
    setRule('R-MULTICURRENCY', false);

    publicQuote(prd011Selection(['currency' => 'USD']))->assertUnprocessable();
});

it('plan sin la regla: en Starter R-LODGING y R-ADDONS no aplican aunque estén activas', function () {
    setTenantPlan('Starter');
    $quote = publicQuote(prd011Selection())->assertOk()->json('data');

    expect($quote['total'])->toBe(PRD011_VARIANTS['plan_starter']['total'])
        ->and(collect($quote['lines'])->whereIn('kind', ['lodging', 'addon']))->toBeEmpty()
        ->and(withinTenant(tenantA(), fn () => DB::table('sys_booking_rules')->where('code', 'R-LODGING')->value('enabled')))->toBeTrue();
});

it('plan sin la regla: activarla responde 403 RULE_NOT_IN_PLAN', function () {
    setTenantPlan('Starter');
    actingAsSeed('U01');

    expect($this->patchJson('/api/v1/admin/booking-rules/R-GROUP-DISC', ['enabled' => true], critical(ruleLockVersion('R-GROUP-DISC'))))
        ->toBeApiError(403, 'RULE_NOT_IN_PLAN');
});

it('al volver a Professional la regla recupera su efecto sin reconfigurar', function () {
    setTenantPlan('Starter');
    setTenantPlan('Professional');

    expect(publicQuote(prd011Selection())->json('data.total'))->toBe(PRD011_EXPECTED_PEN['total']);
});

it('la vista previa por plan no cambia la suscripción (GET ?plan=Starter)', function () {
    actingAsSeed('U01');
    $rules = collect($this->getJson('/api/v1/admin/booking-rules?plan=Starter')->assertOk()->json('data.rules'))->keyBy('code');

    expect($rules['R-LODGING']['effective'])->toBeFalse()
        ->and($rules['R-LODGING']['enabled'])->toBeTrue()
        ->and(tenantA()->plan_id)->toBe(DB::connection('pgsql_platform')->table('plans')->where('code', 'enterprise')->value('id'));
});

it('CR-02: una excepción por producto no puede activar una regla inactiva del tenant', function () {
    requireRoute('PUT', '/api/v1/catalog/products/PER-CIR-10D/rule-overrides/R-GROUP-DISC');
    setRule('R-GROUP-DISC', false);
    actingAsSeed('U01');

    $this->putJson('/api/v1/catalog/products/PER-CIR-10D/rule-overrides/R-GROUP-DISC', ['disabled' => false, 'params' => ['pct' => 10]])
        ->assertStatus(422);
});

it('CR-01: parámetros inválidos responden 422 (adelanto 100 %)', function () {
    actingAsSeed('U01');

    $this->patchJson('/api/v1/admin/booking-rules/R-DEPOSIT', ['params' => ['pct' => 100, 'balanceDueDays' => 15]], critical(ruleLockVersion('R-DEPOSIT')))
        ->assertUnprocessable();
});

it('el cambio de regla invalida la caché rules:{tenant} de inmediato', function () {
    publicQuote(prd011Selection())->assertOk();
    setRule('R-LODGING', false);

    expect(publicQuote(prd011Selection())->json('data.rooms'))->toBe(0);
});
