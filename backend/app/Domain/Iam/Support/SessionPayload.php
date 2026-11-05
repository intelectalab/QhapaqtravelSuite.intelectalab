<?php

declare(strict_types=1);

namespace App\Domain\Iam\Support;

use App\Domain\Iam\Models\User;

final class SessionPayload
{
    public static function make(User $user, ?string $token, bool $mfaPending): array
    {
        $access = RoleExperience::for($user);

        return array_filter([
            'token' => $token,
            'token_type' => $token === null ? null : 'Bearer',
            'mfa_required' => $mfaPending,
            'experience' => $access['experience'],
            'home' => $access['home'],
        ], fn ($value) => $value !== null);
    }
}
