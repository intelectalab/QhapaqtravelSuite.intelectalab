<?php

declare(strict_types=1);

namespace App\Domain\Iam\Support;

use App\Domain\Shared\Errors\ApiException;
use PragmaRX\Google2FA\Google2FA;

final class TotpVerifier
{
    public function __construct(private readonly Google2FA $totp)
    {
    }

    public function verify(string $secret, string $code, ?int $lastUsedStep): int
    {
        $step = $this->totp->verifyKeyNewer($secret, preg_replace('/\D/', '', $code) ?? '', $lastUsedStep, 1);

        if ($step === false) {
            throw ApiException::unprocessable('MFA_INVALID', 'El código no es válido o ya fue usado. Revisa tu aplicación de autenticación.');
        }

        return $step === true ? (int) $this->totp->getTimestamp() : (int) $step;
    }
}
