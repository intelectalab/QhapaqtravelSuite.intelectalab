<?php

declare(strict_types=1);

namespace App\Domain\Showcase\Support;

final class PgArray
{
    public static function literal(array $values): string
    {
        return '{'.implode(',', array_map(fn (mixed $value): string => '"'.addcslashes((string) $value, '"\\').'"', array_values($values))).'}';
    }

    public static function parse(mixed $value): array
    {
        if (is_array($value)) {
            return array_values($value);
        }

        if (! is_string($value) || $value === '' || $value === '{}') {
            return [];
        }

        $json = json_decode($value, true);

        if (is_array($json)) {
            return array_values($json);
        }

        $items = [];
        $current = '';
        $quoted = false;
        $escaped = false;
        $inner = substr($value, 1, -1);

        foreach (mb_str_split($inner) as $char) {
            if ($escaped) {
                $current .= $char;
                $escaped = false;
            } elseif ($char === '\\') {
                $escaped = true;
            } elseif ($char === '"') {
                $quoted = ! $quoted;
            } elseif ($char === ',' && ! $quoted) {
                $items[] = $current;
                $current = '';
            } else {
                $current .= $char;
            }
        }

        $items[] = $current;

        return $items;
    }
}
