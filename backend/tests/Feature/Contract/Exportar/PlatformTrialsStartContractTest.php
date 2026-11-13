<?php

use Illuminate\Database\ConnectionInterface;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

beforeEach(fn () => lockPlatformBilling());

function exportarPlatform(): ConnectionInterface
{
    return DB::connection('pgsql_platform');
}

function exportarSubscription(): ?object
{
    return exportarPlatform()->table('subscriptions')->where('tenant_id', tenantA()->getKey())->where('status', '<>', 'canceled')->first();
}

it('da una nueva prueba a una agencia con la prueba vencida en solo lectura y lo audita', function () {
    exportarPlatform()->table('subscriptions')->where('tenant_id', tenantA()->getKey())->update(['status' => 'suspended', 'trial_starts_at' => '2026-09-01', 'trial_ends_at' => '2026-09-15', 'trial_extended_days' => 7]);
    actingAsPlatform();
    $today = Carbon::today('America/Lima');

    $this->getJson('/api/v1/platform/trials')->assertOk()->assertJsonFragment(['code' => 'TNT-0001', 'reason' => 'Prueba vencida en solo lectura']);

    $response = $this->postJson('/api/v1/platform/trials', ['tenant' => 'TNT-0001', 'plan' => 'professional', 'days' => 30, 'reason' => 'Pidió más tiempo para evaluar'])->assertOk()
        ->assertJsonPath('data.status', 'trialing')
        ->assertJsonPath('data.plan.code', 'professional')
        ->assertJsonPath('data.days', 30);
    $subscription = exportarSubscription();
    $tenant = exportarPlatform()->table('tenants')->where('id', tenantA()->getKey())->first();

    expect($response->json('data.ends_at'))->toBe($today->copy()->addDays(30)->toDateString())
        ->and($subscription->status)->toBe('trialing')
        ->and($subscription->trial_starts_at)->toBe($today->toDateString())
        ->and($subscription->trial_ends_at)->toBe($today->copy()->addDays(30)->toDateString())
        ->and((int) $subscription->trial_extended_days)->toBe(0)
        ->and($tenant->status)->toBe('prueba')
        ->and($tenant->plan_id)->toBe(exportarPlatform()->table('plans')->where('code', 'professional')->value('id'))
        ->and(exportarPlatform()->table('audit_events')->whereNull('tenant_id')->where(['entity' => 'Tenant', 'entity_id' => 'TNT-0001', 'action' => 'iniciar_trial'])->value('after_value'))->toContain('30 días')->toContain('Pidió más tiempo');

    $this->getJson('/api/v1/platform/trials')->assertOk()->assertJsonFragment(['code' => 'TNT-0001', 'name' => $tenant->commercial_name, 'email' => $tenant->admin_email]);
});

it('crea la suscripción en prueba cuando la agencia no tiene una vigente, con los días del plan', function () {
    exportarPlatform()->table('subscriptions')->where('tenant_id', tenantA()->getKey())->update(['status' => 'canceled']);
    actingAsPlatform();
    $days = (int) exportarPlatform()->table('plans')->where('id', exportarPlatform()->table('tenants')->where('id', tenantA()->getKey())->value('plan_id'))->value('trial_days') ?: 14;

    $this->postJson('/api/v1/platform/trials', ['tenant' => 'TNT-0001', 'reason' => 'Reinicio comercial'])->assertOk()->assertJsonPath('data.days', $days);
    $subscription = exportarSubscription();

    expect($subscription->status)->toBe('trialing')
        ->and($subscription->code)->toStartWith('SUB-')
        ->and(exportarPlatform()->table('subscriptions')->where('tenant_id', tenantA()->getKey())->count())->toBe(2);
});

it('no da prueba a agencias con suscripción pagada, ya en prueba, suspendidas o inexistentes', function () {
    actingAsPlatform();
    $body = ['tenant' => 'TNT-0001', 'reason' => 'Prueba comercial'];

    expect($this->postJson('/api/v1/platform/trials', $body))->toBeApiError(409, 'SUBSCRIPTION_ACTIVE');

    exportarPlatform()->table('subscriptions')->where('tenant_id', tenantA()->getKey())->update(['status' => 'trialing', 'trial_ends_at' => '2026-12-01']);
    expect($this->postJson('/api/v1/platform/trials', $body))->toBeApiError(409, 'TRIAL_ACTIVE');

    exportarPlatform()->table('tenants')->where('id', tenantA()->getKey())->update(['status' => 'suspendido', 'suspend_reason' => 'Deuda vencida', 'suspended_at' => now()]);
    expect($this->postJson('/api/v1/platform/trials', $body))->toBeApiError(409, 'TENANT_SUSPENDED')
        ->and($this->postJson('/api/v1/platform/trials', [...$body, 'tenant' => 'TNT-9999']))->toBeApiError(404);
});

it('valida el motivo, los días y el plan', function () {
    exportarPlatform()->table('subscriptions')->where('tenant_id', tenantA()->getKey())->update(['status' => 'canceled']);
    actingAsPlatform();

    $this->postJson('/api/v1/platform/trials', ['tenant' => 'TNT-0001'])->assertStatus(422)->assertJsonValidationErrors('reason');
    $this->postJson('/api/v1/platform/trials', ['tenant' => 'TNT-0001', 'reason' => 'Prueba comercial', 'days' => 5])->assertStatus(422)->assertJsonValidationErrors('days');
    expect($this->postJson('/api/v1/platform/trials', ['tenant' => 'TNT-0001', 'reason' => 'Prueba comercial', 'plan' => 'gratis']))->toBeApiError(422, 'PLAN');
});

it('una cuenta de agencia no puede dar pruebas', function () {
    actingAsSeed('U01');

    $this->postJson('/api/v1/platform/trials', ['tenant' => 'TNT-0001', 'reason' => 'Prueba comercial'])->assertForbidden();
});
