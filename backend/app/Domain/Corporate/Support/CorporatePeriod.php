<?php

declare(strict_types=1);

namespace App\Domain\Corporate\Support;

use App\Domain\Shared\Errors\ApiException;
use Carbon\CarbonImmutable;

final readonly class CorporatePeriod
{
    public const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'setiembre', 'octubre', 'noviembre', 'diciembre'];

    private const SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'set', 'oct', 'nov', 'dic'];

    public function __construct(
        public string $key,
        public string $from,
        public string $to,
        public string $label,
        public int $year,
    ) {}

    public static function parse(?string $value, CarbonImmutable $today): self
    {
        $value = trim((string) $value);

        if ($value === '') {
            return self::year($today->year);
        }

        if (preg_match('/^(\d{4})$/', $value, $m) === 1) {
            return self::year((int) $m[1]);
        }

        if (preg_match('/^(\d{4})-Q([1-4])$/', $value, $m) === 1) {
            $start = CarbonImmutable::create((int) $m[1], ((int) $m[2] - 1) * 3 + 1, 1);
            $end = $start->addMonths(2)->endOfMonth();

            return new self($value, $start->toDateString(), $end->toDateString(), self::SHORT[$start->month - 1].'–'.self::SHORT[$end->month - 1].' '.$start->year, $start->year);
        }

        if (preg_match('/^(\d{4})-(0[1-9]|1[0-2])$/', $value, $m) === 1) {
            return self::month((int) $m[1], (int) $m[2]);
        }

        throw ApiException::unprocessable('PERIOD_INVALID', 'Elige un período válido: un año (2026), un trimestre (2026-Q3) o un mes (2026-09).');
    }

    public static function year(int $year): self
    {
        return new self((string) $year, "{$year}-01-01", "{$year}-12-31", "Año {$year}", $year);
    }

    public static function month(int $year, int $month): self
    {
        $start = CarbonImmutable::create($year, $month, 1);

        return new self($start->format('Y-m'), $start->toDateString(), $start->endOfMonth()->toDateString(), ucfirst(self::MONTHS[$month - 1])." {$year}", $year);
    }

    public static function options(CarbonImmutable $today): array
    {
        $year = $today->year;
        $options = [['value' => (string) $year, 'label' => "Año {$year}"]];

        foreach ([1, 2, 3, 4] as $quarter) {
            $period = self::parse("{$year}-Q{$quarter}", $today);
            $options[] = ['value' => $period->key, 'label' => $period->label];
        }

        $options[] = ['value' => (string) ($year - 1), 'label' => 'Año '.($year - 1)];

        return $options;
    }

    public static function shortMonth(int $month): string
    {
        return self::SHORT[$month - 1];
    }

    public function contains(string $date): bool
    {
        return $date >= $this->from && $date <= $this->to;
    }
}
