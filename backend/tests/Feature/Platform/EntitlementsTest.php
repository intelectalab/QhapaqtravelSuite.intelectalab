<?php

use App\Domain\Platform\Support\Entitlements;
use App\Http\Middleware\EnsureFeature;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;

beforeEach(function () {
    lockPlatformBilling();
    $this->withoutMiddleware(ThrottleRequests::class);
    Queue::fake();
    freezeBusinessToday();
    Entitlements::flush();
});

function entOverride(string $feature, bool $value, int $days = 30): void
{
    DB::connection('pgsql_platform')->table('feature_overrides')->insert([
        'tenant_id' => tenantA()->getKey(),
        'feature_key' => $feature,
        'value' => $value,
        'reason' => 'Prueba de derechos por plan',
        'valid_until' => Carbon::today()->addDays($days)->toDateString(),
        'granted_by' => platformUser()->getKey(),
    ]);
    Entitlements::flush();
}

function entPlan(string $code): void
{
    $db = DB::connection('pgsql_platform');
    $db->table('tenants')->where('id', tenantA()->getKey())->update(['plan_id' => $db->table('plans')->where('code', $code)->value('id')]);
    Entitlements::flush();
}

function entFeatures(): array
{
    return app(Entitlements::class)->for((string) tenantA()->getKey());
}

it('resuelve cada funcionalidad desde el plan de la agencia', function () {
    $features = entFeatures();

    expect($features['module.marketing_campaigns'])->toMatchArray(['enabled' => true, 'source' => 'plan', 'level' => 'incluido'])
        ->and($features)->toHaveKey('module.custom_domain');

    entPlan('starter');
    $starter = entFeatures();

    expect($starter['module.quotes']['enabled'])->toBeTrue()
        ->and($starter['module.marketing_campaigns'])->toMatchArray(['enabled' => false, 'source' => 'none', 'level' => null])
        ->and($starter['module.operations']['enabled'])->toBeFalse();
});

it('una excepción vigente gana al plan y una vencida deja de regir (ENT-BR-01, PLN-BR-03)', function () {
    entOverride('module.marketing_campaigns', false);
    expect(entFeatures()['module.marketing_campaigns'])->toMatchArray(['enabled' => false, 'source' => 'override']);

    DB::connection('pgsql_platform')->table('feature_overrides')->where('tenant_id', tenantA()->getKey())->update(['valid_until' => Carbon::yesterday()->toDateString()]);
    Entitlements::flush();
    expect(entFeatures()['module.marketing_campaigns'])->toMatchArray(['enabled' => true, 'source' => 'plan']);

    entPlan('starter');
    entOverride('module.ecommerce', true);
    expect(entFeatures()['module.ecommerce'])->toMatchArray(['enabled' => true, 'source' => 'override']);
});

it('un adicional activo habilita su funcionalidad aunque el plan no la incluya', function () {
    $db = DB::connection('pgsql_platform');
    $subscription = $db->table('subscriptions')->where('tenant_id', tenantA()->getKey())->value('id');
    $db->table('subscription_items')->where('subscription_id', $subscription)->where('addon_code', 'mobile_apps')->delete();
    entPlan('starter');

    expect(entFeatures()['module.mobile_apps']['enabled'])->toBeFalse();

    $db->table('subscription_items')->insert(['subscription_id' => $subscription, 'addon_code' => 'mobile_apps', 'quantity' => 1, 'unit_price' => 0, 'starts_at' => Carbon::today()->toDateString()]);
    Entitlements::flush();

    expect(entFeatures()['module.mobile_apps'])->toMatchArray(['enabled' => true, 'source' => 'addon']);
});

it('la API responde 403 FEATURE_NOT_IN_PLAN en los módulos que el plan no incluye', function () {
    actingAsSeed('U01');
    $this->getJson('/api/v1/marketing/campaigns')->assertOk();
    $this->getJson('/api/v1/ops/orders')->assertOk();

    entPlan('starter');

    expect($this->getJson('/api/v1/marketing/campaigns'))->toBeApiError(403, EnsureFeature::CODE)
        ->and($this->getJson('/api/v1/ops/orders'))->toBeApiError(403, EnsureFeature::CODE)
        ->and($this->getJson('/api/v1/inbox/conversations'))->toBeApiError(403, EnsureFeature::CODE)
        ->and($this->getJson('/api/v1/channels/ecommerce'))->toBeApiError(403, EnsureFeature::CODE);

    $this->getJson('/api/v1/quotes')->assertOk();
    $this->getJson('/api/v1/reservations')->assertOk();
    $this->getJson('/api/v1/crm/clients')->assertOk();
    $this->getJson('/api/v1/me/access')->assertOk();
    $this->getJson('/api/v1/dashboard/home')->assertOk();
});

