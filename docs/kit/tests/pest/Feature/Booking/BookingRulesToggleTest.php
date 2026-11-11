<?php

/*
| Reglas activables del motor vía API (esp. 16 §6.1 `/public/quote`; 17 §3.1 regla efectiva, §5 regla de oro,
| CR-01/CR-02, PLN-R-01; 13 PLN-BR-04). El precio lo calcula solo el backend (PRD-BR-010, WG-03).
| Casos: regla apagada → sin efecto; plan sin la regla → sin efecto y 403 al activarla; configuración conservada.
*/

use Illuminate\Support\Facades\DB;

require_once __DIR__.'/../../Datasets/prd011.php';

function publicQuote(array $sel)
{
    // Clave pública del widget del tenant A (channel_widget_config.public_key) + Origin verificado (WG-01/02)
    $key = withinTenant(tenantA(), fn () => DB::table('channel_widget_config')->value('public_key'));

    return test()->withHeaders(['X-KipuControl-Key' => $key, 'Origin' => 'https://andeshorizonte.pe'])
        ->postJson('/api/v1/public/quote', ['product' => 'PRD-011'] + $sel);
}

function setRule(string $code, bool $enabled): void
{
    actingAsSeed('U01');
    $lv = withinTenant(tenantA(), fn () => DB::table('sys_booking_rules')->where('code', $code)->value('lock_version'));
    test()->patchJson("/api/v1/admin/booking-rules/{$code}", ['enabled' => $enabled], ['If-Match' => (string) $lv])->assertSuccessful();
}

function setTenantPlan(string $plan): void
{
    app(\App\Domain\Platform\Actions\ChangeTenantPlan::class)->handle(tenantA(), strtolower($plan), effective: 'immediate', force: true);
}

it('POST /public/quote devuelve el caso canónico PRD-011 igual que el prototipo', function () {
    $q = publicQuote(prd011Selection())->assertOk()->json('data');

    expect($q['total'])->toBe(PRD011_EXPECTED_PEN['total'])
        ->and($q['deposit'])->toBe(PRD011_EXPECTED_PEN['deposit'])
        ->and($q['balance'])->toBe(PRD011_EXPECTED_PEN['balance'])
        ->and($q['rooms'])->toBe(8)->and($q['nights'])->toBe(9)
        ->and($q['currency'])->toBe('PEN');
});

it('regla apagada → sin efecto: R-LODGING ignora el alojamiento', function () {
    setRule('R-LODGING', false);
    $q = publicQuote(prd011Selection())->assertOk()->json('data');

    expect($q['total'])->toBe(PRD011_VARIANTS['rule_off_lodging']['total'])
        ->and($q['rooms'])->toBe(0)
        ->and(collect($q['lines'])->where('kind', 'lodging'))->toBeEmpty();
});

it('regla apagada → sin efecto: R-PREVIEW-REMOVE no permite quitar ítems', function () {
    setRule('R-PREVIEW-REMOVE', false);
    $q = publicQuote(prd011Selection(['removed' => ['addon-ADD-1101']]))->assertOk()->json('data');

    expect($q['total'])->toBe(PRD011_EXPECTED_PEN['total'])
        ->and(collect($q['lines'])->contains('removable', true))->toBeFalse();
});

it('regla apagada → sin efecto: R-DEPOSIT deja solo pago total', function () {
    setRule('R-DEPOSIT', false);
    $q = publicQuote(prd011Selection())->assertOk()->json('data');

    expect($q['payment_mode'])->toBe('total')->and($q['modes'])->toBe(['total'])->and($q['balance'])->toBe('0.00');
});

it('regla apagada → R-MULTICURRENCY: moneda distinta de PEN → 422 (17 §10.5)', function () {
    setRule('R-MULTICURRENCY', false);

    publicQuote(prd011Selection(['currency' => 'USD']))->assertUnprocessable();
});

it('plan sin la regla → sin efecto: en Starter R-LODGING y R-ADDONS no aplican aunque estén enabled', function () {
    setTenantPlan('Starter');
    $q = publicQuote(prd011Selection())->assertOk()->json('data');

    expect($q['total'])->toBe(PRD011_VARIANTS['plan_starter']['total'])
        ->and(collect($q['lines'])->whereIn('kind', ['lodging', 'addon']))->toBeEmpty();

    // La configuración se conserva (enabled sigue true) para cuando el tenant mejore de plan
    expect(withinTenant(tenantA(), fn () => DB::table('sys_booking_rules')->where('code', 'R-LODGING')->value('enabled')))->toBeTrue();
});

it('plan sin la regla → activarla responde 403 RULE_NOT_IN_PLAN', function () {
    setTenantPlan('Starter');
    actingAsSeed('U01');
    $lv = withinTenant(tenantA(), fn () => DB::table('sys_booking_rules')->where('code', 'R-GROUP-DISC')->value('lock_version'));

    expect($this->patchJson('/api/v1/admin/booking-rules/R-GROUP-DISC', ['enabled' => true], ['If-Match' => (string) $lv]))
        ->toBeApiError(403, 'RULE_NOT_IN_PLAN');
});

it('al volver a Professional la regla recupera su efecto sin reconfigurar', function () {
    setTenantPlan('Starter');
    setTenantPlan('Professional');

    expect(publicQuote(prd011Selection())->json('data.total'))->toBe(PRD011_EXPECTED_PEN['total']);
});

it('la vista previa por plan no cambia la suscripción (GET ?plan=Starter)', function () {
    actingAsSeed('U01');
    $rules = collect($this->getJson('/api/v1/admin/booking-rules?plan=Starter')->assertOk()->json('data'))->keyBy('code');

    expect($rules['R-LODGING']['effective'])->toBeFalse()
        ->and($rules['R-LODGING']['enabled'])->toBeTrue()
        ->and(tenantA()->fresh()->plan)->toBe('Enterprise');
});

it('CR-02: una excepción por producto no puede activar una regla inactiva del tenant', function () {
    setRule('R-GROUP-DISC', false); // inactiva en semilla; se reafirma
    actingAsSeed('U01');
    $pid = idOf(\App\Domain\Catalog\Models\Product::class, 'PRD-011');

    $this->putJson("/api/v1/catalog/products/{$pid}/rule-overrides/R-GROUP-DISC", ['disabled' => false, 'params' => ['pct' => 10]])
        ->assertStatus(422);
});

it('CR-01: parámetros inválidos → 422 (adelanto 100 %)', function () {
    actingAsSeed('U01');
    $lv = withinTenant(tenantA(), fn () => DB::table('sys_booking_rules')->where('code', 'R-DEPOSIT')->value('lock_version'));

    $this->patchJson('/api/v1/admin/booking-rules/R-DEPOSIT', ['params' => ['pct' => 100, 'balanceDueDays' => 15]], ['If-Match' => (string) $lv])
        ->assertUnprocessable();
});

it('el cambio de regla invalida la caché rules:{tenant} de inmediato', function () {
    publicQuote(prd011Selection())->assertOk();     // calienta la caché
    setRule('R-LODGING', false);

    expect(publicQuote(prd011Selection())->json('data.rooms'))->toBe(0);
});
