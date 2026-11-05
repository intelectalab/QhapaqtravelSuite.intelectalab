<?php

declare(strict_types=1);

namespace Database\Support;

use Illuminate\Support\Facades\DB;
use RuntimeException;

final class KitSchema
{
    public static function path(string $file): string
    {
        $path = base_path("../docs/kit/database/{$file}.sql");

        if (! is_file($path)) {
            throw new RuntimeException("No se encontró el esquema {$file}.sql en docs/kit/database.");
        }

        return $path;
    }

    public static function load(string $file): void
    {
        DB::unprepared(file_get_contents(self::path($file)));
    }

    public static function tables(string $file): array
    {
        preg_match_all('/^create table ([a-z0-9_]+)/mi', file_get_contents(self::path($file)), $matches);

        return $matches[1];
    }

    public static function functions(string $file): array
    {
        preg_match_all('/^create (?:or replace )?function ([a-z0-9_]+)\s*\(/mi', file_get_contents(self::path($file)), $matches);

        return array_values(array_unique($matches[1]));
    }

    public static function drop(string $file): void
    {
        foreach (array_reverse(self::tables($file)) as $table) {
            DB::statement("drop table if exists {$table} cascade");
        }

        foreach (self::functions($file) as $function) {
            DB::statement("drop function if exists {$function} cascade");
        }
    }
}
