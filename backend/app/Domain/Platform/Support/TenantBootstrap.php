<?php

declare(strict_types=1);

namespace App\Domain\Platform\Support;

use App\Domain\Iam\Models\Permission;
use App\Domain\Iam\Models\Role;
use App\Domain\Platform\Models\Tenant;
use Database\Support\KitSeeds;
use Illuminate\Support\Arr;

final class TenantBootstrap
{
    public const SUPPLIER_PERMISSIONS = [
        'supplier.portal.view',
        'supplier.requests.respond',
        'supplier.rooming.manage',
        'supplier.vouchers.redeem',
        'supplier.payables.view',
        'supplier.invoices.upload',
        'supplier.incidents.report',
        'supplier.rates.request',
        'supplier.users.manage',
    ];

    public const EXTRA_PERMISSIONS = [
        'CRM' => ['crm.records.reassign'],
        'Extranet' => self::SUPPLIER_PERMISSIONS,
    ];

    public const ROLE_EXTRA_PERMISSIONS = [
        'tenant_admin' => ['crm.records.reassign'],
        'manager' => ['crm.records.reassign'],
        'provider' => self::SUPPLIER_PERMISSIONS,
    ];

    public const PLATFORM_ONLY = ['admin.tenant.manage'];

    public static function extraPermissionRows(): array
    {
        return collect(self::EXTRA_PERMISSIONS)
            ->flatMap(fn (array $names, string $module) => array_map(fn (string $name) => ['module' => $module, 'name' => $name], $names))
            ->values()
            ->all();
    }

    public static function permissionsFor(string $role): array
    {
        return array_values(array_diff([...(KitSeeds::read('rolePerms')[$role] ?? []), ...(self::ROLE_EXTRA_PERMISSIONS[$role] ?? [])], self::PLATFORM_ONLY));
    }

    public function roles(Tenant $tenant, ?array $permissions = null): array
    {
        $permissions ??= Permission::query()->where('guard_name', 'api')->get()->keyBy('name')->all();
        $roles = [];

        foreach (KitSeeds::read('roles') as $seed) {
            if ($seed['scope'] === 'plataforma') {
                continue;
            }
            $role = Role::query()->updateOrCreate(
                ['name' => $seed['id'], 'guard_name' => 'api', 'tenant_id' => $tenant->getKey()],
                [
                    'display_name' => $seed['name'],
                    'description' => $seed['desc'] ?? null,
                    'scope' => $seed['scope'],
                    'experience' => config("access.roles.{$seed['id']}.experience", 'backoffice'),
                ],
            );
            $role->syncPermissions(array_values(Arr::only($permissions, self::permissionsFor($seed['id']))));
            $roles[$seed['id']] = $role;
        }

        return $roles;
    }
}
