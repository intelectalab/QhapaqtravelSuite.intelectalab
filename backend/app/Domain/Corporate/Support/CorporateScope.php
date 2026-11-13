<?php

declare(strict_types=1);

namespace App\Domain\Corporate\Support;

final readonly class CorporateScope
{
    public function __construct(
        public ?string $costCenter = null,
        public ?string $traveler = null,
    ) {}

    public static function all(): self
    {
        return new self;
    }

    public function isAll(): bool
    {
        return $this->costCenter === null && $this->traveler === null;
    }

    public function label(): ?string
    {
        return match (true) {
            $this->costCenter !== null => "Centro de costo {$this->costCenter}",
            $this->traveler !== null => 'Tus viajes',
            default => null,
        };
    }
}
