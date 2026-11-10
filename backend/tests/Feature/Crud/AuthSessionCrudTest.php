<?php

use App\Domain\Iam\Models\MfaFactor;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\DB;
use PragmaRX\Google2FA\Google2FA;

beforeEach(fn () => $this->withoutMiddleware(ThrottleRequests::class));

function authFactor(string $code): ?MfaFactor
{
    return withinTenant(tenantA(), fn () => MfaFactor::query()->where('user_id', seedUser($code)->id)->latest('created_at')->first());
}

function authOtp(string $secret): string
{
    return app(Google2FA::class)->getCurrentOtp($secret);
}

function authPendingSession(string $code): void
{
    useToken(issueToken(seedUser($code), tenantA(), false));
}

function authEnroll(string $code): array
{
    $secret = test()->postJson('/api/v1/me/mfa/enroll')->assertOk()->json('data.secret');

    return test()->postJson('/api/v1/me/mfa/confirm', ['code' => authOtp($secret)])->assertOk()->json('data');
}

it('cerrar sesión borra el token, deja de responder y queda en la auditoría', function () {
    actingAsSeed('U03');
    $this->getJson('/api/v1/me')->assertOk();
    $tokens = withinTenant(tenantA(), fn () => DB::table('personal_access_tokens')->where('tokenable_id', seedUser('U03')->id)->count());

    $this->postJson('/api/v1/auth/logout')->assertOk()->assertJsonPath('data.message', 'Cerraste sesión.');
    app('auth')->forgetGuards();

    expect(withinTenant(tenantA(), fn () => DB::table('personal_access_tokens')->where('tokenable_id', seedUser('U03')->id)->count()))->toBe($tokens - 1)
        ->and(withinTenant(tenantA(), fn () => DB::table('audit_events')->where(['entity' => 'Sesión', 'entity_id' => 'U03', 'action' => 'logout'])->exists()))->toBeTrue();
    expect($this->getJson('/api/v1/me'))->toBeApiError(401);
});

it('cerrar sesión exige estar autenticado', function () {
    expect($this->postJson('/api/v1/auth/logout'))->toBeApiError(401);
});

it('configura la verificación en dos pasos: clave pendiente, confirmación con código y 8 códigos de recuperación', function () {
    actingAsSeed('U03');

    $start = $this->postJson('/api/v1/me/mfa/enroll')->assertOk()->json('data');
    expect($start['otpauth_uri'])->toStartWith('otpauth://totp/')->toContain(rawurlencode('lparedes@andeshorizonte.pe'))
        ->and(authFactor('U03')->confirmed_at)->toBeNull()
        ->and((bool) seedUser('U03')->mfa_enabled)->toBeFalse();

    $confirmed = $this->postJson('/api/v1/me/mfa/confirm', ['code' => authOtp($start['secret'])])->assertOk()->json('data');

    expect($confirmed['recovery_codes'])->toHaveCount(8)
        ->and($confirmed['mfa_required'])->toBeFalse()
        ->and(authFactor('U03')->confirmed_at)->not->toBeNull()
        ->and((bool) seedUser('U03')->mfa_enabled)->toBeTrue()
        ->and(withinTenant(tenantA(), fn () => DB::table('audit_events')->where(['entity' => 'Usuario', 'entity_id' => 'U03', 'action' => 'configurar_mfa'])->exists()))->toBeTrue()
        ->and($this->getJson('/api/v1/me')->json('data.mfa_enabled'))->toBeTrue();
});

it('volver a generar la clave reemplaza la pendiente anterior', function () {
    actingAsSeed('U03');
    $this->postJson('/api/v1/me/mfa/enroll')->assertOk();
    $second = $this->postJson('/api/v1/me/mfa/enroll')->assertOk()->json('data.secret');

    expect(withinTenant(tenantA(), fn () => MfaFactor::query()->where('user_id', seedUser('U03')->id)->whereNull('confirmed_at')->count()))->toBe(1)
        ->and(authFactor('U03')->secret)->toBe($second);
});

