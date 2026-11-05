<?php

declare(strict_types=1);

namespace App\Domain\Iam\Support;

use App\Domain\Iam\Models\User;

final class RoleExperience
{
    public static function for(User $user): array
    {
        $role = $user->primaryRole()?->name ?? 'sales';

        return ['role' => $role, ...config("access.roles.{$role}", ['experience' => 'backoffice', 'home' => '/dashboard'])];
    }
}
