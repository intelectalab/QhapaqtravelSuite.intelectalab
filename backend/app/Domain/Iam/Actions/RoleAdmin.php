<?php

declare(strict_types=1);

namespace App\Domain\Iam\Actions;

use App\Domain\Iam\Models\Permission;
use App\Domain\Iam\Models\Role;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Tenancy\TenantContext;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Spatie\Permission\PermissionRegistrar;

final class RoleAdmin
{
    private const PLATFORM_ONLY = ['admin.tenant.manage'];

    private const ADMIN_LOCKED = ['admin.roles.manage', 'admin.users.manage'];

    public function __construct(private readonly AuditLogger $audit, private readonly TenantContext $context) {}

    public function list(): Collection
    {
        $permissions = DB::table('role_has_permissions as rp')->join('permissions as p', 'p.id', '=', 'rp.permission_id')->get(['rp.role_id', 'p.name'])->groupBy('role_id');
        $users = DB::table('model_has_roles as m')->join('iam_users as u', 'u.id', '=', 'm.model_id')->where('u.status', 'activo')->whereNull('u.deleted_at')
            ->selectRaw('m.role_id, count(*) as total')->groupBy('m.role_id')->pluck('total', 'role_id');

        return DB::table('roles')->where('name', '<>', 'super_admin')->orderByRaw("case scope when 'tenant' then 0 when 'mobile' then 1 else 2 end")->orderBy('is_custom')->orderBy('display_name')
            ->get(['id', 'name', 'display_name', 'description', 'scope', 'is_custom'])
            ->map(fn (object $role) => [
                'code' => $role->name,
                'name' => $role->display_name,
                'description' => $role->description,
                'scope' => $role->scope,
                'custom' => (bool) $role->is_custom,
                'users' => (int) ($users[$role->id] ?? 0),
                'permissions' => ($permissions[$role->id] ?? collect())->pluck('name')->values(),
            ]);
    }

    public function catalog(): Collection
    {
        return Permission::query()->where('guard_name', 'api')->whereNotIn('name', self::PLATFORM_ONLY)->orderBy('module')->orderBy('name')->get(['name', 'module'])
            ->groupBy('module')->map(fn (Collection $items, string $module) => ['module' => $module, 'permissions' => $items->pluck('name')->values()])->values();
    }

    public function create(array $data, User $actor): string
    {
        $name = trim($data['name']);
        $this->assertUniqueName($name, null);
        $code = 'custom_'.Str::limit(Str::slug($name, '_'), 30, '').'_'.Str::lower(Str::random(4));
        $source = ! empty($data['copy_from']) ? $this->role($data['copy_from']) : null;

        DB::transaction(function () use ($code, $name, $data, $source, $actor): void {
            $role = Role::query()->create([
                'name' => $code,
                'guard_name' => 'api',
                'tenant_id' => $this->context->idOrFail(),
                'display_name' => $name,
                'description' => trim($data['description']),
                'scope' => $data['scope'],
                'is_custom' => true,
                'experience' => $data['scope'] === 'mobile' ? 'mobile' : ($data['scope'] === 'canal' ? 'portal' : 'backoffice'),
                'created_by' => $actor->getKey(),
            ]);

            if ($source) {
                $allowed = $source->permissions->pluck('name')->filter(fn (string $permission) => $this->blockedReason($role, $permission, true) === null)->values()->all();
                $role->syncPermissions($allowed);
            }

            $this->audit->log('Rol', $code, 'crear_rol', $source?->display_name, $name);
        });
        $this->flush();

        return $code;
    }

    public function update(string $code, array $data, User $actor): void
    {
        $role = $this->role($code);
        $this->assertCustom($role);
        $name = trim($data['name']);
        $this->assertUniqueName($name, $role);
        $role->forceFill(['display_name' => $name, 'description' => trim($data['description']), 'updated_by' => $actor->getKey()])->save();
        $this->audit->log('Rol', $code, 'editar_rol', after: $name);
    }

    public function delete(string $code): void
    {
        $role = $this->role($code);
        $this->assertCustom($role);

        if (DB::table('model_has_roles')->where('role_id', $role->getKey())->exists()) {
            throw ApiException::conflict('RBAC-BR-07', 'Este rol tiene usuarios asignados. Cámbialos de rol antes de eliminarlo.');
        }

        $role->syncPermissions([]);
        $role->delete();
        $this->audit->log('Rol', $code, 'eliminar_rol', $role->display_name);
        $this->flush();
    }

    public function set(string $code, array $permissions, bool $grant): array
    {
        $role = $this->role($code);
        $current = $role->permissions->pluck('name');
        $applied = [];
        $blocked = [];

        foreach (array_unique($permissions) as $permission) {
            $reason = $this->blockedReason($role, $permission, $grant);
            if ($reason !== null) {
                $blocked[] = ['permission' => $permission, 'reason' => $reason];

                continue;
            }
            if ($grant === $current->contains($permission)) {
                continue;
            }
            $grant ? $role->givePermissionTo($permission) : $role->revokePermissionTo($permission);
            $this->audit->log('Permiso', "{$code}:{$permission}", $grant ? 'otorgar_permiso' : 'revocar_permiso', $grant ? null : $permission, $grant ? $permission : null);
            $applied[] = $permission;
        }

        $this->flush();

        return ['applied' => $applied, 'blocked' => $blocked];
    }

    private function blockedReason(Role $role, string $permission, bool $grant): ?string
    {
        if (! Permission::query()->where('name', $permission)->where('guard_name', 'api')->exists()) {
            return 'Ese permiso no existe.';
        }

        if (in_array($permission, self::PLATFORM_ONLY, true)) {
            return 'Reservado a la plataforma.';
        }

        if (! $grant) {
            return $role->name === 'tenant_admin' && in_array($permission, self::ADMIN_LOCKED, true) ? 'El administrador no puede perder la gestión de usuarios y roles.' : null;
        }

        if (in_array($role->scope, ['canal', 'mobile'], true)) {
            if (str_starts_with($permission, 'admin.')) {
                return 'Los roles externos o móviles no administran la agencia.';
            }
            if (str_starts_with($permission, 'finance.') || str_contains($permission, 'profitability') || $permission === 'quotes.discount_override') {
                return 'Los roles externos o móviles no ven finanzas ni rentabilidad.';
            }
        }

        return null;
    }

    private function assertUniqueName(string $name, ?Role $current): void
    {
        $exists = DB::table('roles')->whereRaw('lower(display_name) = ?', [Str::lower($name)])->when($current, fn ($query) => $query->where('id', '<>', $current->getKey()))->exists();

        if ($exists) {
            throw ApiException::unprocessable('RBAC-BR-06', 'Ya existe un rol con ese nombre.');
        }
    }

    private function assertCustom(Role $role): void
    {
        if (! $role->is_custom) {
            throw ApiException::forbidden('RBAC-BR-06', 'Los roles base no se renombran ni se eliminan; solo se ajustan sus permisos.');
        }
    }

    private function role(string $code): Role
    {
        if ($code === 'super_admin') {
            throw ApiException::forbidden('RBAC-BR-01', 'El rol de la plataforma no se edita desde la agencia.');
        }

        return Role::query()->where('name', $code)->first() ?? throw ApiException::notFound('El rol no existe.');
    }

    private function flush(): void
    {
        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }
}
