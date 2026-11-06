<?php

declare(strict_types=1);

namespace App\Domain\Iam\Support;

use App\Domain\Iam\Models\User;

final class RoleExperience
{
    public static function for(User $user): array
    {
        $role = $user->primaryRole();
        $name = $role?->name ?? 'sales';
        $config = config("access.roles.{$name}", ['experience' => 'backoffice', 'home' => '/dashboard']);
        $experience = $role?->getAttribute('experience') ?: $config['experience'];

        return ['role' => $name, ...$config, 'experience' => $experience];
    }

    public static function isBackoffice(User $user): bool
    {
        return self::for($user)['experience'] === 'backoffice';
    }

    public static function isPortal(User $user): bool
    {
        return self::for($user)['experience'] === 'portal';
    }
}
