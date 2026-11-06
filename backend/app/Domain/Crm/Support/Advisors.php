<?php

declare(strict_types=1);

namespace App\Domain\Crm\Support;

use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

final class Advisors
{
    public const ROLES = ['tenant_admin', 'manager', 'sales'];

    public function all(array $roles = self::ROLES): Collection
    {
        return DB::table('iam_users as u')
            ->join('model_has_roles as mr', 'mr.model_id', '=', 'u.id')
            ->join('roles as r', 'r.id', '=', 'mr.role_id')
            ->whereIn('r.name', $roles)->where('u.status', 'activo')->whereNull('u.deleted_at')
            ->orderBy('u.name')->distinct()
            ->get(['u.id', 'u.name', 'u.avatar_color'])
            ->map(fn (object $user) => ['id' => $user->id, 'name' => $user->name, 'color' => $user->avatar_color]);
    }

    public function has(string $id, array $roles = self::ROLES): bool
    {
        return $this->all($roles)->contains('id', $id);
    }
}
