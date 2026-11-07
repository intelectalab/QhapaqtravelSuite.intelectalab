<?php

declare(strict_types=1);

namespace App\Domain\Booking\Data;

final readonly class PaxValidation
{
    public function __construct(
        public bool $ok,
        public array $errors,
        public int $seats,
    ) {}
}
