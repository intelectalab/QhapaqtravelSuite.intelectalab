<?php

declare(strict_types=1);

namespace App\Domain\Iam\Actions;

use App\Domain\Iam\Models\AccessToken;
use App\Domain\Iam\Models\User;
use App\Domain\Iam\Support\RoleExperience;
use Illuminate\Support\Facades\Request;
use Illuminate\Support\Str;

final class IssueAccessToken
{
    public function __invoke(User $user, ?string $deviceName = null): string
    {
        $experience = RoleExperience::for($user)['experience'];
        $plain = Str::random(48);

        $token = $user->tokens()->create([
            'tenant_id' => $user->tenant_id,
            'name' => $deviceName ?: 'web',
            'token' => hash('sha256', $plain),
            'abilities' => $user->needsMfa() ? ['mfa:verify'] : ['*'],
            'experience' => $experience,
            'expires_at' => AccessToken::expiresAfter(60 * (int) config("access.session_hours.{$experience}", 12)),
            'device_name' => $deviceName,
            'ip' => Request::ip(),
        ]);

        return $token->getKey().'|'.$plain;
    }

    public function completeMfa(AccessToken $token): void
    {
        $token->forceFill(['abilities' => ['*'], 'mfa_verified_at' => now()])->save();
    }
}
