<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Domain\Iam\Models\MfaFactor;
use App\Domain\Iam\Models\Permission;
use App\Domain\Iam\Models\Role;
use App\Domain\Iam\Models\Sede;
use App\Domain\Iam\Models\User;
use App\Domain\Platform\Models\Plan;
use App\Domain\Platform\Models\PlatformUser;
use App\Domain\Platform\Models\Tenant;
use App\Domain\Shared\Tenancy\TenantContext;
use Database\Support\KitSeeds;
use Illuminate\Database\Seeder;
use Illuminate\Support\Arr;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;
use Spatie\Permission\PermissionRegistrar;

final class DemoSeeder extends Seeder
{
    private const EXTRA_PERMISSIONS = [['module' => 'CRM', 'name' => 'crm.records.reassign']];

    private const ROLE_EXTRA_PERMISSIONS = ['tenant_admin' => ['crm.records.reassign'], 'manager' => ['crm.records.reassign']];

    private const PLATFORM_ONLY = ['admin.tenant.manage'];

    private const DEMO_TENANTS = [
        'TNT-0001' => ['business_type' => 'Operador turístico', 'address' => 'Av. José Larco 1150, Of. 602, Miraflores, Lima', 'city' => 'Lima', 'initials' => 'AH', 'short' => 'Andes Horizonte'],
        'TNT-0002' => ['business_type' => 'Operador turístico', 'address' => 'Jr. Loreto 255, Tambopata, Madre de Dios', 'city' => 'Puerto Maldonado', 'initials' => 'SV', 'short' => 'Selva Viva'],
        'TNT-0003' => ['business_type' => 'DMC / receptivo', 'address' => 'Calle Bolognesi 310, Paracas, Ica', 'city' => 'Paracas', 'initials' => 'CS', 'short' => 'Costa Sur DMC'],
        'TNT-0004' => ['business_type' => 'Agencia corporativa', 'address' => 'Av. Ejército 702, Yanahuara, Arequipa', 'city' => 'Arequipa', 'initials' => 'AC', 'short' => 'Altiplano Corporate'],
        'TNT-0005' => ['business_type' => 'Agencia de viajes minorista', 'address' => 'Jr. Pizarro 455, Trujillo, La Libertad', 'city' => 'Trujillo', 'initials' => 'RN', 'short' => 'Ruta Norte'],
        'TNT-0006' => ['business_type' => 'Operador turístico', 'address' => 'Av. Luzuriaga 840, Huaraz, Áncash', 'city' => 'Huaraz', 'initials' => 'NT', 'short' => 'Nevados Tours', 'suspend_reason' => 'Tres facturas de suscripción vencidas sin respuesta del administrador.'],
    ];

    public function run(): void
    {
        $plans = $this->seedPlans();
        $permissions = $this->seedPermissions();
        $this->seedPlatformUsers();

        foreach (KitSeeds::read('tenants') as $tenantSeed) {
            if (! isset(self::DEMO_TENANTS[$tenantSeed['id']])) {
                continue;
            }
            $tenant = $this->seedTenant($tenantSeed, $plans[$tenantSeed['plan']]);
            $this->withinTenant($tenant, fn () => $this->seedTenantData($tenant, $tenantSeed, $permissions));

            if ($tenant->code === 'TNT-0001') {
                $this->withinTenant($tenant, fn () => (new CrmDemoSeeder($tenant))->run());
            }
        }

        app(TenantContext::class)->clear();
    }

    private function seedPlatformUsers(): void
    {
        foreach (KitSeeds::read('users') as $seed) {
            if ($seed['role'] !== 'super_admin') {
                continue;
            }
            PlatformUser::query()->updateOrCreate(['email' => Str::lower($seed['email'])], [
                'name' => $seed['name'],
                'password' => (string) config('demo.password'),
                'mfa_secret' => (string) config('demo.totp_secret'),
                'status' => $seed['status'],
            ]);
        }
    }

    private function seedPlans(): array
    {
        return (new PlanCatalogSeeder())->run();
    }

    private function seedPermissions(): array
    {
        $rows = collect(KitSeeds::read('permissionGroups'))
            ->flatMap(fn (array $group) => array_map(fn (string $name) => ['module' => $group['module'], 'name' => $name], $group['perms']))
            ->concat(self::EXTRA_PERMISSIONS);

        return $rows->mapWithKeys(fn (array $row) => [
            $row['name'] => Permission::query()->firstOrCreate(['name' => $row['name'], 'guard_name' => 'api'], ['module' => $row['module']]),
        ])->all();
    }

