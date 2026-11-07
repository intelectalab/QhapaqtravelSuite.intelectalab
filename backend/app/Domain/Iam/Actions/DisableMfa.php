<?php

declare(strict_types=1);

namespace App\Domain\Iam\Actions;

use App\Domain\Iam\Models\MfaFactor;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Support\Facades\DB;

final class DisableMfa
{
    public function __construct(private readonly AuditLogger $audit) {}

    public function __invoke(User $user): void
    {
        if ($user->mfaMandatory()) {
            throw ApiException::unprocessable('SEC-BR-08', 'Tu rol exige la verificación en dos pasos: no se puede desactivar.');
        }

        if (! $user->mfa_enabled && ! MfaFactor::query()->where('user_id', $user->getKey())->exists()) {
            throw ApiException::conflict('MFA_NOT_ENROLLED', 'Tu cuenta no tiene la verificación en dos pasos activa.');
        }

        DB::transaction(function () use ($user): void {
            MfaFactor::query()->where('user_id', $user->getKey())->delete();
            $user->forceFill(['mfa_enabled' => false])->save();
            $this->audit->log('Usuario', (string) $user->code, 'desactivar_mfa', 'TOTP', null);
        });
    }
}
