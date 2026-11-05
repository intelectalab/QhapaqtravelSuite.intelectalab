<?php

declare(strict_types=1);

namespace App\Domain\Bookings\Data;

/**
 * Snapshot inmutable del producto para el motor (sin Eloquent: el motor es puro y se prueba sin BD).
 * Se arma desde catalog_products + catalog_availability_ranges + catalog_product_departures + catalog_pax_rules
 * + catalog_product_rule_overrides (o desde kit-ia/seeds/products.json en pruebas unitarias).
 */
final readonly class ProductData
{
    /**
     * @param  list<array{from:string,to:string,status:string,capacity_per_day:?int,note:?string}>  $ranges  catalog_availability_ranges (date_from→from, date_to→to)
     * @param  array<string, array{capacity:int,sold:int,ref:string}>  $departures  por fecha YYYY-MM-DD (catalog_product_departures)
     * @param  list<int>|null  $operatingWeekdays  0=domingo … 6=sábado (catalog_products.operating_weekdays)
     * @param  array<string, mixed>  $paxRules  catalog_pax_rules (o defaults del tenant sys_settings.ecommerce.default_pax_rules)
     * @param  array<string, bool>  $ruleOverrides  code → false si el producto desactiva la regla
     * @param  array<string, array<string, mixed>>  $ruleParams  code → parámetros propios
     */
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
    ) {
    }

    /** Desde el formato del prototipo / semillas (`availability`, `departures`, `paxRules`, `ruleOverrides`…). */
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
        );
    }
}