    private function seedTenant(array $seed, Plan $plan): Tenant
    {
        $extra = self::DEMO_TENANTS[$seed['id']];

        return tap(Tenant::query()->updateOrCreate(['code' => $seed['id']], [
            'legal_name' => $seed['name'],
            'commercial_name' => $extra['short'],
            'ruc' => $seed['ruc'],
            'fiscal_address' => $extra['address'],
            'business_type' => $extra['business_type'],
            'subdomain' => $seed['subdomain'],
            'logo_initials' => $extra['initials'],
            'plan_id' => $plan->getKey(),
            'status' => $seed['status'],
            'trial_ends_at' => $seed['status'] === 'prueba' ? Carbon::parse($seed['createdAt'])->addDays($plan->trial_days ?: 14) : null,
            'suspend_reason' => $seed['status'] === 'suspendido' ? $extra['suspend_reason'] : null,
            'suspended_at' => $seed['status'] === 'suspendido' ? Carbon::parse($seed['createdAt'])->addMonths(3) : null,
            'mrr' => $seed['mrr'] ?? 0,
            'modules' => $seed['modules'] ?? 0,
            'storage_used_bytes' => $this->bytes($seed['storage'] ?? '0 GB'),
            'admin_email' => $seed['adminEmail'],
        ])->forceFill(['created_at' => Carbon::parse($seed['createdAt'])]), fn (Tenant $tenant) => $tenant->save());
    }

    private function bytes(string $size): int
    {
        [$amount, $unit] = array_pad(explode(' ', trim($size)), 2, 'GB');
        $power = ['KB' => 1, 'MB' => 2, 'GB' => 3, 'TB' => 4][strtoupper($unit)] ?? 3;

        return (int) round((float) $amount * 1024 ** $power);
    }

    private function withinTenant(Tenant $tenant, callable $callback): void
    {
        app(TenantContext::class)->set($tenant);
        app(PermissionRegistrar::class)->setPermissionsTeamId($tenant->getKey());
        $callback();
    }

    private function seedTenantData(Tenant $tenant, array $tenantSeed, array $permissions): void
    {
        $sedes = $this->seedSedes($tenant);
        $roles = $this->seedRoles($tenant, $permissions);
        $users = $tenant->code === 'TNT-0001'
            ? array_filter(KitSeeds::read('users'), fn (array $user) => $user['role'] !== 'super_admin')
            : [['id' => 'U01', 'name' => 'Administrador '.self::DEMO_TENANTS[$tenant->code]['short'], 'email' => $tenantSeed['adminEmail'], 'role' => 'tenant_admin', 'sede' => 'SED-01', 'status' => 'activo', 'mfa' => false]];

        foreach ($users as $userSeed) {
            $this->seedUser($userSeed, $sedes, $roles);
        }

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }

    private function seedSedes(Tenant $tenant): array
    {
        $seeds = $tenant->code === 'TNT-0001'
            ? KitSeeds::read('sedes')
            : [['id' => 'SED-01', 'name' => self::DEMO_TENANTS[$tenant->code]['city'], 'address' => self::DEMO_TENANTS[$tenant->code]['address'], 'phone' => null, 'status' => 'activa']];

        $sedes = [];
        foreach ($seeds as $index => $seed) {
            $sedes[$seed['id']] = Sede::query()->updateOrCreate(['code' => $seed['id']], [
                'name' => $seed['name'],
                'city' => Str::before($seed['name'], ' —'),
                'address' => $seed['address'],
                'phone' => $seed['phone'],
                'status' => $seed['status'],
                'is_main' => $index === 0,
            ]);
        }

        return $sedes;
    }

    private function seedRoles(Tenant $tenant, array $permissions): array
    {
        $rolePermissions = KitSeeds::read('rolePerms');
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
            $names = array_diff([...($rolePermissions[$seed['id']] ?? []), ...(self::ROLE_EXTRA_PERMISSIONS[$seed['id']] ?? [])], self::PLATFORM_ONLY);
            $role->syncPermissions(array_values(Arr::only($permissions, $names)));
            $roles[$seed['id']] = $role;
        }

        return $roles;
    }

    private function seedUser(array $seed, array $sedes, array $roles): void
    {
        $user = User::query()->updateOrCreate(['email' => Str::lower($seed['email'])], [
            'code' => $seed['id'],
            'name' => $seed['name'],
            'password' => (string) config('demo.password'),
            'phone' => $seed['phone'] ?? null,
            'sede_id' => ($sedes[$seed['sede']] ?? reset($sedes))->getKey(),
            'status' => $seed['status'],
            'mfa_enabled' => (bool) $seed['mfa'],
            'mfa_required' => in_array($seed['role'], config('access.mfa_roles'), true),
            'avatar_color' => $seed['color'] ?? null,
        ]);

        $user->syncRoles([$roles[$seed['role']]]);

        if ($seed['mfa']) {
            MfaFactor::query()->updateOrCreate(['user_id' => $user->getKey()], [
                'type' => 'totp',
                'secret' => (string) config('demo.totp_secret'),
                'confirmed_at' => now(),
            ]);
        }
    }
}
