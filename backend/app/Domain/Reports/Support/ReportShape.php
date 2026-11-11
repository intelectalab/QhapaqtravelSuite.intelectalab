<?php

declare(strict_types=1);

namespace App\Domain\Reports\Support;

use Illuminate\Support\Facades\DB;

final class ReportShape
{
    public static function kpi(string $key, string $label, float|int|null $value, string $format = 'number', ?string $hint = null): array
    {
        return ['key' => $key, 'label' => $label, 'value' => $value === null ? null : (is_float($value) ? round($value, 2) : $value), 'format' => $format, 'hint' => $hint];
    }

    public static function chart(string $key, string $title, string $type, array $series, string $format = 'number', array $extra = []): array
    {
        return ['key' => $key, 'title' => $title, 'type' => $type, 'format' => $format, 'series' => array_values($series), ...$extra];
    }

    public static function point(string $label, float|int $value, array $extra = []): array
    {
        return ['label' => $label, 'value' => is_float($value) ? round($value, 2) : $value, ...$extra];
    }

    public static function column(string $key, string $label, string $format = 'text', array $extra = []): array
    {
        return ['key' => $key, 'label' => $label, 'format' => $format, ...$extra];
    }

    public static function table(array $columns, array $rows, ?array $totals = null, ?string $link = null): array
    {
        return ['columns' => array_values($columns), 'rows' => array_values($rows), 'totals' => $totals, 'link' => $link];
    }

    public static function rate(float|int $part, float|int $whole): ?float
    {
        return $whole > 0 ? round($part / $whole * 100, 1) : null;
    }

    public static function labels(array $kinds): array
    {
        return DB::table('crm_catalog_items')->whereIn('kind', $kinds)->pluck('label', 'code')->all();
    }

    public static function pen(string $amount, string $fx): string
    {
        return "({$amount} * coalesce(nullif({$fx}, 0), 1))";
    }
}
