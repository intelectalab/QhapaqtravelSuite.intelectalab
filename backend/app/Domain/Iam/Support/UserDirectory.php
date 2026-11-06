<?php

declare(strict_types=1);

namespace App\Domain\Iam\Support;

use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

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

    public function options(): array
    {
        return [
            'roles' => DB::table('roles')->whereIn('scope', self::STAFF_SCOPES)->where('name', '<>', 'super_admin')->orderBy('display_name')->get(['name as code', 'display_name as name', 'description']),
            'sedes' => DB::table('iam_sedes')->whereNull('deleted_at')->where('status', 'activa')->orderByDesc('is_main')->orderBy('name')->get(['id', 'name']),
        ];
    }
}
