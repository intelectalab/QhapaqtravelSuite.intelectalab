<?php

declare(strict_types=1);

namespace Database\Seeders\Modules;

use App\Domain\Iam\Models\Permission;
use App\Domain\Iam\Models\Role;
use App\Domain\Platform\Models\Tenant;
use App\Domain\Platform\Support\TenantBootstrap;
use Spatie\Permission\PermissionRegistrar;

final class AccessMatrixSeeder
{
    public const ORDER = 1;

    public function __construct(private readonly Tenant $tenant) {}

    public function run(): void
    {
        foreach (TenantBootstrap::extraPermissionRows() as $row) {
            Permission::query()->firstOrCreate(['name' => $row['name'], 'guard_name' => 'api'], ['module' => $row['module']]);
        }

        $permissions = Permission::query()->where('guard_name', 'api')->get()->keyBy('name');

        foreach (Role::query()->with('permissions')->where('tenant_id', $this->tenant->getKey())->where('guard_name', 'api')->get() as $role) {
            $granted = $role->permissions->pluck('name')->flip();
            $missing = collect(TenantBootstrap::permissionsFor($role->name))
                ->reject(fn (string $name) => $granted->has($name))
                ->map(fn (string $name) => $permissions->get($name))
                ->filter()
                ->values();

            if ($missing->isNotEmpty()) {
                $role->givePermissionTo($missing->all());
            }
        }

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }
}
