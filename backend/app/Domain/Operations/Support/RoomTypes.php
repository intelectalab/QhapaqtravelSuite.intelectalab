<?php

declare(strict_types=1);

namespace App\Domain\Operations\Support;

final class RoomTypes
{
    public const CAPACITY = ['Simple' => 1, 'Doble' => 2, 'Doble twin' => 2, 'Matrimonial' => 2, 'Triple' => 3, 'Junior suite' => 2];

    public static function capacity(string $type): int
    {
        return self::CAPACITY[$type] ?? 2;
    }
}
