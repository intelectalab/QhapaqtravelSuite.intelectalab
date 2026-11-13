<?php

declare(strict_types=1);

namespace App\Domain\Growth\DynamicPricing;

use App\Domain\Shared\Money\Decimal;
use Brick\Math\BigDecimal;
use Brick\Math\RoundingMode;
use Illuminate\Support\Carbon;

final class DynamicPriceCalculator
{
    public const BASES = ['ocupacion' => 'Ocupación', 'anticipacion' => 'Anticipación', 'dia_semana' => 'Día de la semana', 'temporada' => 'Temporada', 'demanda' => 'Demanda'];

    public const CHANNELS = ['web' => 'Sitio web', 'b2b' => 'Agencias B2B', 'ota' => 'OTAs', 'interno' => 'Venta interna'];

    public const CONDITION_KEYS = [
        'ocupacion' => ['occupancy_gte', 'occupancy_lte'],
        'anticipacion' => ['days_before_gte', 'days_before_lte'],
        'dia_semana' => ['weekdays'],
        'temporada' => ['from', 'to'],
        'demanda' => ['demand_gte', 'demand_lte'],
    ];

    public function conditionsError(string $basis, array $conditions): ?string
    {
        $keys = array_intersect(array_keys($conditions), self::CONDITION_KEYS[$basis] ?? []);

        if ($keys === []) {
            return 'Indica la condición de la regla ('.implode(' o ', self::CONDITION_KEYS[$basis] ?? []).').';
        }

        foreach ($keys as $key) {
            $value = $conditions[$key];
            $valid = match (true) {
                str_starts_with($key, 'occupancy'), str_starts_with($key, 'demand') => is_numeric($value) && $value >= 0 && $value <= 1,
                str_starts_with($key, 'days_before') => is_numeric($value) && (int) $value >= 0 && (int) $value <= 730,
                $key === 'weekdays' => is_array($value) && $value !== [] && collect($value)->every(fn ($day): bool => is_numeric($day) && (int) $day >= 1 && (int) $day <= 7),
                default => is_string($value) && preg_match('/^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/', $value) === 1,
            };

            if (! $valid) {
                return "La condición {$key} no es válida.";
            }
        }

        if ($basis === 'temporada' && count($keys) !== 2) {
            return 'La temporada necesita inicio y fin (MM-DD).';
        }

        return null;
    }

    public function calculate(array $rules, string $basePrice, array $context): array
    {
        $date = Carbon::parse($context['date']);
        $today = Carbon::parse($context['today']);
        $applied = [];

        foreach (collect($rules)->sortBy([['priority', 'asc'], ['code', 'asc']]) as $rule) {
            if ($this->applies($rule, $date, $today, $context)) {
                $applied[] = $rule;
            }
        }

        $cumulative = array_reduce($applied, fn (BigDecimal $sum, array $rule): BigDecimal => $sum->plus((string) $rule['adjust_pct']), BigDecimal::zero());
        $floor = $applied === [] ? BigDecimal::zero() : BigDecimal::of((string) max(array_map(fn (array $rule): float => (float) $rule['floor_pct'], $applied)));
        $ceiling = $applied === [] ? BigDecimal::zero() : BigDecimal::of((string) min(array_map(fn (array $rule): float => (float) $rule['ceiling_pct'], $applied)));
        $final = $cumulative->isLessThan($floor) ? $floor : ($cumulative->isGreaterThan($ceiling) ? $ceiling : $cumulative);
        $base = Decimal::money($basePrice);
        $price = $base->multipliedBy(BigDecimal::one()->plus($final->dividedBy(100, 6, RoundingMode::HALF_UP)))->toScale(2, RoundingMode::HALF_UP);

        return [
            'base_price' => Decimal::toApi($base),
            'applied' => array_map(fn (array $rule): array => ['code' => $rule['code'], 'name' => $rule['name'], 'basis' => $rule['basis'], 'adjust_pct' => (string) $rule['adjust_pct'], 'priority' => (int) $rule['priority']], $applied),
            'cumulative_pct' => (string) $cumulative->toScale(2),
            'floor_pct' => (string) $floor->toScale(2),
            'ceiling_pct' => (string) $ceiling->toScale(2),
            'final_pct' => (string) $final->toScale(2),
            'clamped' => ! $final->isEqualTo($cumulative),
            'final_price' => Decimal::toApi($price),
            'days_before' => max(0, (int) $today->diffInDays($date, false)),
        ];
    }

    private function applies(array $rule, Carbon $date, Carbon $today, array $context): bool
    {
        if (! ($context['include_inactive'] ?? false) && ! $rule['active']) {
            return false;
        }

        if ($rule['product_id'] !== null && $rule['product_id'] !== ($context['product_id'] ?? null)) {
            return false;
        }

        if (! in_array($context['channel'], $rule['channels'], true)) {
            return false;
        }

        if (($rule['valid_from'] !== null && $date->toDateString() < $rule['valid_from']) || ($rule['valid_to'] !== null && $date->toDateString() > $rule['valid_to'])) {
            return false;
        }

        $conditions = $rule['conditions'];
        $daysBefore = (int) $today->diffInDays($date, false);
        $occupancy = (float) ($context['occupancy'] ?? 0);
        $demand = (float) ($context['demand'] ?? 0);

        return match ($rule['basis']) {
            'ocupacion' => $this->range($occupancy, $conditions['occupancy_gte'] ?? null, $conditions['occupancy_lte'] ?? null),
            'anticipacion' => $this->range($daysBefore, $conditions['days_before_gte'] ?? null, $conditions['days_before_lte'] ?? null),
            'dia_semana' => in_array($date->isoWeekday(), array_map('intval', (array) ($conditions['weekdays'] ?? [])), true),
            'temporada' => $this->season($date->format('m-d'), (string) ($conditions['from'] ?? '01-01'), (string) ($conditions['to'] ?? '12-31')),
            'demanda' => $this->range($demand, $conditions['demand_gte'] ?? null, $conditions['demand_lte'] ?? null),
            default => false,
        };
    }

    private function range(float|int $value, mixed $min, mixed $max): bool
    {
        return ($min === null || $value >= (float) $min) && ($max === null || $value <= (float) $max);
    }

    private function season(string $day, string $from, string $to): bool
    {
        return $from <= $to ? $day >= $from && $day <= $to : $day >= $from || $day <= $to;
    }
}
