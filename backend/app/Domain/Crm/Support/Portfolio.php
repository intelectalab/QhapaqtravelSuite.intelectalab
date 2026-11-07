<?php

declare(strict_types=1);

namespace App\Domain\Crm\Support;

use App\Domain\Iam\Models\User;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\DB;

final class Portfolio
{
    public static function ownOnly(User $viewer): bool
    {
        return $viewer->can('crm.leads.manage') && ! $viewer->can('crm.records.reassign');
    }

    public static function owns(User $viewer, ?string $ownerId): bool
    {
        return self::ownOnly($viewer) && $ownerId !== null && $ownerId === (string) $viewer->getKey();
    }

    public static function scope(Builder $query, User $viewer, string $ownerColumn): Builder
    {
        return self::ownOnly($viewer) ? $query->where($ownerColumn, $viewer->getKey()) : $query;
    }

    public static function missing(User $viewer, string $table, string $code, string $notFound, string $entity, string $ownerColumn = 'owner_id'): ApiException
    {
        if (self::ownOnly($viewer)) {
            $owner = DB::table($table)->where('code', $code)->value($ownerColumn);

            if ($owner !== null && (string) $owner !== (string) $viewer->getKey()) {
                return ApiException::forbidden('SEC-BR-09', "{$entity} pertenece a la cartera de otro asesor. Si necesitas trabajarla, pide a tu gerente que te la reasigne.");
            }
        }

        return ApiException::notFound($notFound);
    }
}