it('el mensaje del bloqueo nombra la funcionalidad y explica cómo habilitarla', function () {
    actingAsSeed('U01');
    entOverride('module.marketing_campaigns', false);

    $response = $this->getJson('/api/v1/marketing/campaigns');

    expect($response)->toBeApiError(403, EnsureFeature::CODE)
        ->and($response->json('message'))->toContain(app(Entitlements::class)->label('module.marketing_campaigns'))->toContain('Suscripción');
});

it('el sitio público no vende en línea si el plan no incluye e-commerce', function () {
    entPlan('starter');

    expect($this->postJson('/api/v1/public/carts/current/items', ['product' => 'laguna-humantay-full-day', 'date' => '2026-10-04', 'adults' => 2], siteOf(extra: critical())))->toBeApiError(403, EnsureFeature::CODE);

    $this->getJson('/api/v1/public/site', siteOf())->assertOk();
});

it('billing/entitlements entrega las funcionalidades efectivas y su origen', function () {
    actingAsSeed('U03');
    entOverride('module.cms', false);

    $response = $this->getJson('/api/v1/billing/entitlements')->assertOk();

    expect($response->json('data')['module.cms'])->toMatchArray(['enabled' => false, 'source' => 'override'])
        ->and($response->json('meta.enabled'))->toContain('module.quotes')->not->toContain('module.cms');
});

it('me/access marca las pantallas fuera del plan para que la web las bloquee', function () {
    actingAsSeed('U01');
    expect($this->getJson('/api/v1/me/access')->assertOk()->json('data.locked'))->toBe([]);

    entPlan('starter');
    $locked = $this->getJson('/api/v1/me/access')->assertOk()->json('data.locked');

    expect($locked)->toHaveKeys(['/marketing', '/operaciones/ordenes', '/inbox', '/canales/ecommerce'])
        ->and($locked['/marketing']['feature'])->toBe('module.marketing_campaigns')
        ->and($locked)->not->toHaveKeys(['/cotizaciones', '/reservas', '/crm/clientes']);
});

it('una excepción creada desde la consola rige de inmediato', function () {
    actingAsSeed('U01');
    $this->getJson('/api/v1/marketing/campaigns')->assertOk();

    actingAsPlatform();
    $this->postJson('/api/v1/platform/feature-overrides', ['tenant' => 'TNT-0001', 'feature' => 'module.marketing_campaigns', 'value' => false, 'reason' => 'Bloqueo temporal por revisión de pagos', 'valid_until' => Carbon::today()->addDays(20)->toDateString()])->assertCreated();

    actingAsSeed('U01');
    expect($this->getJson('/api/v1/marketing/campaigns'))->toBeApiError(403, EnsureFeature::CODE);
});

it('cada ruta del mapa de funcionalidades existe y cada funcionalidad existe en el catálogo', function () {
    $keys = DB::connection('pgsql_platform')->table('features')->pluck('key')->all();
    $uris = collect(app('router')->getRoutes()->getRoutes())->map(fn ($route) => preg_replace('#^api/v1/#', '', $route->uri()));

    foreach (['api', 'public', 'screens'] as $group) {
        expect(array_diff(array_keys((array) config("entitlements.{$group}")), $keys))->toBe([]);
    }

    foreach (array_merge_recursive((array) config('entitlements.api'), (array) config('entitlements.public')) as $feature => $prefixes) {
        foreach ($prefixes as $prefix) {
            expect($uris->contains(fn (string $uri): bool => $uri === $prefix || str_starts_with($uri, $prefix.'/')))->toBeTrue("Ninguna ruta empieza por {$prefix} ({$feature})");
        }
    }
});
