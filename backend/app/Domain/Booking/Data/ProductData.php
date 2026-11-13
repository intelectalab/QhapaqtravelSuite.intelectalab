<?php

declare(strict_types=1);

namespace App\Domain\Booking\Data;

final readonly class ProductData
{
    public function __construct(
        public string $id,
        public string $code,
        public ?int $maxPax,
        public array $ranges,
        public array $departures,
        public bool $hasAvailabilityConfig,
        public ?array $operatingWeekdays,
        public ?int $cutoffHours,
        public int $advanceMinDays,
        public array $paxRules,
        public array $ruleOverrides = [],
        public array $ruleParams = [],
        public array $rates = [],
        public array $addons = [],
        public array $accommodation = [],
        public array $options = [],
        public array $payment = [],
        public array $trip = [],
    ) {}

    public static function fromArray(array $p): self
    {
        $av = $p['availability'] ?? null;
        $departures = [];
        foreach ((array) ($p['departures'] ?? []) as $d) {
            $departures[(string) $d['date']] = ['capacity' => (int) $d['capacity'], 'sold' => (int) ($d['sold'] ?? 0), 'ref' => (string) ($d['id'] ?? '')];
        }

        return new self(
            id: (string) $p['id'],
            code: (string) ($p['code'] ?? $p['id']),
            maxPax: isset($p['maxPax']) ? (int) $p['maxPax'] : null,
            ranges: array_map(fn (array $r) => [
                'from' => (string) $r['from'], 'to' => (string) $r['to'], 'status' => (string) $r['status'],
                'capacity_per_day' => isset($r['capacityPerDay']) ? (int) $r['capacityPerDay'] : null, 'note' => $r['note'] ?? null,
            ], (array) ($av['ranges'] ?? [])),
            departures: $departures,
            hasAvailabilityConfig: $av !== null,
            operatingWeekdays: isset($av['weekdays']) ? array_map('intval', (array) $av['weekdays']) : null,
            cutoffHours: isset($av['cutoffHours']) ? (int) $av['cutoffHours'] : null,
            advanceMinDays: (int) ($p['advMin'] ?? 0),
            paxRules: (array) ($p['paxRules'] ?? []),
            ruleOverrides: (array) ($p['ruleOverrides'] ?? []),
            ruleParams: (array) ($p['ruleParams'] ?? []),
            rates: array_values((array) ($p['rates'] ?? [])),
            addons: array_values((array) ($p['addons'] ?? [])),
            accommodation: (array) ($p['accommodation'] ?? []),
            options: array_values((array) ($p['config'] ?? [])),
            payment: (array) ($p['payment'] ?? []),
            trip: (array) ($p['trip'] ?? []),
        );
    }
}
