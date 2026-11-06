<?php

declare(strict_types=1);

namespace App\Domain\Crm\Support;

use Illuminate\Support\Carbon;

final class TargetPeriod
{
    public static function range(string $key): array
    {
        if (preg_match('/^(\d{4})-Q([1-4])$/', $key, $match) === 1) {
            $start = Carbon::create((int) $match[1], ((int) $match[2] - 1) * 3 + 1, 1);

            return [$start->toDateString(), $start->copy()->addMonths(2)->endOfMonth()->toDateString()];
        }

        $start = Carbon::parse("{$key}-01");

        return [$start->toDateString(), $start->copy()->endOfMonth()->toDateString()];
    }

    public static function type(string $key): string
    {
        return str_contains($key, 'Q') ? 'trimestre' : 'mes';
    }

    public static function label(string $key): string
    {
        if (preg_match('/^(\d{4})-Q([1-4])$/', $key, $match) === 1) {
            return "{$match[2]}.º trimestre {$match[1]}";
        }

        $months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'setiembre', 'octubre', 'noviembre', 'diciembre'];
        $date = Carbon::parse("{$key}-01");

        return ucfirst($months[$date->month - 1]).' '.$date->year;
    }

    public static function current(string $type, ?Carbon $today = null): string
    {
        $today ??= Carbon::today();

        return $type === 'trimestre' ? $today->year.'-Q'.(int) ceil($today->month / 3) : $today->format('Y-m');
    }
}
