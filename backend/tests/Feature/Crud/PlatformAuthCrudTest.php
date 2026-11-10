<?php

use App\Domain\Iam\Models\AccessToken;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use PragmaRX\Google2FA\Google2FA;

beforeEach(function () {
    $this->withoutMiddleware(ThrottleRequests::class);
    Cache::setDefaultDriver('array');
});

function platPendingLogin(): string
{
    $platform = platformUser();
    $token = AccessToken::query()->forceCreate([
        'tokenable_type' => $platform->getMorphClass(),
        'tokenable_id' => $platform->getKey(),
        'name' => 'plataforma',
        'token' => hash('sha256', $secret = 'pest-pending-'.bin2hex(random_bytes(16))),
        'abilities' => ['mfa:verify'],
        'experience' => 'platform',
        'expires_at' => now()->addHours(8),
    ]);
    $plain = $token->getKey().'|'.$secret;
    useToken($plain);

    return $plain;
}

function platOtp(): string
{
    return app(Google2FA::class)->getCurrentOtp((string) platformUser()->mfa_secret);
}

function platAudit(array $where): bool
{
    return DB::connection('pgsql_platform')->table('audit_events')->whereNull('tenant_id')->where($where)->exists();
}

it('platform/auth/mfa/verify completa el acceso del Super Admin y registra el ingreso', function () {
    $token = platPendingLogin();

    expect($this->getJson('/api/v1/platform/tenants'))->toBeApiError(403, 'MFA_REQUIRED');

    $this->postJson('/api/v1/platform/auth/mfa/verify', ['code' => platOtp()])->assertOk()->assertJsonPath('data.mfa_required', false)->assertJsonPath('data.home', '/plataforma/inicio');
    app('auth')->forgetGuards();

    expect(AccessToken::query()->find(strtok($token, '|'))->mfa_verified_at)->not->toBeNull()
        ->and(platformUser()->last_login_at)->not->toBeNull()
        ->and(platAudit(['entity' => 'Sesión de plataforma', 'entity_id' => 'ops@qhapaq.cloud', 'action' => 'login', 'after_value' => 'MFA OK']))->toBeTrue();
    $this->getJson('/api/v1/platform/tenants')->assertOk();
});

it('platform/auth/mfa/verify rechaza un código equivocado y lo audita como intento fallido', function () {
    platPendingLogin();
    $wrong = platOtp() === '000000' ? '111111' : '000000';

    expect($this->postJson('/api/v1/platform/auth/mfa/verify', ['code' => $wrong]))->toBeApiError(422, 'MFA_INVALID')
        ->and(platAudit(['entity' => 'Sesión de plataforma', 'entity_id' => 'ops@qhapaq.cloud', 'action' => 'login_fallido', 'after_value' => 'MFA']))->toBeTrue();
    $this->postJson('/api/v1/platform/auth/mfa/verify', ['code' => 'abc'])->assertStatus(422)->assertJsonValidationErrors('code');
    expect($this->getJson('/api/v1/platform/tenants'))->toBeApiError(403, 'MFA_REQUIRED');
});

it('platform/auth/mfa/verify no acepta dos veces el mismo código', function () {
    platPendingLogin();
    $code = platOtp();
    $this->postJson('/api/v1/platform/auth/mfa/verify', ['code' => $code])->assertOk();

    platPendingLogin();

    expect($this->postJson('/api/v1/platform/auth/mfa/verify', ['code' => $code]))->toBeApiError(422, 'MFA_INVALID');
});

it('platform/auth/logout cierra la sesión del Super Admin y lo audita', function () {
    actingAsPlatform();
    $this->getJson('/api/v1/platform/me')->assertOk();

    $this->postJson('/api/v1/platform/auth/logout')->assertOk()->assertJsonPath('data.message', 'Cerraste sesión.');
    app('auth')->forgetGuards();

    expect(platAudit(['entity' => 'Sesión de plataforma', 'entity_id' => 'ops@qhapaq.cloud', 'action' => 'logout']))->toBeTrue();
    expect($this->getJson('/api/v1/platform/me'))->toBeApiError(401);
});

it('platform/auth/logout también cierra una sesión con la MFA pendiente', function () {
    platPendingLogin();

    $this->postJson('/api/v1/platform/auth/logout')->assertOk();
    app('auth')->forgetGuards();

    expect($this->postJson('/api/v1/platform/auth/mfa/verify', ['code' => platOtp()]))->toBeApiError(401);
});

it('un usuario de agencia no usa la verificación ni el cierre de sesión de la plataforma', function (string $uri, array $body) {
    actingAsSeed('U03');

    expect($this->postJson($uri, $body))->toBeApiError(403, 'PLATFORM_ONLY');
})->with([
    ['/api/v1/platform/auth/mfa/verify', ['code' => '123456']],
    ['/api/v1/platform/auth/logout', []],
]);
