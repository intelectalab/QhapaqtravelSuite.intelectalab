<?php

declare(strict_types=1);

namespace App\Domain\Iam\Support;

use App\Domain\Iam\Models\User;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class UserDirectory
{
    private const STAFF_SCOPES = ['tenant', 'mobile'];

    public function list(): Collection
    {
        $roles = DB::table('model_has_roles as m')->join('roles as r', 'r.id', '=', 'm.role_id')->get(['m.model_id', 'r.name', 'r.display_name'])->keyBy('model_id');
        $pending = DB::table('iam_user_invitations')->whereNull('accepted_at')->where('expires_at', '>', now())->pluck('expires_at', 'user_id');

        return DB::table('iam_users as u')
            ->leftJoin('iam_sedes as s', 's.id', '=', 'u.sede_id')
            ->whereNull('u.deleted_at')
            ->orderBy('u.name')
            ->get(['u.id', 'u.code', 'u.name', 'u.email', 'u.phone', 'u.status', 'u.mfa_enabled', 'u.mfa_required', 'u.last_login_at', 'u.avatar_color', 'u.deactivated_reason', 'u.created_at', 's.id as sede_id', 's.name as sede_name'])
            ->map(fn (object $user) => [
                'id' => $user->id,
                'code' => $user->code,
                'name' => $user->name,
                'email' => $user->email,
                'phone' => $user->phone,
                'status' => $user->status,
                'role' => isset($roles[$user->id]) ? ['code' => $roles[$user->id]->name, 'name' => $roles[$user->id]->display_name] : null,
                'sede' => $user->sede_id ? ['id' => $user->sede_id, 'name' => $user->sede_name] : null,
                'mfa' => ['enabled' => (bool) $user->mfa_enabled, 'required' => (bool) $user->mfa_required],
                'last_login_at' => $user->last_login_at,
                'color' => $user->avatar_color,
                'deactivated_reason' => $user->deactivated_reason,
                'invitation_expires_at' => $pending[$user->id] ?? null,
            ]);
    }

    public function find(string $id): array
    {
        $user = User::query()->with(['roles', 'sede'])->whereNull('deleted_at')->where(fn ($query) => Str::isUuid($id) ? $query->whereKey($id) : $query->where('code', $id))->first()
            ?? throw ApiException::notFound('El usuario no existe.');
        $role = $user->primaryRole();
        $pending = DB::table('iam_user_invitations')->where('user_id', $user->getKey())->whereNull('accepted_at')->where('expires_at', '>', now())->max('expires_at');
        $activity = DB::table('audit_events')
            ->where(fn ($query) => $query->where('actor_id', $user->getKey())->orWhere(fn ($own) => $own->where('entity', 'Usuario')->whereIn('entity_id', array_filter([$user->code, $user->email]))))
            ->orderByDesc('occurred_at')
            ->limit(8)
            ->get(['id', 'code', 'entity', 'entity_id', 'action', 'before_value', 'after_value', 'is_critical', 'occurred_at']);

        return [
            'id' => $user->getKey(),
            'code' => $user->code,
            'name' => $user->name,
            'email' => $user->email,
            'phone' => $user->phone,
            'sede_id' => $user->sede_id,
            'status' => $user->status,
            'mfa_enabled' => (bool) $user->mfa_enabled,
            'mfa_required' => (bool) $user->mfa_required,
            'last_login_at' => $user->last_login_at?->toIso8601String(),
            'last_login_ip' => $user->last_login_ip,
            'avatar_color' => $user->avatar_color,
            'invited_at' => $user->invited_at?->toIso8601String(),
            'deactivated_at' => $user->deactivated_at?->toIso8601String(),
            'deactivated_reason' => $user->deactivated_reason,
            'locale' => $user->locale,
            'created_at' => $user->created_at?->toIso8601String(),
            'updated_at' => $user->updated_at?->toIso8601String(),
            'role' => $role ? ['code' => $role->name, 'name' => $role->display_name, 'scope' => $role->scope] : null,
            'sede' => $user->sede ? ['id' => $user->sede->getKey(), 'name' => $user->sede->name] : null,
            'invitation_expires_at' => $pending,
            'permissions' => $user->getAllPermissions()->pluck('name')->sort()->values()->all(),
            'activity' => $activity->map(fn (object $event): array => [
                'id' => $event->id,
                'code' => (string) $event->code,
                'entity' => $event->entity,
                'entity_id' => $event->entity_id,
                'action' => $event->action,
                'before' => $event->before_value,
                'after' => $event->after_value,
                'critical' => (bool) $event->is_critical,
                'at' => $event->occurred_at,
            ])->values()->all(),
        ];
    }

    public function options(): array
    {
        return [
            'roles' => DB::table('roles')->whereIn('scope', self::STAFF_SCOPES)->where('name', '<>', 'super_admin')->orderBy('display_name')->get(['name as code', 'display_name as name', 'description']),
            'sedes' => DB::table('iam_sedes')->whereNull('deleted_at')->where('status', 'activa')->orderByDesc('is_main')->orderBy('name')->get(['id', 'name']),
        ];
    }
}
