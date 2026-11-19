<?php

use App\Domain\Admin\Actions\IssueOAuthTokens;
use App\Domain\Admin\Support\ApiQuota;
use App\Domain\Platform\Models\Tenant;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Illuminate\Testing\TestResponse;

beforeEach(function () {
    lockPlatformBilling();
});

function gqKey(array $scopes, ?Tenant $tenant = null): array
{
    $token = 'qts_live_'.Str::random(32);
    $id = (string) Str::uuid7();
    DB::connection('pgsql_platform')->table('integration_api_keys')->insert([
        'id' => $id,
        'tenant_id' => ($tenant ?? tenantA())->getKey(),
        'code' => 'KEY-'.Str::upper(Str::random(5)),
        'name' => 'ERP de prueba',
        'environment' => 'live',
        'prefix' => substr($token, 0, 13),
        'last4' => substr($token, -4),
        'token_hash' => hash('sha256', $token),
        'scopes' => '{'.implode(',', array_map(fn (string $scope): string => '"'.$scope.'"', $scopes)).'}',
        'status' => 'active',
    ]);
    RateLimiter::clear("api-key:{$id}");

    return ['token' => $token, 'id' => $id];
}

function gqCall(string $method, string $uri, string $token, array $body = []): TestResponse
{
    app('auth')->forgetGuards();

    return test()->json($method, $uri, $body, ['Authorization' => 'Bearer '.$token, 'Accept' => 'application/json']);
}

function gqQuota(int $remaining): int
{
    $tenant = (string) tenantA()->getKey();
    $quota = app(ApiQuota::class);
    $quota->forget($tenant);
    $limit = $quota->used($tenant) + $remaining;
    DB::connection('pgsql_platform')->table('plan_limits')->where('plan_id', tenantA()->plan_id)->where('metric', ApiQuota::METRIC)->update(['value' => $limit, 'hard' => true]);
    $quota->forget($tenant);

    return $limit;
}

function gqApp(array $scopes = ['catalog:read', 'reservations:read']): array
{
    $secret = 'kcs_'.Str::random(40);
    $clientId = (string) Str::uuid7();
    $db = DB::connection('pgsql_platform');
    $db->table('oauth_clients')->insert([
        'id' => $clientId,
        'tenant_id' => tenantA()->getKey(),
        'name' => 'Conector contable',
        'secret' => hash('sha256', $secret),
        'redirect_uris' => json_encode(['https://contasis.example.com/oauth/callback']),
        'grant_types' => json_encode(['authorization_code', 'refresh_token']),
        'revoked' => false,
    ]);
    $db->table('integration_oauth_apps')->insert([
        'id' => (string) Str::uuid7(),
        'tenant_id' => tenantA()->getKey(),
        'client_id' => $clientId,
        'vendor' => 'Contasis Cloud',
        'allowed_scopes' => '{'.implode(',', $scopes).'}',
        'status' => 'active',
    ]);
    RateLimiter::clear("api-key:{$clientId}");

    return ['client_id' => $clientId, 'secret' => $secret];
}

function gqAuthorizeQuery(array $app, string $verifier, array $extra = []): array
{
    return [
        'response_type' => 'code',
        'client_id' => $app['client_id'],
        'redirect_uri' => 'https://contasis.example.com/oauth/callback',
        'scope' => 'catalog:read',
        'state' => 'estado-123',
        'code_challenge' => IssueOAuthTokens::challenge($verifier),
        'code_challenge_method' => 'S256',
        ...$extra,
    ];
}

function gqCode(array $app, string $verifier): string
{
    actingAsSeed('U01');
    $redirect = test()->postJson('/api/v1/oauth/authorize', [...gqAuthorizeQuery($app, $verifier), 'approve' => true])->assertOk()->json('data.redirect_to');
    parse_str((string) parse_url($redirect, PHP_URL_QUERY), $query);

    return (string) $query['code'];
}

function gqToken(array $body): TestResponse
{
    app('auth')->forgetGuards();

    return test()->postJson('/api/v1/oauth/token', $body);
}

