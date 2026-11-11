<?php

declare(strict_types=1);

namespace App\Domain\Platform\Actions;

use App\Domain\Iam\Models\AccessToken;
use App\Domain\Iam\Support\LoginLockout;
use App\Domain\Iam\Support\TotpVerifier;
use App\Domain\Platform\Models\PlatformUser;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Request;
use Illuminate\Support\Str;

final class PlatformSession
{
    public const HOME = '/plataforma/inicio';

    private const CONNECTION = 'pgsql_platform';

    public function __construct(
        private readonly TotpVerifier $totp,
        private readonly AuditLogger $audit,
        private readonly LoginLockout $lockout,
    ) {}

    public function owns(string $email): bool
    {
        return $this->find($email) !== null;
    }

    public function login(string $email, string $password): array
    {
        $lockKey = LoginLockout::platformKey($email);
        $this->lockout->ensureOpen($lockKey);
        $user = $this->find($email);

        if ($user === null || ! Hash::check($password, (string) $user->password) || ! $user->isActive()) {
            $this->log('Sesión de plataforma', Str::lower($email), 'login_fallido');
            $this->recordFailure($lockKey, Str::lower($email));
            throw new ApiException(401, 'UNAUTHENTICATED', null, 'El correo o la contraseña no son correctos.');
        }

        $plain = Str::random(48);
        $token = $user->tokens()->create([
            'tenant_id' => null,
            'name' => 'plataforma',
            'token' => hash('sha256', $plain),
            'abilities' => ['mfa:verify'],
            'experience' => 'platform',
            'expires_at' => now()->addHours(8),
            'ip' => Request::ip(),
        ]);

        return ['token' => $token->getKey().'|'.$plain, 'token_type' => 'Bearer', 'mfa_required' => true, 'home' => self::HOME];
    }

    public function verifyMfa(PlatformUser $user, AccessToken $token, string $code): array
    {
        $key = "mfa:platform:{$user->getKey()}:last_step";
        $lockKey = LoginLockout::platformKey((string) $user->email);
        $this->lockout->ensureOpen($lockKey);

        try {
            $last = Cache::get($key);
            $step = $this->totp->verify((string) $user->mfa_secret, $code, $last === null ? null : (int) $last);
        } catch (ApiException $invalid) {
            $this->log('Sesión de plataforma', $user->email, 'login_fallido', after: 'MFA', actor: $user);
            $this->recordFailure($lockKey, (string) $user->email, $user);
            throw $invalid;
        }

        $this->lockout->clear($lockKey);
        Cache::put($key, $step, now()->addMinutes(10));
        $token->forceFill(['abilities' => ['*'], 'mfa_verified_at' => now()])->save();
        $user->forceFill(['last_login_at' => now()])->save();
        $this->log('Sesión de plataforma', $user->email, 'login', after: 'MFA OK', actor: $user);

        return ['mfa_required' => false, 'home' => self::HOME];
    }

    private function recordFailure(string $lockKey, string $email, ?PlatformUser $actor = null): void
    {
        $this->lockout->fail($lockKey, fn () => $this->log('Sesión de plataforma', $email, 'cuenta_bloqueada', after: $this->lockout->minutes().' min', actor: $actor));
    }

    public function logout(PlatformUser $user, AccessToken $token): void
    {
        $token->delete();
        $this->log('Sesión de plataforma', $user->email, 'logout', actor: $user);
    }

    private function find(string $email): ?PlatformUser
    {
        return PlatformUser::query()->whereRaw('lower(email) = ?', [Str::lower(trim($email))])->first();
    }

    public function log(string $entity, string $entityId, string $action, ?string $before = null, ?string $after = null, ?PlatformUser $actor = null): void
    {
        $this->audit->log($entity, $entityId, $action, $before, $after, actor: $actor, connection: self::CONNECTION);
    }
}
