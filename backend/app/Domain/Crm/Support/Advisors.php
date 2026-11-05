<?php

declare(strict_types=1);

namespace App\Domain\Crm\Support;

use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

final class Advisors
{
    public const ROLES = ['tenant_admin', 'manager', 'sales'];

    public function all(): Collection
    {
        return DB::table('iam_users as u')
            ->join('model_has_roles as mr', 'mr.model_id', '=', 'u.id')
            ->join('roles as r', 'r.id', '=', 'mr.role_id')
            ->whereIn('r.name', self::ROLES)->where('u.status', 'activo')->whereNull('u.deleted_at')
            ->orderBy('u.name')->distinct()
            ->get(['u.id', 'u.name', 'u.avatar_color'])
            ->map(fn (object $user) => ['id' => $user->id, 'name' => $user->name, 'color' => $user->avatar_color]);
    }

    public function has(string $id): bool
    {
        return $this->all()->contains('id', $id);
    }
}
