<?php

use App\Domain\Platform\Support\PlanCatalog;
use Illuminate\Support\Facades\DB;

function platPlan(string $code): object
{
    return DB::connection('pgsql_platform')->table('plans')->where('code', $code)->first();
}

function platPlanLimits(string $code): array
{
    return DB::connection('pgsql_platform')->table('plan_limits')->where('plan_id', platPlan($code)->id)->pluck('value', 'metric')->all();
}

function platPlanBody(string $code, array $overrides = [], array $limits = []): array
{
    $plan = platPlan($code);

    return [
        'price_month' => (float) $plan->price_month,
        'price_year' => (float) $plan->price_year,
        'trial_days' => (int) $plan->trial_days,
        'support_level' => $plan->support_level,
        'limits' => [...collect(PlanCatalog::METRICS)->mapWithKeys(fn (string $metric) => [$metric => platPlanLimits($code)[$metric] ?? null])->all(), ...$limits],
        ...$overrides,
    ];
}

function platDowngradeBlockers(string $plan): array
{
    $response = test()->postJson('/api/v1/platform/tenants/'.tenantA()->getKey().'/change-plan', ['plan' => $plan, 'reason' => 'Prueba de bajada'], ['If-Match' => (string) DB::connection('pgsql_platform')->table('tenants')->where('id', tenantA()->getKey())->value('lock_version')]);

    return $response->status() === 422 ? (array) ($response->json('details.blockers') ?? $response->json('error.details.blockers')) : [];
}

it('actualiza precios, días de prueba y límites del plan y lo audita', function () {
    actingAsPlatform();

    $this->putJson('/api/v1/platform/plans/professional', platPlanBody('professional', ['price_month' => 1290, 'price_year' => 12900, 'trial_days' => 21, 'support_level' => 'Chat 8 h'], ['users' => 20, 'webhooks' => null]))
        ->assertOk()->assertJsonPath('data.code', 'professional');
    $plan = platPlan('professional');
    $limits = platPlanLimits('professional');

    expect((string) $plan->price_month)->toBe('1290.00')
        ->and((string) $plan->price_year)->toBe('12900.00')
        ->and((int) $plan->trial_days)->toBe(21)
        ->and($plan->support_level)->toBe('Chat 8 h')
        ->and($limits['users'])->toBe(20)
        ->and($limits['webhooks'])->toBeNull()
        ->and($limits['sedes'])->toBe(2)
        ->and(DB::connection('pgsql_platform')->table('audit_events')->whereNull('tenant_id')->where(['entity' => 'Plan', 'action' => 'editar_plan'])->orderByDesc('occurred_at')->value('after_value'))
        ->toContain('S/ 1290')->toContain('users=20')->toContain('webhooks=∞');
});

it('PLN-BR-01: el precio respeta el orden de los planes y el anual no supera 12 mensualidades', function (array $overrides) {
    actingAsPlatform();

    expect($this->putJson('/api/v1/platform/plans/professional', platPlanBody('professional', $overrides)))->toBeApiError(422, 'PLN-BR-01');
    expect((string) platPlan('professional')->price_month)->toBe('1190.00');
})->with([
    'igual o menor que Starter' => [['price_month' => 490]],
    'igual o mayor que Enterprise' => [['price_month' => 2890]],
    'anual mayor que 12 meses' => [['price_month' => 1190, 'price_year' => 14281]],
]);

it('valida los precios, los días de prueba y que vengan todos los límites', function (array $body, string $field) {
    actingAsPlatform();
    $payload = platPlanBody('professional');

    if (array_key_exists('drop_limit', $body)) {
        unset($payload['limits'][$body['drop_limit']]);
    } else {
        $payload = array_replace_recursive($payload, $body);
    }

    $this->putJson('/api/v1/platform/plans/professional', $payload)->assertStatus(422)->assertJsonValidationErrors($field);
})->with([
    'precio negativo' => [['price_month' => -1], 'price_month'],
    'prueba de 61 días' => [['trial_days' => 61], 'trial_days'],
    'límite negativo' => [['limits' => ['users' => -5]], 'limits.users'],
    'límite faltante' => [['drop_limit' => 'sedes'], 'limits.sedes'],
]);

it('un plan inexistente responde 404', function () {
    actingAsPlatform();

    expect($this->putJson('/api/v1/platform/plans/premium', platPlanBody('professional')))->toBeApiError(404);
});

it('SUB-BR-03: los límites nuevos del plan cambian la validación al bajar de plan', function () {
    actingAsPlatform();
    $before = platDowngradeBlockers('professional');

    expect(collect($before)->contains(fn (string $blocker) => str_contains($blocker, 'sedes activas')))->toBeTrue();

    $this->putJson('/api/v1/platform/plans/professional', platPlanBody('professional', limits: ['sedes' => null]))->assertOk();
    $after = platDowngradeBlockers('professional');

    expect(collect($after)->contains(fn (string $blocker) => str_contains($blocker, 'sedes activas')))->toBeFalse();

    $this->putJson('/api/v1/platform/plans/professional', platPlanBody('professional', limits: ['users' => 1]))->assertOk();

    expect(collect(platDowngradeBlockers('professional'))->contains(fn (string $blocker) => str_contains($blocker, 'usuarios activos y el plan permite 1')))->toBeTrue();
});

it('el Tenant Admin no edita planes', function () {
    actingAsSeed('U01');

    expect($this->putJson('/api/v1/platform/plans/professional', platPlanBody('professional'))->status())->toBeIn([401, 403]);
});
