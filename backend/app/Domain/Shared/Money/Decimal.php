<?php

declare(strict_types=1);

namespace App\Domain\Shared\Money;

use Brick\Math\BigDecimal;
use Brick\Math\RoundingMode;

final class Decimal
{
    public const IGV_FACTOR = '1.18';

    public static function of(mixed $value): BigDecimal
    {
        if ($value instanceof BigDecimal) {
            return $value;
        }

        if (is_float($value)) {
            return BigDecimal::of(sprintf('%.10F', $value));
        }

        $text = trim((string) ($value ?? ''));

        return BigDecimal::of($text === '' ? '0' : $text);
    }

    public static function money(mixed $value): BigDecimal
    {
        return self::round2(self::of($value));
    }

    public static function withoutIgv(BigDecimal|string $total): BigDecimal
    {
        return BigDecimal::of($total)->dividedBy(self::IGV_FACTOR, 2, RoundingMode::HALF_UP);
    }

    public static function round2(BigDecimal|string|int $value): BigDecimal
    {
        return BigDecimal::of($value)->toScale(2, RoundingMode::HALF_UP);
    }

    public static function toApi(BigDecimal|string|int|null $value): ?string
    {
        return $value === null ? null : (string) self::round2($value);
    }

    public static function display(BigDecimal|string|int $value, string $currency): string
    {
        $amount = self::round2($value);
        [$integer, $fraction] = explode('.', (string) $amount->abs());
        $grouped = ltrim(strrev(implode(' ', str_split(strrev($integer), 3))));
        $symbol = ['PEN' => 'S/', 'USD' => 'US$', 'EUR' => '€'][$currency] ?? $currency;

        return ($amount->isNegative() ? '−' : '').$symbol.' '.$grouped.'.'.$fraction;
    }

    public static function allocate(BigDecimal|string $total, array $weights): array
    {
        $total = self::round2($total);
        $n = count($weights);
        if ($n === 0) {
            return [];
        }

        $sum = array_reduce($weights, fn (BigDecimal $acc, $w) => $acc->plus($w), BigDecimal::zero());
        if ($sum->isZero()) {
            return [...array_fill(0, $n - 1, BigDecimal::zero()->toScale(2)), $total];
        }

        $parts = [];
        $acc = BigDecimal::zero();
        foreach ($weights as $i => $w) {
            if ($i === $n - 1) {
                $parts[] = $total->minus($acc)->toScale(2);
                break;
            }
            $part = $total->multipliedBy($w)->dividedBy($sum, 2, RoundingMode::HALF_UP);
            $parts[] = $part;
            $acc = $acc->plus($part);
        }

        return $parts;
    }

    public static function convert(BigDecimal|string $amount, string $from, string $to, BigDecimal|string $fxRate): BigDecimal
    {
        $amount = BigDecimal::of($amount);
        if ($from === $to) {
            return $amount;
        }

        return match ([$from, $to]) {
            ['USD', 'PEN'] => $amount->multipliedBy($fxRate),
            ['PEN', 'USD'] => $amount->dividedBy($fxRate, 6, RoundingMode::HALF_UP),
            default => throw new \InvalidArgumentException("Conversión {$from}→{$to} no soportada: usar FxConverter del BookingEngine (spec 16 §8.1)."),
        };
    }
}
