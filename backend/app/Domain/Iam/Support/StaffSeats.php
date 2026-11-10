<?php

declare(strict_types=1);

namespace App\Domain\Iam\Support;

use Illuminate\Database\Query\Builder;

final class StaffSeats
{
    public const EXTERNAL_LINKS = ['client_id', 'agency_id', 'provider_id', 'reservation_id'];

    public static function count(Builder $users): int
    {
        $users->whereNull('deleted_at')->whereIn('status', ['activo', 'pendiente']);

        foreach (self::EXTERNAL_LINKS as $column) {
            $users->whereNull($column);
        }

        return $users->count();
    }
}
