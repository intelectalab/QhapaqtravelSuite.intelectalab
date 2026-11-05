<?php

declare(strict_types=1);

namespace App\Domain\Crm\Support;

use App\Domain\Iam\Models\User;
use Illuminate\Database\Query\Builder;

final class Portfolio
{
    public static function ownOnly(User $viewer): bool
    {
        return $viewer->hasRole('sales') && ! $viewer->can('crm.records.reassign');
    }

    public static function scope(Builder $query, User $viewer, string $ownerColumn): Builder
    {
        return self::ownOnly($viewer) ? $query->where($ownerColumn, $viewer->getKey()) : $query;
    }
}
