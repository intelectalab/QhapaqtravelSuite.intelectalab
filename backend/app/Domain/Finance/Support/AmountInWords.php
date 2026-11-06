<?php

declare(strict_types=1);

namespace App\Domain\Finance\Support;

final class AmountInWords
{
    private const UNITS = ['', 'UNO', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE', 'DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE', 'VEINTE', 'VEINTIUNO', 'VEINTIDÓS', 'VEINTITRÉS', 'VEINTICUATRO', 'VEINTICINCO', 'VEINTISÉIS', 'VEINTISIETE', 'VEINTIOCHO', 'VEINTINUEVE'];

    private const TENS = ['', '', '', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];

    private const HUNDREDS = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];

    public static function of(float $amount, string $currency): string
    {
        $integer = (int) floor(round($amount, 2));
        $cents = (int) round(($amount - $integer) * 100);
        $words = $integer === 0 ? 'CERO' : self::number($integer);
        $name = $currency === 'USD' ? 'DÓLARES AMERICANOS' : 'SOLES';

        return sprintf('SON: %s CON %02d/100 %s', $words, $cents, $name);
    }

    private static function number(int $value): string
    {
        if ($value >= 1_000_000) {
            $millions = intdiv($value, 1_000_000);
            $rest = $value % 1_000_000;
            $head = $millions === 1 ? 'UN MILLÓN' : self::number($millions).' MILLONES';

            return trim($head.' '.($rest ? self::number($rest) : ''));
        }

        if ($value >= 1000) {
            $thousands = intdiv($value, 1000);
            $rest = $value % 1000;
            $head = $thousands === 1 ? 'MIL' : self::number($thousands).' MIL';

            return trim($head.' '.($rest ? self::number($rest) : ''));
        }

        if ($value >= 100) {
            $rest = $value % 100;

            return $value === 100 ? 'CIEN' : trim(self::HUNDREDS[intdiv($value, 100)].' '.($rest ? self::number($rest) : ''));
        }

        if ($value < 30) {
            return self::UNITS[$value];
        }

        $unit = $value % 10;

        return self::TENS[intdiv($value, 10)].($unit ? ' Y '.self::UNITS[$unit] : '');
    }
}
