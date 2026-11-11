<?php

declare(strict_types=1);

namespace App\Domain\Catalog\Support;

final class CancellationTiers
{
    public const STANDARD = [['min_days' => 15, 'pct' => 0], ['min_days' => 7, 'pct' => 50], ['min_days' => 0, 'pct' => 100]];

    public const MAX_ROWS = 8;

    public static function rules(string $prefix = ''): array
    {
        return [
            "{$prefix}penalty_tiers" => ['nullable', 'array', 'max:'.self::MAX_ROWS],
            "{$prefix}penalty_tiers.*.min_days" => ['required', 'integer', 'between:0,365', 'distinct'],
            "{$prefix}penalty_tiers.*.pct" => ['required', 'integer', 'between:0,100'],
        ];
    }

    public static function messages(string $prefix = ''): array
    {
        return [
            "{$prefix}penalty_tiers.max" => 'Usa hasta '.self::MAX_ROWS.' tramos.',
            "{$prefix}penalty_tiers.*.min_days.distinct" => 'Cada tramo debe empezar en un número de días distinto.',
            "{$prefix}penalty_tiers.*.min_days.*" => 'Los días van de 0 a 365.',
            "{$prefix}penalty_tiers.*.pct.*" => 'La penalidad va de 0 a 100 %.',
        ];
    }

    public static function normalize(mixed $tiers): array
    {
        if (is_string($tiers)) {
            $tiers = json_decode($tiers, true);
        }

        if (! is_array($tiers)) {
            return [];
        }

        $rows = [];
        foreach ($tiers as $tier) {
            if (is_array($tier) && isset($tier['min_days'], $tier['pct'])) {
                $rows[(int) $tier['min_days']] = ['min_days' => max(0, min(365, (int) $tier['min_days'])), 'pct' => max(0, min(100, (int) $tier['pct']))];
            } elseif (is_array($tier) && array_is_list($tier) && count($tier) === 2) {
                $rows[(int) $tier[0]] = ['min_days' => max(0, (int) $tier[0]), 'pct' => max(0, min(100, (int) $tier[1]))];
            }
        }

        krsort($rows);

        return array_values($rows);
    }

    public static function fromText(?string $policy): array
    {
        $text = mb_strtolower((string) $policy);

        $pairs = match (true) {
            str_contains($text, '48 h') && str_contains($text, 'sin penalidad') => [[2, 0], [0, 100]],
            str_contains($text, '24 h') && str_contains($text, 'sin penalidad') => [[1, 0], [0, 100]],
            str_contains($text, 'tren:') => [[15, 0], [7, 50], [2, 50], [0, 100]],
            default => [[15, 0], [7, 50], [0, 100]],
        };

        return self::normalize($pairs);
    }

    public static function resolve(mixed $structured, ?string $text): array
    {
        $tiers = self::normalize($structured);

        return $tiers !== [] ? $tiers : self::fromText($text);
    }

    public static function pct(array $tiers, int $days): int
    {
        foreach (self::normalize($tiers) as $tier) {
            if ($days >= $tier['min_days']) {
                return $tier['pct'];
            }
        }

        return 100;
    }

    public static function describe(array $tiers): string
    {
        $tiers = self::normalize($tiers);
        $parts = [];
        $upper = null;

        foreach ($tiers as $tier) {
            $range = match (true) {
                $upper === null && $tier['min_days'] === 0 => 'En cualquier momento',
                $upper === null => "{$tier['min_days']} días o más",
                $tier['min_days'] === 0 && $upper === 1 => 'El mismo día',
                $tier['min_days'] === 0 => "Menos de {$upper} días",
                $tier['min_days'] === $upper - 1 => "{$tier['min_days']} días",
                default => "{$tier['min_days']} a ".($upper - 1).' días',
            };
            $parts[] = $range.': '.($tier['pct'] === 0 ? 'sin penalidad' : "{$tier['pct']} %");
            $upper = $tier['min_days'];
        }

        if ($upper !== null && $upper > 0) {
            $parts[] = "Menos de {$upper} días: 100 %";
        }

        return implode(' · ', $parts);
    }
}
