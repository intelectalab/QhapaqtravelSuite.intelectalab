<?php

declare(strict_types=1);

namespace App\Domain\Channels\Support;

use Illuminate\Support\Facades\DB;

final class B2bRecipients
{
    public function executives(): array
    {
        return DB::table('iam_users as u')
            ->join('model_has_roles as mr', 'mr.model_id', '=', 'u.id')
            ->join('role_has_permissions as rp', 'rp.role_id', '=', 'mr.role_id')
            ->join('permissions as p', 'p.id', '=', 'rp.permission_id')
            ->whereNull('u.deleted_at')->where('u.status', 'activo')->whereNull('u.client_id')->whereNull('u.agency_id')->where('p.name', 'channels.b2b.manage')
            ->distinct()->orderBy('u.id')->pluck('u.id')->map(fn (mixed $id): string => (string) $id)->all();
    }

    public function agencyUsers(string $agencyId): array
    {
        return DB::table('iam_users')->whereNull('deleted_at')->where('status', 'activo')->where('agency_id', $agencyId)
            ->orderBy('id')->pluck('id')->map(fn (mixed $id): string => (string) $id)->all();
    }
}
