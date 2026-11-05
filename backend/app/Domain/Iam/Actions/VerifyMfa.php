<?php

declare(strict_types=1);

namespace App\Domain\Iam\Actions;

use App\Domain\Iam\Models\AccessToken;
use App\Domain\Iam\Models\User;
use App\Domain\Iam\Support\SessionPayload;
use App\Domain\Iam\Support\TotpVerifier;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;

final class VerifyMfa
{
    public function __construct(
        private readonly TotpVerifier $totp,
        private readonly IssueAccessToken $issueToken,
        private readonly RecordLogin $recordLogin,
        private readonly AuditLogger $audit,
    ) {
    }

    public function __invoke(User $user, AccessToken $token, string $code): array
    {
        $factor = $user->mfaFactor ?? throw ApiException::unprocessable('MFA_NOT_ENROLLED', 'Tu cuenta aún no tiene configurada la verificación en dos pasos.');

        try {
            $step = $this->totp->verify($factor->secret, $code, $factor->last_used_step);
        } catch (ApiException $invalid) {
            $this->audit->logOutsideTransaction('Sesión', (string) $user->code, 'login_fallido', after: 'MFA');
            throw $invalid;
        }

        $factor->forceFill(['last_used_step' => $step])->save();
        $this->issueToken->completeMfa($token);
        ($this->recordLogin)($user, 'MFA OK');

        return SessionPayload::make($user, null, mfaPending: false);
    }
}