it('SUB-BR-04: al llegar al 100 % de la cuota mensual la API responde 429 QUOTA_EXCEEDED con Retry-After', function () {
    $key = gqKey(['catalog:read']);
    $limit = gqQuota(2);
    $tenant = (string) tenantA()->getKey();
    $before = (int) DB::connection('pgsql_platform')->table('usage_events')->where('tenant_id', $tenant)->where('metric', ApiQuota::METRIC)->sum('value');

    gqCall('GET', '/api/v1/catalog/products', $key['token'])->assertOk()->assertHeader('X-Quota-Limit', (string) $limit)->assertHeader('X-Quota-Remaining', '1');
    gqCall('GET', '/api/v1/catalog/products', $key['token'])->assertOk()->assertHeader('X-Quota-Remaining', '0');

    $blocked = gqCall('GET', '/api/v1/catalog/products', $key['token']);
    expect($blocked)->toBeApiError(429, 'QUOTA_EXCEEDED');
    expect($blocked->json('error'))->toBe('QUOTA_EXCEEDED')
        ->and((int) $blocked->headers->get('Retry-After'))->toBeGreaterThan(0)
        ->and($blocked->json('details.limit'))->toBe($limit)
        ->and($blocked->headers->get('X-Quota-Remaining'))->toBe('0');

    expect((int) DB::connection('pgsql_platform')->table('usage_events')->where('tenant_id', $tenant)->where('metric', ApiQuota::METRIC)->sum('value'))->toBe($before + 2);
});

it('SUB-BR-04: sin límite en el plan la API no se frena y la pantalla de API muestra el consumo real del mes', function () {
    $key = gqKey(['catalog:read']);
    DB::connection('pgsql_platform')->table('plan_limits')->where('plan_id', tenantA()->plan_id)->where('metric', ApiQuota::METRIC)->update(['value' => null]);
    app(ApiQuota::class)->forget((string) tenantA()->getKey());
    $used = app(ApiQuota::class)->used((string) tenantA()->getKey());

    gqCall('GET', '/api/v1/catalog/products', $key['token'])->assertOk()->assertHeaderMissing('X-Quota-Limit');

    actingAsSeed('U01');
    $overview = $this->getJson('/api/v1/admin/api')->assertOk()->json('data');
    expect($overview['calls_month'])->toBe($used + 1)->and($overview['limits']['calls_month'])->toBeNull();
});

it('13 §3.14: Authorization Code + PKCE entrega tokens que llaman a la API con los permisos concedidos', function () {
    $app = gqApp();
    $verifier = Str::random(64);

    actingAsSeed('U01');
    $consent = $this->getJson('/api/v1/oauth/authorize?'.http_build_query(gqAuthorizeQuery($app, $verifier)))->assertOk()->json('data');
    expect($consent['name'])->toBe('Conector contable')->and(collect($consent['scopes'])->pluck('value')->all())->toBe(['catalog:read']);

    $code = gqCode($app, $verifier);
    $body = ['grant_type' => 'authorization_code', 'client_id' => $app['client_id'], 'client_secret' => $app['secret'], 'code' => $code, 'redirect_uri' => 'https://contasis.example.com/oauth/callback'];

    gqToken([...$body, 'code_verifier' => Str::random(64)])->assertStatus(400)->assertJson(['error' => 'invalid_grant']);
    gqToken([...$body, 'client_secret' => 'kcs_otro', 'code_verifier' => $verifier])->assertStatus(401)->assertJson(['error' => 'invalid_client']);

    $issued = gqToken([...$body, 'code_verifier' => $verifier])->assertOk();
    expect((string) $issued->headers->get('Cache-Control'))->toContain('no-store');
    $tokens = $issued->json();
    expect($tokens['token_type'])->toBe('Bearer')->and($tokens['access_token'])->toStartWith('kco_')->and($tokens['scope'])->toBe('catalog:read')->and($tokens['expires_in'])->toBe(3600);
    expect(DB::connection('pgsql_platform')->table('integration_oauth_tokens')->where('access_hash', $tokens['access_token'])->exists())->toBeFalse();

    gqCall('GET', '/api/v1/catalog/products', $tokens['access_token'])->assertOk();
    expect(gqCall('GET', '/api/v1/reservations', $tokens['access_token']))->toBeApiError(403, 'API_KEY_SCOPE');

    $refreshed = gqToken(['grant_type' => 'refresh_token', 'client_id' => $app['client_id'], 'client_secret' => $app['secret'], 'refresh_token' => $tokens['refresh_token']])->assertOk()->json();
    expect(gqCall('GET', '/api/v1/catalog/products', $tokens['access_token']))->toBeApiError(401, 'API_KEY_INVALID');
    gqCall('GET', '/api/v1/catalog/products', $refreshed['access_token'])->assertOk();
    gqToken(['grant_type' => 'refresh_token', 'client_id' => $app['client_id'], 'client_secret' => $app['secret'], 'refresh_token' => $tokens['refresh_token']])->assertStatus(400)->assertJson(['error' => 'invalid_grant']);

    gqToken([...$body, 'code_verifier' => $verifier])->assertStatus(400)->assertJson(['error' => 'invalid_grant']);
    expect(gqCall('GET', '/api/v1/catalog/products', $refreshed['access_token']))->toBeApiError(401, 'API_KEY_INVALID');

    expect((bool) withinTenant(tenantA(), fn () => DB::table('audit_events')->where(['entity' => 'App OAuth', 'entity_id' => $app['client_id'], 'action' => 'autorizar'])->exists()))->toBeTrue();
});

