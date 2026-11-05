<?php

declare(strict_types=1);

namespace App\Domain\Bookings\Data;

/**
 * Estado calculado de un día (spec 16 §4.1; no se persiste). `status` ∈ pasado | sin_configurar | disponible |
 * fuera_de_plazo | no_opera | cerrado | agotado | sin_cupo. `left` null = sin control de cupo.
 */
final readonly class DayStatus
{
    /** @param array<string, mixed>|null $range */
    public function __construct(
        public string $status,
        public string $label,
        public ?int $left,
        public ?int $cap = null,
        public ?string $note = null,
        public ?array $range = null,
        public ?string $departureRef = null,
    ) {
    }
}
