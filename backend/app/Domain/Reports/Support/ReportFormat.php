<?php

declare(strict_types=1);

namespace App\Domain\Reports\Support;

use App\Domain\Shared\Money\Decimal;

final class ReportFormat
{
    public static function money(?string $value): string
    {
        return $value === null ? '—' : Decimal::display($value, 'PEN');
    }

    public static function value(array $kpi): string
    {
        return match (true) {
            $kpi['value'] === null => '—',
            $kpi['kind'] === 'money' => self::money($kpi['value']),
            $kpi['kind'] === 'percent' => str_replace('.', ',', $kpi['value']).' %',
            default => number_format((int) $kpi['value'], 0, ',', ' '),
        };
    }

    public static function change(array $kpi): string
    {
        if ($kpi['change'] === null) {
            return $kpi['previous'] === null || (float) $kpi['previous'] === 0.0 ? 'sin base de comparación' : '—';
        }

        $sign = (float) $kpi['change'] > 0 ? '+' : ((float) $kpi['change'] < 0 ? '−' : '');
        $amount = str_replace('.', ',', ltrim($kpi['change'], '-'));

        return $kpi['kind'] === 'percent' ? "{$sign}{$amount} pts vs semana anterior" : "{$sign}{$amount} % vs semana anterior";
    }

    public static function tone(array $kpi): string
    {
        return match (true) {
            $kpi['change'] === null => 'neutral',
            (float) $kpi['change'] > 0 => 'good',
            (float) $kpi['change'] < 0 => 'bad',
            default => 'neutral',
        };
    }

    public static function tint(string $hex, float $amount): string
    {
        [$r, $g, $b] = sscanf($hex, '#%02x%02x%02x');

        return sprintf('#%02x%02x%02x', (int) round($r + (255 - $r) * $amount), (int) round($g + (255 - $g) * $amount), (int) round($b + (255 - $b) * $amount));
    }
}