it('13 §3.14: el código vence, la app revocada pierde sus tokens y el rechazo vuelve con access_denied', function () {
    $app = gqApp();
    $verifier = Str::random(64);
    $code = gqCode($app, $verifier);
    $body = ['grant_type' => 'authorization_code', 'client_id' => $app['client_id'], 'client_secret' => $app['secret'], 'code' => $code, 'redirect_uri' => 'https://contasis.example.com/oauth/callback', 'code_verifier' => $verifier];

    gqToken([...$body, 'redirect_uri' => 'https://otro.example.com/cb'])->assertStatus(400)->assertJson(['error' => 'invalid_grant']);
    DB::connection('pgsql_platform')->table('integration_oauth_codes')->where('code_hash', hash('sha256', $code))->update(['expires_at' => DB::raw("now() - interval '1 minute'")]);
    gqToken($body)->assertStatus(400)->assertJson(['error' => 'invalid_grant']);

    $fresh = gqCode($app, $verifier);
    $tokens = gqToken([...$body, 'code' => $fresh])->assertOk()->json();
    DB::connection('pgsql_platform')->table('integration_oauth_apps')->where('client_id', $app['client_id'])->update(['status' => 'revoked']);
    expect(gqCall('GET', '/api/v1/catalog/products', $tokens['access_token']))->toBeApiError(401, 'API_KEY_INVALID');
    gqToken(['grant_type' => 'refresh_token', 'client_id' => $app['client_id'], 'client_secret' => $app['secret'], 'refresh_token' => $tokens['refresh_token']])->assertStatus(401)->assertJson(['error' => 'invalid_client']);
    gqToken(['grant_type' => 'password', 'client_id' => $app['client_id'], 'client_secret' => $app['secret']])->assertStatus(400)->assertJson(['error' => 'unsupported_grant_type']);

    $other = gqApp();
    actingAsSeed('U01');
    $denied = $this->postJson('/api/v1/oauth/authorize', [...gqAuthorizeQuery($other, $verifier), 'approve' => false])->assertOk()->json('data.redirect_to');
    expect($denied)->toStartWith('https://contasis.example.com/oauth/callback?')->toContain('error=access_denied')->toContain('state=estado-123')->not->toContain('code=');
});

it('13 §3.14: valida el pedido de autorización y exige permiso de API y plan con OAuth', function () {
    $app = gqApp();
    $verifier = Str::random(64);

    actingAsSeed('U01');
    $this->getJson('/api/v1/oauth/authorize?'.http_build_query(gqAuthorizeQuery($app, $verifier, ['code_challenge_method' => 'plain'])))->assertUnprocessable()->assertJsonValidationErrors('code_challenge_method');
    expect($this->getJson('/api/v1/oauth/authorize?'.http_build_query(gqAuthorizeQuery($app, $verifier, ['redirect_uri' => 'https://malicioso.example.com/cb']))))->toBeApiError(422, 'OAUTH_REDIRECT');
    expect($this->getJson('/api/v1/oauth/authorize?'.http_build_query(gqAuthorizeQuery($app, $verifier, ['scope' => 'catalog:read crm:write']))))->toBeApiError(422, 'OAUTH_SCOPE');

    actingAsSeed('U02');
    $forbidden = $this->getJson('/api/v1/oauth/authorize?'.http_build_query(gqAuthorizeQuery($app, $verifier)));
    expect($forbidden)->toBeApiError(403);
    expect($forbidden->json('required_permissions'))->toContain('admin.api.manage');

    actingAsTenantBAdmin();
    expect($this->getJson('/api/v1/oauth/authorize?'.http_build_query(gqAuthorizeQuery($app, $verifier))))->toBeApiError(403, 'FEATURE_NOT_IN_PLAN');
});

it('13 §3.14: la lista de apps OAuth muestra el client id completo, los tokens activos y el consumo del mes', function () {
    actingAsSeed('U01');
    $created = $this->postJson('/api/v1/integrations/oauth-apps', ['name' => 'Conector BI', 'vendor' => 'Andes BI', 'scopes' => ['catalog:read'], 'redirect_uris' => ['https://bi.example.com/cb']])->assertCreated()->json('data');

    $row = collect($this->getJson('/api/v1/integrations/oauth-apps')->assertOk()->json('data'))->firstWhere('id', $created['id']);
    expect($row['client_id'])->toBe($created['client_id'])
        ->and($row['active_tokens'])->toBe(0)
        ->and($row['calls_month'])->toBe(0)
        ->and($row)->toHaveKeys(['last_token_at', 'last_used_at'])
        ->and($row)->not->toHaveKey('secret');
});
