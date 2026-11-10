<?php

use Illuminate\Support\Facades\DB;

function platFeatureValue(string $feature, string $plan): ?string
{
    $db = DB::connection('pgsql_platform');

    return $db->table('plan_features')->where('plan_id', $db->table('plans')->where('code', $plan)->value('id'))->where('feature_key', $feature)->value('value');
}

function platOverride(string $tenant, string $feature): ?object
{
    $db = DB::connection('pgsql_platform');

    return $db->table('feature_overrides')->where('tenant_id', $db->table('tenants')->where('code', $tenant)->value('id'))->where('feature_key', $feature)->first();
}

function platPlatformAudit(string $entityId, string $action): ?string
{
    return DB::connection('pgsql_platform')->table('audit_events')->whereNull('tenant_id')->where(['entity' => 'Feature flag', 'entity_id' => $entityId, 'action' => $action])->orderByDesc('occurred_at')->value('after_value');
}

function platBlockersTo(string $plan): array
{
    $response = test()->postJson('/api/v1/platform/tenants/'.tenantA()->getKey().'/change-plan', ['plan' => $plan], ['If-Match' => (string) DB::connection('pgsql_platform')->table('tenants')->where('id', tenantA()->getKey())->value('lock_version')]);

    return $response->status() === 422 ? (array) ($response->json('details.blockers') ?? $response->json('error.details.blockers')) : [];
}

function platOverrideBody(array $overrides = []): array
{
    return ['tenant' => 'TNT-0002', 'feature' => 'module.ecommerce', 'value' => true, 'reason' => 'Piloto de tienda en línea por tres meses', 'valid_until' => '2026-12-15', ...$overrides];
}

it('incluye un módulo en un plan, recalcula sus módulos y lo audita', function () {
    actingAsPlatform();
    $modules = (int) DB::connection('pgsql_platform')->table('plans')->where('code', 'professional')->value('module_count');

    $this->putJson('/api/v1/platform/features/module.ecommerce/plans/professional', ['value' => 'incluido'])->assertOk()->assertJsonPath('data.plan', 'professional');

    expect(platFeatureValue('module.ecommerce', 'professional'))->toBe('incluido')
        ->and((int) DB::connection('pgsql_platform')->table('plans')->where('code', 'professional')->value('module_count'))->toBe($modules + 1)
        ->and(platPlatformAudit('module.ecommerce@professional', 'plan_entitlement'))->toStartWith('incluido');

    $this->putJson('/api/v1/platform/features/module.ecommerce/plans/professional', ['value' => null])->assertOk();

    expect(platFeatureValue('module.ecommerce', 'professional'))->toBeNull()
        ->and((int) DB::connection('pgsql_platform')->table('plans')->where('code', 'professional')->value('module_count'))->toBe($modules);
});

it('SUB-BR-03: incluir o quitar un módulo del plan cambia la validación al bajar de plan', function () {
    actingAsPlatform();
    $shop = fn (array $blockers) => collect($blockers)->contains(fn (string $blocker) => str_contains($blocker, 'tienda en línea'));

    expect($shop(platBlockersTo('professional')))->toBeTrue();

    $this->putJson('/api/v1/platform/features/module.ecommerce/plans/professional', ['value' => 'incluido'])->assertOk();
    expect($shop(platBlockersTo('professional')))->toBeFalse();

    $this->putJson('/api/v1/platform/features/module.ecommerce/plans/professional', ['value' => ''])->assertOk();
    expect($shop(platBlockersTo('professional')))->toBeTrue();
});

it('la matriz por plan responde 404 a una funcionalidad o un plan inexistentes', function () {
    actingAsPlatform();

    expect($this->putJson('/api/v1/platform/features/module.nada/plans/professional', ['value' => 'incluido']))->toBeApiError(404)
        ->and($this->putJson('/api/v1/platform/features/module.crm/plans/premium', ['value' => 'incluido']))->toBeApiError(404);
    $this->putJson('/api/v1/platform/features/module.crm/plans/starter', ['value' => str_repeat('x', 21)])->assertStatus(422)->assertJsonValidationErrors('value');
});

