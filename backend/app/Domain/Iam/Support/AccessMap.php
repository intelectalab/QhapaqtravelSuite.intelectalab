<?php

declare(strict_types=1);

namespace App\Domain\Iam\Support;

use App\Domain\Iam\Models\User;
use App\Domain\Platform\Support\Entitlements;
use Illuminate\Support\Facades\DB;

final class AccessMap
{
    public function for(User $user): array
    {
        $permissions = $user->getAllPermissions()->pluck('name')->flip();
        $experience = RoleExperience::for($user);
        $backoffice = $experience['experience'] === 'backoffice';
        $screens = collect(config('access.routes'))->map(fn (array $required) => $backoffice && $this->satisfies($required, $permissions->all()));

        return [
            'experience' => $experience['experience'],
            'home' => $experience['home'],
            'routes' => $screens->filter()->keys()->values(),
            'screens' => $screens,
            'locked' => $this->locked((string) $user->tenant_id),
        ];
    }

    private function locked(string $tenantId): array
    {
        $features = app(Entitlements::class)->for($tenantId);

        return collect((array) config('entitlements.screens'))
            ->reject(fn (array $paths, string $feature): bool => (bool) ($features[$feature]['enabled'] ?? true))
            ->flatMap(fn (array $paths, string $feature): array => collect($paths)->mapWithKeys(fn (string $path): array => [$path => ['feature' => $feature, 'label' => (string) ($features[$feature]['label'] ?? $feature)]])->all())
            ->all();
    }

    public function allows(User $user, string $path): bool
    {
        $routes = config('access.routes');
        $match = $this->match($path);

        return RoleExperience::isBackoffice($user) && ($match === null || $this->satisfies($routes[$match], $user->getAllPermissions()->pluck('name')->flip()->all()));
    }

    public function requiredFor(string $path): array
    {
        $match = $this->match($path);

        return $match === null ? [] : array_values(array_diff(config('access.routes')[$match], ['*']));
    }

    public function matrix(): array
    {
        $routes = config('access.routes');
        $experiences = collect(config('access.roles'))->map(fn (array $role) => $role['experience']);
        $grants = DB::table('role_has_permissions as rp')->join('permissions as p', 'p.id', '=', 'rp.permission_id')->get(['rp.role_id', 'p.name'])->groupBy('role_id');
        $roles = DB::table('roles')->where('name', '<>', 'super_admin')->orderByRaw("case scope when 'tenant' then 0 when 'mobile' then 1 else 2 end")->orderBy('is_custom')->orderBy('display_name')->get(['id', 'name', 'display_name', 'scope', 'is_custom', 'experience']);

        $rows = $roles->map(function (object $role) use ($routes, $grants, $experiences): array {
            $permissions = ($grants[$role->id] ?? collect())->pluck('name')->flip()->all();
            $experience = $experiences[$role->name] ?? $role->experience ?? 'backoffice';
            $screens = collect($routes)->map(fn (array $required) => $experience === 'backoffice' && $this->satisfies($required, $permissions));

            return [
                'role' => $role->name,
                'name' => $role->display_name,
                'scope' => $role->scope,
                'custom' => (bool) $role->is_custom,
                'experience' => $experience,
                'screens' => $screens->all(),
                'allowed' => $screens->filter()->count(),
            ];
        })->values();

        return [
            'screens' => collect($routes)->map(fn (array $required, string $path): array => ['path' => $path, 'permissions' => $required])->values()->all(),
            'roles' => $rows->all(),
            'summary' => $rows->map(fn (array $row): array => ['role' => $row['role'], 'name' => $row['name'], 'allowed' => $row['allowed'], 'total' => count($routes)])->all(),
        ];
    }

    private function match(string $path): ?string
    {
        return collect(array_keys(config('access.routes')))
            ->filter(fn (string $prefix) => $path === $prefix || str_starts_with($path, "{$prefix}/"))
            ->sortByDesc(fn (string $prefix) => strlen($prefix))
            ->first();
    }

    private function satisfies(array $required, array $permissions): bool
    {
        return in_array('*', $required, true) || collect($required)->contains(fn (string $permission) => isset($permissions[$permission]));
    }
}