it('la confirmación rechaza un código equivocado, uno mal escrito y la falta de clave pendiente', function () {
    actingAsSeed('U03');

    expect($this->postJson('/api/v1/me/mfa/confirm', ['code' => '123456']))->toBeApiError(422, 'MFA_NOT_STARTED');

    $secret = $this->postJson('/api/v1/me/mfa/enroll')->json('data.secret');
    $wrong = authOtp($secret) === '000000' ? '111111' : '000000';

    expect($this->postJson('/api/v1/me/mfa/confirm', ['code' => $wrong]))->toBeApiError(422, 'MFA_INVALID');
    $this->postJson('/api/v1/me/mfa/confirm', ['code' => '12ab'])->assertStatus(422)->assertJsonValidationErrors('code');
    expect((bool) seedUser('U03')->mfa_enabled)->toBeFalse();
});

it('el enrolamiento con sesión pendiente completa el acceso del rol que exige MFA', function () {
    withinTenant(tenantA(), fn () => DB::table('iam_mfa_factors')->where('user_id', seedUser('U02')->id)->delete());
    withinTenant(tenantA(), fn () => DB::table('iam_users')->where('code', 'U02')->update(['mfa_enabled' => false]));
    authPendingSession('U02');

    expect($this->getJson('/api/v1/me'))->toBeApiError(403);

    authEnroll('U02');
    app('auth')->forgetGuards();

    $this->getJson('/api/v1/me')->assertOk()->assertJsonPath('data.mfa_enabled', true);
    expect(withinTenant(tenantA(), fn () => DB::table('personal_access_tokens')->where('tokenable_id', seedUser('U02')->id)->whereNotNull('mfa_verified_at')->exists()))->toBeTrue();
});

it('con la MFA ya configurada, una sesión pendiente no puede generar otra clave', function () {
    actingAsSeed('U03');
    authEnroll('U03');
    authPendingSession('U03');

    expect($this->postJson('/api/v1/me/mfa/enroll'))->toBeApiError(409, 'MFA_ALREADY_ENROLLED');
});

it('auth/mfa/verify completa la sesión con el código vigente y rechaza el ya usado', function () {
    actingAsSeed('U03');
    $secret = $this->postJson('/api/v1/me/mfa/enroll')->json('data.secret');
    $code = authOtp($secret);
    $this->postJson('/api/v1/me/mfa/confirm', ['code' => $code])->assertOk();
    authPendingSession('U03');

    expect($this->getJson('/api/v1/me'))->toBeApiError(403);
    expect($this->postJson('/api/v1/auth/mfa/verify', ['code' => $code]))->toBeApiError(422, 'MFA_INVALID');
    expect(auditExists(['entity' => 'Sesión', 'entity_id' => 'U03', 'action' => 'login_fallido', 'after_value' => 'MFA']))->toBeTrue();

    withinTenant(tenantA(), fn () => DB::table('iam_mfa_factors')->where('user_id', seedUser('U03')->id)->update(['last_used_step' => null]));
    $this->postJson('/api/v1/auth/mfa/verify', ['code' => $code])->assertOk()->assertJsonPath('data.mfa_required', false);
    app('auth')->forgetGuards();

    $this->getJson('/api/v1/me')->assertOk();
});

it('auth/mfa/verify acepta un código de recuperación una sola vez', function () {
    actingAsSeed('U03');
    $recovery = authEnroll('U03')['recovery_codes'][0];

    authPendingSession('U03');
    $this->postJson('/api/v1/auth/mfa/verify', ['code' => strtolower($recovery)])->assertOk()->assertJsonPath('data.mfa_required', false);

    expect(authFactor('U03')->recovery_codes)->toHaveCount(7);

    authPendingSession('U03');
    expect($this->postJson('/api/v1/auth/mfa/verify', ['code' => $recovery]))->toBeApiError(422, 'MFA_INVALID');
});

it('auth/mfa/verify sin factor configurado responde MFA_NOT_ENROLLED y valida el formato', function () {
    actingAsSeed('U03');

    expect($this->postJson('/api/v1/auth/mfa/verify', ['code' => '123456']))->toBeApiError(422, 'MFA_NOT_ENROLLED');
    $this->postJson('/api/v1/auth/mfa/verify', ['code' => ''])->assertStatus(422)->assertJsonValidationErrors('code');
});