it('crea una excepción por agencia, la muestra en la matriz y la audita', function () {
    actingAsPlatform();

    $this->postJson('/api/v1/platform/feature-overrides', platOverrideBody())->assertCreated()->assertJsonPath('data.saved', true);
    $override = platOverride('TNT-0002', 'module.ecommerce');

    expect((bool) $override->value)->toBeTrue()
        ->and($override->valid_until)->toBe('2026-12-15')
        ->and($override->granted_by)->toBe(platformUser()->getKey())
        ->and(platPlatformAudit('module.ecommerce@TNT-0002', 'override'))->toStartWith('habilitado hasta 15/12/2026')
        ->and(json_encode($this->getJson('/api/v1/platform/features')->assertOk()->json('data'), JSON_UNESCAPED_UNICODE))->toContain('Piloto de tienda en línea');
});

it('una segunda excepción para la misma agencia y funcionalidad reemplaza la primera', function () {
    actingAsPlatform();
    $this->postJson('/api/v1/platform/feature-overrides', platOverrideBody())->assertCreated();

    $this->postJson('/api/v1/platform/feature-overrides', platOverrideBody(['value' => false, 'reason' => 'Se bloquea mientras revisan pagos', 'valid_until' => '2026-10-31']))->assertCreated();
    $db = DB::connection('pgsql_platform');

    expect($db->table('feature_overrides')->where('tenant_id', tenantB()->getKey())->where('feature_key', 'module.ecommerce')->count())->toBe(1)
        ->and((bool) platOverride('TNT-0002', 'module.ecommerce')->value)->toBeFalse()
        ->and(platOverride('TNT-0002', 'module.ecommerce')->valid_until)->toBe('2026-10-31');
});

it('PLN-BR-03: la excepción dura como máximo 180 días y no vence en el pasado', function (string $until) {
    actingAsPlatform();

    expect($this->postJson('/api/v1/platform/feature-overrides', platOverrideBody(['valid_until' => $until])))->toBeApiError(422, 'PLN-BR-03');
    expect(platOverride('TNT-0002', 'module.ecommerce'))->toBeNull();
})->with(['más de 180 días' => ['2027-03-29'], 'en el pasado' => ['2026-09-28']]);

it('la excepción exige agencia, funcionalidad y motivo válidos', function (array $body, ?string $code, ?string $field) {
    actingAsPlatform();
    $response = $this->postJson('/api/v1/platform/feature-overrides', platOverrideBody($body));

    $code ? expect($response)->toBeApiError(422, $code) : $response->assertStatus(422)->assertJsonValidationErrors($field);
})->with([
    'agencia inexistente' => [['tenant' => 'TNT-9999'], 'TENANT', null],
    'funcionalidad inexistente' => [['feature' => 'module.nada'], 'FEATURE', null],
    'motivo corto' => [['reason' => 'Corto'], null, 'reason'],
    'sin vigencia' => [['valid_until' => null], null, 'valid_until'],
]);

it('quitar la excepción devuelve la agencia a lo que dice su plan y lo audita', function () {
    actingAsPlatform();
    $this->postJson('/api/v1/platform/feature-overrides', platOverrideBody())->assertCreated();
    $id = platOverride('TNT-0002', 'module.ecommerce')->id;

    $this->deleteJson("/api/v1/platform/feature-overrides/{$id}")->assertOk()->assertJsonPath('data.deleted', true);

    expect(platOverride('TNT-0002', 'module.ecommerce'))->toBeNull()
        ->and(platPlatformAudit('module.ecommerce@TNT-0002', 'quitar_override'))->toStartWith('rige el plan');
    expect($this->deleteJson("/api/v1/platform/feature-overrides/{$id}"))->toBeApiError(404)
        ->and($this->deleteJson('/api/v1/platform/feature-overrides/no-es-uuid'))->toBeApiError(404);
});

it('el Tenant Admin no toca la matriz ni las excepciones', function () {
    actingAsSeed('U01');

    expect($this->putJson('/api/v1/platform/features/module.ecommerce/plans/professional', ['value' => 'incluido'])->status())->toBeIn([401, 403])
        ->and($this->postJson('/api/v1/platform/feature-overrides', platOverrideBody())->status())->toBeIn([401, 403]);
    expect(platOverride('TNT-0002', 'module.ecommerce'))->toBeNull();
});
