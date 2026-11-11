<?php

declare(strict_types=1);

namespace App\Domain\Iam\Actions;

use App\Domain\Iam\Models\AccessToken;
use App\Domain\Iam\Models\MfaFactor;
use App\Domain\Iam\Models\User;
use App\Domain\Iam\Support\LoginLockout;
use App\Domain\Iam\Support\SessionPayload;
use App\Domain\Iam\Support\TotpVerifier;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

final class VerifyMfa
{
    public function __construct(
        private readonly TotpVerifier $totp,
        private readonly IssueAccessToken $issueToken,
        private readonly RecordLogin $recordLogin,
        private readonly AuditLogger $audit,
        private readonly LoginLockout $lockout,
    ) {}

    public function __invoke(User $user, AccessToken $token, string $code): array
    {
        $factor = $user->mfaFactor ?? throw ApiException::unprocessable('MFA_NOT_ENROLLED', 'Tu cuenta aún no tiene configurada la verificación en dos pasos.');
        $lockKey = LoginLockout::agencyKey((string) $user->tenant_id, (string) $user->email);
        $this->lockout->ensureOpen($lockKey);

        if ($this->isRecoveryCode($code)) {
            $this->guarded($user, $lockKey, fn () => $this->useRecoveryCode($factor, $user, $code));
            $this->issueToken->completeMfa($token);
            $this->lockout->clear($lockKey);
            ($this->recordLogin)($user, 'Código de recuperación');

            return SessionPayload::make($user, null, mfaPending: false);
        }

        $step = $this->guarded($user, $lockKey, function () use ($factor, $user, $code): int {
            try {
                return $this->totp->verify($factor->secret, $code, $factor->last_used_step);
            } catch (ApiException $invalid) {
                $this->audit->logOutsideTransaction('Sesión', (string) $user->code, 'login_fallido', after: 'MFA');
                throw $invalid;
            }
        });

        $factor->forceFill(['last_used_step' => $step])->save();
        $this->issueToken->completeMfa($token);
        $this->lockout->clear($lockKey);
        ($this->recordLogin)($user, 'MFA OK');

        return SessionPayload::make($user, null, mfaPending: false);
    }

    private function guarded(User $user, string $lockKey, callable $check): mixed
    {
        try {
            return $check();
        } catch (ApiException $invalid) {
            $this->lockout->fail($lockKey, fn () => $this->audit->logOutsideTransaction('Sesión', (string) $user->code, 'cuenta_bloqueada', after: $this->lockout->minutes().' min'));
            throw $invalid;
        }
    }

    private function isRecoveryCode(string $code): bool
    {
        return (bool) preg_match('/^[A-Za-z0-9]{4}-?[A-Za-z0-9]{4}$/', trim($code)) && ! preg_match('/^\d{3}\s?\d{3}$/', trim($code));
    }

    private function useRecoveryCode(MfaFactor $factor, User $user, string $code): void
    {
        $normalized = Str::upper(preg_replace('/^(\w{4})-?(\w{4})$/', '$1-$2', trim($code)) ?? '');
        $codes = $factor->recovery_codes ?? [];
        $match = collect($codes)->search(fn (string $hash) => Hash::check($normalized, $hash));

        if ($match === false) {
            $this->audit->logOutsideTransaction('Sesión', (string) $user->code, 'login_fallido', after: 'Código de recuperación');
            throw ApiException::unprocessable('MFA_INVALID', 'El código de recuperación no es válido o ya fue usado.');
        }

        unset($codes[$match]);
        $factor->forceFill(['recovery_codes' => array_values($codes)])->save();
    }
}
