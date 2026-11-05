<?php

declare(strict_types=1);

namespace App\Domain\Shared\Money;

use Brick\Math\BigDecimal;
use Brick\Math\RoundingMode;

/**
 * Utilidades de dinero sobre BigDecimal (sin float). Mismas reglas que el prototipo:
 *  - round2(x) = HALF_UP a 2 decimales.
 *  - Reparto proporcional con el residuo de redondeo en la ÚLTIMA línea para que Σ partes = total exacto
 *    (spec 04 §4.3 paso 10: «asignar el residuo de redondeo a la última línea»).
 *  - Conversión con el tipo de cambio CONSERVADO en el documento (regla transversal 15, H-12):
 *    PEN = USD × fx_rate; USD = PEN ÷ fx_rate.
 */
final class Decimal
{
    public static function round2(BigDecimal|string|int $value): BigDecimal
    {
        return BigDecimal::of($value)->toScale(2, RoundingMode::HALF_UP);
    }

    /** "1250.5" → "1250.50" (formato de la API y de los atributos data-amount del frontend). */
    public static function toApi(BigDecimal|string|int|null $value): ?string
    {
        return $value === null ? null : (string) self::round2($value);
    }

    /**
     * Reparte $total según $weights. Σ resultado = round2($total) exacto.
     *
     * @param  list<BigDecimal|string|int>  $weights
     * @return list<BigDecimal>
     */
    public static function allocate(BigDecimal|string $total, array $weights): array
    {
        $total = self::round2($total);
        $n = count($weights);
        if ($n === 0) {
            return [];
        }

        $sum = array_reduce($weights, fn (BigDecimal $acc, $w) => $acc->plus($w), BigDecimal::zero());
        if ($sum->isZero()) {
            // Sin pesos: todo en la última línea (caso degenerado; se registra como advertencia en la Action).
            return [...array_fill(0, $n - 1, BigDecimal::zero()->toScale(2)), $total];
        }

        $parts = [];
        $acc = BigDecimal::zero();
        foreach ($weights as $i => $w) {
            if ($i === $n - 1) {
                $parts[] = $total->minus($acc)->toScale(2); // residuo a la última línea
                break;
            }
            $part = $total->multipliedBy($w)->dividedBy($sum, 2, RoundingMode::HALF_UP);
            $parts[] = $part;
            $acc = $acc->plus($part);
        }

        return $parts;
    }

    /** Convierte un monto entre PEN y USD con el fx_rate del documento (PEN por 1 USD). */
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
