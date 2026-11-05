<?php

declare(strict_types=1);

namespace App\Domain\Iam\Support;

use App\Domain\Iam\Models\User;

final class AccessMap
{
    public function for(User $user): array
    {
        $permissions = $user->getAllPermissions()->pluck('name')->flip();
        $screens = collect(config('access.routes'))->map(fn (array $required) => $this->satisfies($required, $permissions->all()));
        $experience = RoleExperience::for($user);

        return [
            'experience' => $experience['experience'],
            'home' => $experience['home'],
            'routes' => $screens->filter()->keys()->values(),
            'screens' => $screens,
        ];
    }

    public function allows(User $user, string $path): bool
    {
        $routes = config('access.routes');
        $match = collect(array_keys($routes))
            ->filter(fn (string $prefix) => $path === $prefix || str_starts_with($path, "{$prefix}/"))
            ->sortByDesc(fn (string $prefix) => strlen($prefix))
            ->first();

        return $match === null || $this->satisfies($routes[$match], $user->getAllPermissions()->pluck('name')->flip()->all());
    }

    private function satisfies(array $required, array $permissions): bool
    {
        return in_array('*', $required, true) || collect($required)->contains(fn (string $permission) => isset($permissions[$permission]));
    }
}
