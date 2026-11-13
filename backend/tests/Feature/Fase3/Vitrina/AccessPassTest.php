<?php

use App\Domain\Platform\Support\Entitlements;
use Illuminate\Support\Facades\DB;

beforeEach(fn () => lockPlatformBilling());

function vitrinaPass(array $extra = []): array
{
    return ['tenant' => 'TNT-0003', 'days' => 30, 'price' => 0, 'features' => ['module.crm', 'module.quotes', 'module.cms'], 'reason' => 'Agencia captada en la vitrina', 'convert_to' => 'starter', ...$extra];
}

it('lista pases, funciones y add-ons para la consola', function () {
    actingAsPlatform();
    $code = $this->postJson('/api/v1/platform/access-passes', vitrinaPass(['tenant' => 'TNT-0002']), critical())->assertOk()->json('data.code');
    $data = $this->getJson('/api/v1/platform/access-passes')->assertOk()->json('data');

    expect(collect($data['items'])->firstWhere('code', $code)['days_left'])->toBe(30)
        ->and(collect($data['addons'])->pluck('code'))->toContain('paypal_gateway')
        ->and($data['features'])->not->toBeEmpty();
});

it('VT-06: crea un pase con funciones que se activan por excepción y un segundo pase activo responde 409', function () {
    actingAsPlatform();

    $pass = $this->postJson('/api/v1/platform/access-passes', vitrinaPass(), critical())->assertOk()->json('data');
    $tenant = tenantByCode('TNT-0003');
    $row = DB::connection('pgsql_platform')->table('platform_access_passes')->where('code', $pass['code'])->first();

    expect($row->status)->toBe('activo')
        ->and($row->ends_on)->toBe('2026-10-29')
        ->and(app(Entitlements::class)->enabled((string) $tenant->getKey(), 'module.cms'))->toBeTrue()
        ->and(DB::connection('pgsql_platform')->table('audit_events')->whereNull('tenant_id')->where(['entity' => 'Pase', 'entity_id' => $pass['code'], 'action' => 'crear'])->exists())->toBeTrue();

    expect($this->postJson('/api/v1/platform/access-passes', vitrinaPass(), critical()))->toBeApiError(409, 'VT-06');
});

it('VT-06: extender respeta el máximo de 60 días', function () {
    actingAsPlatform();
    $code = $this->postJson('/api/v1/platform/access-passes', vitrinaPass(['days' => 50]), critical())->assertOk()->json('data.code');

    $this->postJson("/api/v1/platform/access-passes/{$code}/extend", ['days' => 7])->assertOk()->assertJsonPath('data.ends_on', '2026-11-25');
    expect($this->postJson("/api/v1/platform/access-passes/{$code}/extend", ['days' => 7]))->toBeApiError(422, 'VT-06');
    expect(DB::connection('pgsql_platform')->table('feature_overrides')->where('reason', "Pase {$code}")->value('valid_until'))->toBe('2026-11-25');
});

it('convertir pasa la agencia al plan y quita las excepciones del pase; revocar cierra el pase', function () {
    actingAsPlatform();
    $code = $this->postJson('/api/v1/platform/access-passes', vitrinaPass(['tenant' => 'TNT-0004']), critical())->assertOk()->json('data.code');

    $this->postJson("/api/v1/platform/access-passes/{$code}/convert", ['plan' => 'enterprise'], critical())->assertOk()->assertJsonPath('data.status', 'convertido');
    expect(DB::connection('pgsql_platform')->table('tenants as t')->join('plans as p', 'p.id', '=', 't.plan_id')->where('t.code', 'TNT-0004')->value('p.code'))->toBe('enterprise')
        ->and(DB::connection('pgsql_platform')->table('feature_overrides')->where('reason', "Pase {$code}")->exists())->toBeFalse()
        ->and(DB::connection('pgsql_platform')->table('platform_funnel_events')->where('kind', 'plan_pagado')->where('tenant_id', tenantByCode('TNT-0004')->getKey())->exists())->toBeTrue();

    $other = $this->postJson('/api/v1/platform/access-passes', vitrinaPass(['tenant' => 'TNT-0002']), critical())->assertOk()->json('data.code');
    expect($this->postJson("/api/v1/platform/access-passes/{$other}/revoke", ['reason' => 'Pidió darse de baja'])->assertOk()->json('data.status'))->toBe('revocado');
    expect($this->postJson("/api/v1/platform/access-passes/{$other}/revoke", []))->toBeApiError(409, 'VT-06')
        ->and(DB::connection('pgsql_platform')->table('feature_overrides')->where('reason', "Pase {$other}")->exists())->toBeFalse();
});

it('un pase pagado sin suscripción pide crearlo como cortesía', function () {
    actingAsPlatform();
    $tenant = DB::connection('pgsql_platform')->table('tenants as t')->whereNotExists(fn ($q) => $q->from('subscriptions as s')->whereColumn('s.tenant_id', 't.id'))->whereNotExists(fn ($q) => $q->from('platform_access_passes as p')->whereColumn('p.tenant_id', 't.id')->where('p.status', 'activo'))->value('code');

    if ($tenant === null) {
        $this->markTestSkipped('Todas las agencias tienen suscripción.');
    }

    expect($this->postJson('/api/v1/platform/access-passes', vitrinaPass(['tenant' => $tenant, 'price' => 149]), critical()))->toBeApiError(422, 'PASS-BILLING');
});

it('VT-07: el add-on se configura con pago único, mensual o ambos y valida sus precios', function () {
    actingAsPlatform();

    expect($this->patchJson('/api/v1/platform/addons/trip_builder/billing', ['billing_mode' => 'ambos', 'price_once' => 690]))->toBeApiError(422, 'VT-07');
    $this->patchJson('/api/v1/platform/addons/trip_builder/billing', ['billing_mode' => 'unico', 'price_once' => 720])->assertOk();

    $addon = DB::connection('pgsql_platform')->table('addons')->where('code', 'trip_builder')->first();
    expect($addon->billing_mode)->toBe('unico')->and((string) $addon->price_once)->toBe('720.00');
    $this->patchJson('/api/v1/platform/addons/no-existe/billing', ['billing_mode' => 'mensual', 'price_month' => 10])->assertNotFound();
});
