<?php

use App\Domain\Admin\Http\Middleware\AuthenticateApiKey;
use App\Domain\Admin\Http\Middleware\RequireApiScope;
use App\Domain\Admin\Support\ApiKeyEndpoints;
use App\Domain\Admin\Support\ApiKeyUsage;
use App\Domain\Shared\Tenancy\TenantContext;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Str;

beforeEach(function () {
    Route::middleware([AuthenticateApiKey::class, RequireApiScope::class.':catalog:read'])
        ->get('api/v1/zz-pruebas/llave', fn () => response()->json(['data' => ['tenant' => app(TenantContext::class)->id(), 'products' => DB::table('catalog_products')->count()]]));
});

function plataformaLlave(array $overrides = []): array
{
    $token = 'qts_live_'.Str::random(32);
    $id = (string) Str::uuid7();
    DB::connection('pgsql_platform')->table('integration_api_keys')->insert([
        'id' => $id,
        'tenant_id' => tenantA()->getKey(),
        'code' => 'KEY-'.Str::upper(Str::random(5)),
        'name' => 'Integración de prueba',
        'environment' => 'live',
        'prefix' => substr($token, 0, 13),
        'last4' => substr($token, -4),
        'token_hash' => hash('sha256', $token),
        'scopes' => '{"catalog:read"}',
        'status' => 'active',
        ...$overrides,
    ]);
    RateLimiter::clear("api-key:{$id}");

    return [$token, $id];
}

it('G6-02: la llave autentica a la agencia, respeta RLS y devuelve las cabeceras de límite', function () {
    [$token] = plataformaLlave();
    $expected = withinTenant(tenantA(), fn () => DB::table('catalog_products')->count());

    $response = $this->withToken($token)->getJson('/api/v1/zz-pruebas/llave')->assertOk();

    expect($response->json('data.tenant'))->toBe(tenantA()->getKey())
        ->and($response->json('data.products'))->toBe($expected)
        ->and($response->headers->get('X-RateLimit-Limit'))->not->toBeNull()
        ->and((int) $response->headers->get('X-RateLimit-Remaining'))->toBeLessThan((int) $response->headers->get('X-RateLimit-Limit'))
        ->and($response->headers->get('X-RateLimit-Reset'))->not->toBeNull();
});

it('API-BR-01: sin llave, llave inválida, revocada o vencida responde 401', function () {
    expect($this->getJson('/api/v1/zz-pruebas/llave'))->toBeApiError(401, 'API_KEY_INVALID');
    expect($this->withToken('qts_live_'.Str::random(32))->getJson('/api/v1/zz-pruebas/llave'))->toBeApiError(401, 'API_KEY_INVALID');

    [$revoked] = plataformaLlave(['status' => 'revoked']);
    expect($this->withToken($revoked)->getJson('/api/v1/zz-pruebas/llave'))->toBeApiError(401, 'API_KEY_INVALID');

    [$expired] = plataformaLlave(['expires_at' => now()->subDays(2)->toDateString()]);
    expect($this->withToken($expired)->getJson('/api/v1/zz-pruebas/llave'))->toBeApiError(401, 'API_KEY_INVALID');
});

it('API-BR-01: sin el scope de la ruta o desde una IP fuera de la lista responde 403', function () {
    [$noScope] = plataformaLlave(['scopes' => '{"quotes:read"}']);
    $denied = $this->withToken($noScope)->getJson('/api/v1/zz-pruebas/llave');
    expect($denied)->toBeApiError(403, 'API_KEY_SCOPE')->and($denied->json('required_permissions'))->toBe(['catalog:read']);

    [$ip] = plataformaLlave(['ip_allowlist' => '{"203.0.113.0/24"}']);
    expect($this->withToken($ip)->getJson('/api/v1/zz-pruebas/llave'))->toBeApiError(403, 'API_KEY_IP');
    $this->withToken($ip)->withServerVariables(['REMOTE_ADDR' => '203.0.113.9'])->getJson('/api/v1/zz-pruebas/llave')->assertOk();
});

it('G6-02: el límite es por llave, responde 429 con Retry-After y cuenta el consumo de 30 días', function () {
    [$token, $id] = plataformaLlave();
    [$other] = plataformaLlave();
    Cache::put('api-key:rate:'.tenantA()->getKey(), 2, 60);

    $this->withToken($token)->getJson('/api/v1/zz-pruebas/llave')->assertOk();
    $this->withToken($token)->getJson('/api/v1/zz-pruebas/llave')->assertOk();
    $limited = $this->withToken($token)->getJson('/api/v1/zz-pruebas/llave')->assertStatus(429);
    $this->withToken($other)->getJson('/api/v1/zz-pruebas/llave')->assertOk();

    expect($limited->headers->get('Retry-After'))->not->toBeNull()
        ->and($limited->headers->get('X-RateLimit-Remaining'))->toBe('0');

    expect(app(ApiKeyUsage::class)->summary($id))->toBe(['calls_30d' => 2, 'rejected_24h' => 1]);

    actingAsSeed('U01');
    $overview = $this->getJson('/api/v1/admin/api')->assertOk()->json('data');
    expect($overview)->toHaveKey('public_endpoints')
        ->and(collect($overview['keys'])->every(fn (array $key) => isset($key['usage']['calls_30d'], $key['usage']['rejected_24h'])))->toBeTrue();
});

it('G6-01: la tabla de endpoints públicos lista las rutas con llave y su scope', function () {
    expect(collect(ApiKeyEndpoints::all())->firstWhere('path', '/api/v1/zz-pruebas/llave'))->toMatchArray(['method' => 'GET', 'scopes' => ['catalog:read'], 'label' => 'Leer el catálogo']);
});
