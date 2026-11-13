<?php

declare(strict_types=1);

namespace App\Domain\Booking\Data;

use Brick\Money\Money;
use Carbon\CarbonImmutable;

final readonly class BookingQuote
{
    public function __construct(
        public string $currency,
        public array $lines,
        public array $adjustments,
        public Money $subtotal,
        public Money $total,
        public string $paymentMode,
        public array $modes,
        public int $depositPct,
        public Money $deposit,
        public Money $balance,
        public ?CarbonImmutable $balanceDue,
        public ?int $holdHours,
        public int $rooms,
        public int $nights,
        public array $warnings,
        public bool $ok,
        public ?object $season = null,
        public array $rulesApplied = [],
        public array $legs = [],
        public ?string $tripEnd = null,
        public array $byCategory = [],
    ) {}
}
