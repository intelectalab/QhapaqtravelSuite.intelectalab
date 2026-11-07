<?php

declare(strict_types=1);

namespace App\Domain\Booking\Data;

final readonly class DayStatus
{
    public function __construct(
        public string $status,
        public string $label,
        public ?int $left,
        public ?int $cap = null,
        public ?string $note = null,
        public ?array $range = null,
        public ?string $departureRef = null,
    ) {}
}
