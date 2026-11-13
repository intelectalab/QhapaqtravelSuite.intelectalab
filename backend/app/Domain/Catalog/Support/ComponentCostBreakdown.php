<?php

declare(strict_types=1);

namespace App\Domain\Catalog\Support;

use Brick\Math\BigDecimal;
use Brick\Math\RoundingMode;
use Illuminate\Support\Collection;

final class ComponentCostBreakdown
{
    public const PER_PERSON_UNITS = ['pax'];

    private const SAMPLES = 5;

    private const DEFAULT_MAX = 10;

    public static function of(Collection $components, ?int $minimum, ?int $maximum, ?BigDecimal $price): array
    {
        $perPerson = BigDecimal::zero();
        $shared = BigDecimal::zero();
        $items = [];

        foreach ($components as $component) {
            $amount = BigDecimal::of((string) $component['subtotal_pen']);
            $each = in_array($component['unit'], self::PER_PERSON_UNITS, true);

            if ($each) {
                $perPerson = $perPerson->plus($amount);
            } else {
                $shared = $shared->plus($amount);
            }

            $items[] = ['name' => (string) ($component['name'] ?? ''), 'amount' => (string) $amount->toScale(2, RoundingMode::HALF_UP), 'per_person' => $each];
        }

        $min = max(1, (int) ($minimum ?? 1));
        $max = max($min, (int) ($maximum ?? max($min, self::DEFAULT_MAX)));
        $costFor = fn (int $pax): BigDecimal => $perPerson->plus($shared->dividedBy($pax, 6, RoundingMode::HALF_UP));
        $breakEven = self::breakEven($perPerson, $shared, $price);

        return [
            'items' => $items,
            'per_person' => (string) $perPerson->toScale(2, RoundingMode::HALF_UP),
            'shared' => (string) $shared->toScale(2, RoundingMode::HALF_UP),
            'min_pax' => $min,
            'max_pax' => $max,
            'price' => $price === null ? null : (string) $price->toScale(2, RoundingMode::HALF_UP),
            'break_even' => $breakEven,
            'loses_at_min' => $price !== null && $costFor($min)->isGreaterThan($price),
            'groups' => array_map(function (int $pax) use ($costFor, $price, $perPerson): array {
                $cost = $costFor($pax);

                return [
                    'pax' => $pax,
                    'shared_share' => (string) $cost->minus($perPerson)->toScale(2, RoundingMode::HALF_UP),
                    'cost' => (string) $cost->toScale(2, RoundingMode::HALF_UP),
                    'profit' => $price === null ? null : (string) $price->minus($cost)->toScale(2, RoundingMode::HALF_UP),
                    'margin_pct' => $price === null || $price->isZero() ? null : (string) $price->minus($cost)->multipliedBy(100)->dividedBy($price, 1, RoundingMode::HALF_UP),
                ];
            }, self::sizes($min, $max)),
        ];
    }

    public static function sizes(int $min, int $max): array
    {
        if ($max - $min + 1 <= self::SAMPLES) {
            return range($min, $max);
        }

        $sizes = [];

        for ($step = 0; $step < self::SAMPLES; $step++) {
            $sizes[] = (int) round($min + ($max - $min) * $step / (self::SAMPLES - 1));
        }

        return array_values(array_unique($sizes));
    }

    private static function breakEven(BigDecimal $perPerson, BigDecimal $shared, ?BigDecimal $price): ?int
    {
        if ($price === null || ! $price->isGreaterThan($perPerson)) {
            return null;
        }

        if ($shared->isZero()) {
            return 1;
        }

        return max(1, (int) (string) $shared->dividedBy($price->minus($perPerson), 0, RoundingMode::CEILING));
    }
}
