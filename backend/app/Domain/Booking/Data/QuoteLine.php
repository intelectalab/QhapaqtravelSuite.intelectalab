<?php

declare(strict_types=1);

namespace App\Domain\Booking\Data;

use Brick\Money\Money;

final readonly class QuoteLine
{
    public function __construct(
        public string $key,
        public string $kind,
        public string $label,
        public int $qty,
        public Money $unit,
        public Money $amount,
        public bool $removable = false,
        public bool $removed = false,
        public array $meta = [],
    ) {}
}
