<?php

use App\Domain\Iam\Models\AccessToken;
use App\Domain\Iam\Support\LoginLockout;
use Illuminate\Cache\RateLimiter as Limiter;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Illuminate\Testing\TestResponse;

beforeEach(function () {
    $this->withoutMiddleware(ThrottleRequests::class);
    Cache::setDefaultDriver('array');
    $this->app->instance(Limiter::class, new Limiter(Cache::store('array')));
    RateLimiter::clearResolvedInstance(Limiter::class);
    config(['access.lockout.attempts' => 5, 'access.lockout.minutes' => 15]);
});

function lockoutAttempt(string $email, ?string $password = null): TestResponse
{
    return test()->postJson('/api/v1/auth/login', ['email' => $email, 'password' => $password ?? 'ClaveEquivocada1']);
}

it('la quinta contraseña equivocada bloquea la cuenta, que sigue bloqueada aunque luego llegue la correcta, y queda auditado', function () {
    foreach (range(1, 4) as $ignored) {
        expect(lockoutAttempt('lparedes@andeshorizonte.pe'))->toBeApiError(401);
    }

    $fifth = lockoutAttempt('lparedes@andeshorizonte.pe');
    $locked = lockoutAttempt('lparedes@andeshorizonte.pe', (string) config('demo.password'));

    expect($fifth)->toBeApiError(429, 'ACCOUNT_LOCKED')
        ->and($fifth->json('message'))->toContain('15 min')
        ->and($locked)->toBeApiError(429, 'ACCOUNT_LOCKED')
        ->and($locked->json('details.retry_after_minutes'))->toBeGreaterThan(0)
        ->and(auditExists(['entity' => 'Sesión', 'entity_id' => 'lparedes@andeshorizonte.pe', 'action' => 'cuenta_bloqueada']))->toBeTrue();
});

it('un correo que no existe también se bloquea, así la respuesta no revela qué cuentas existen', function () {
    $email = 'nadie-'.Str::lower(Str::random(6)).'@andeshorizonte.pe';

    foreach (range(1, 4) as $ignored) {
        expect(lockoutAttempt($email))->toBeApiError(401);
    }

    expect(lockoutAttempt($email))->toBeApiError(429, 'ACCOUNT_LOCKED');
});

it('un ingreso correcto reinicia la cuenta de intentos', function () {
    foreach (range(1, 4) as $ignored) {
        lockoutAttempt('lparedes@andeshorizonte.pe');
    }
    loginAs('lparedes@andeshorizonte.pe')->assertOk();
    foreach (range(1, 4) as $ignored) {
        lockoutAttempt('lparedes@andeshorizonte.pe');
    }

    loginAs('lparedes@andeshorizonte.pe')->assertOk();
});

it('la clave de bloqueo es por agencia y no distingue mayúsculas ni espacios', function () {
    $tenant = (string) tenantA()->getKey();

    expect(LoginLockout::agencyKey((string) Str::uuid7(), 'lparedes@andeshorizonte.pe'))->not->toBe(LoginLockout::agencyKey($tenant, 'lparedes@andeshorizonte.pe'))
        ->and(LoginLockout::agencyKey($tenant, ' LParedes@AndesHorizonte.pe '))->toBe(LoginLockout::agencyKey($tenant, 'lparedes@andeshorizonte.pe'));
});

it('los códigos MFA equivocados de la plataforma también bloquean la cuenta', function () {
    $platform = platformUser();
    $pending = AccessToken::query()->forceCreate(['tokenable_type' => $platform->getMorphClass(), 'tokenable_id' => $platform->getKey(), 'name' => 'plataforma', 'token' => hash('sha256', $secret = 'pest-lock-'.bin2hex(random_bytes(16))), 'abilities' => ['mfa:verify'], 'experience' => 'platform', 'expires_at' => now()->addHours(8)]);
    useToken($pending->getKey().'|'.$secret);

    foreach (range(1, 4) as $ignored) {
        expect($this->postJson('/api/v1/platform/auth/mfa/verify', ['code' => '000000']))->toBeApiError(422, 'MFA_INVALID');
    }

    expect($this->postJson('/api/v1/platform/auth/mfa/verify', ['code' => '000000']))->toBeApiError(429, 'ACCOUNT_LOCKED');
    expect($this->postJson('/api/v1/platform/auth/login', ['email' => 'ops@qhapaq.cloud', 'password' => (string) config('demo.password')]))->toBeApiError(429, 'ACCOUNT_LOCKED');
});
