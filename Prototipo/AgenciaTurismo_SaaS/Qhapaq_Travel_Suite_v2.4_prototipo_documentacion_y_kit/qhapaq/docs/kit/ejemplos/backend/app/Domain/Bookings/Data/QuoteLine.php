<?php

declare(strict_types=1);

namespace App\Domain\Bookings\Data;

use Brick\Money\Money;

/** Línea del presupuesto del motor (spec 16 §8.1: QuoteLine{key, kind, label, qty, unit, amount, removable, removed, meta}). */
final readonly class QuoteLine
{
    /** @param array<string, mixed> $meta */
    public function __construct(
        public string $key,          // base-adt, addon-ADD-1101, lodging-…
        public string $kind,         // base | info | addon | lodging | supplement
        public string $label,
        public int $qty,
        public Money $unit,
        public Money $amount,
        public bool $removable = false,
        public bool $removed = false,
        public array $meta = [],
    ) {
    }
}
