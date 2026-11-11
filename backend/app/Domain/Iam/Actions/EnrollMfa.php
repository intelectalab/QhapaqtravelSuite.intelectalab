<?php

declare(strict_types=1);

namespace App\Domain\Iam\Actions;

use App\Domain\Iam\Models\AccessToken;
use App\Domain\Iam\Models\MfaFactor;
use App\Domain\Iam\Models\User;
use App\Domain\Iam\Support\SessionPayload;
use App\Domain\Iam\Support\TotpVerifier;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use PragmaRX\Google2FA\Google2FA;

final class EnrollMfa
{
    private const RECOVERY_CODES = 8;

    public function __construct(
        private readonly Google2FA $google2fa,
        private readonly TotpVerifier $totp,
        private readonly IssueAccessToken $issueToken,
        private readonly RecordLogin $recordLogin,
        private readonly AuditLogger $audit,
    ) {}

    public function start(User $user, AccessToken $token): array
    {
        if ($user->mfaFactor !== null && ! $token->isMfaVerified()) {
            throw ApiException::conflict('MFA_ALREADY_ENROLLED', 'Tu cuenta ya tiene la verificación en dos pasos. Ingresa el código de tu aplicación.');
        }

        MfaFactor::query()->where('user_id', $user->getKey())->whereNull('confirmed_at')->delete();
        $secret = $this->google2fa->generateSecretKey(32);
        MfaFactor::query()->create(['user_id' => $user->getKey(), 'type' => 'totp', 'secret' => $secret]);

        return [
            'secret' => $secret,
            'otpauth_uri' => $this->google2fa->getQRCodeUrl('KipuControl', $user->email, $secret),
        ];
    }

    public function confirm(User $user, AccessToken $token, string $code): array
    {
        $factor = MfaFactor::query()->where('user_id', $user->getKey())->whereNull('confirmed_at')->latest('created_at')->first()
            ?? throw ApiException::unprocessable('MFA_NOT_STARTED', 'Vuelve a generar la clave para configurar la verificación en dos pasos.');

        $step = $this->totp->verify($factor->secret, $code, null);
        $codes = collect(range(1, self::RECOVERY_CODES))->map(fn () => Str::upper(Str::random(4).'-'.Str::random(4)));

        MfaFactor::query()->where('user_id', $user->getKey())->whereNotNull('confirmed_at')->delete();
        $factor->forceFill([
            'confirmed_at' => now(),
            'last_used_step' => $step,
            'recovery_codes' => $codes->map(fn (string $recovery) => Hash::make($recovery))->all(),
        ])->save();
        $user->forceFill(['mfa_enabled' => true])->save();
        $this->audit->log('Usuario', (string) $user->code, 'configurar_mfa', after: 'TOTP');

        if (! $token->isMfaVerified()) {
            $this->issueToken->completeMfa($token);
            ($this->recordLogin)($user, 'MFA configurado');
        }

        return [...SessionPayload::make($user, null, mfaPending: false), 'recovery_codes' => $codes->all()];
    }
}
