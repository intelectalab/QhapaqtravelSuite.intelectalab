<?php

declare(strict_types=1);

namespace App\Domain\Admin\Support;

final class PgArray
{
    public static function from(array $values): string
    {
        return '{'.implode(',', array_map(fn (mixed $value): string => '"'.str_replace(['\\', '"'], ['\\\\', '\\"'], (string) $value).'"', array_values($values))).'}';
    }

    public static function parse(?string $literal): array
    {
        if ($literal === null || $literal === '{}' || $literal === '') {
            return [];
        }

        return array_map(fn (string $value): string => stripcslashes(trim($value, '"')), str_getcsv(trim($literal, '{}'), ',', '"', '\\'));
    }
}
