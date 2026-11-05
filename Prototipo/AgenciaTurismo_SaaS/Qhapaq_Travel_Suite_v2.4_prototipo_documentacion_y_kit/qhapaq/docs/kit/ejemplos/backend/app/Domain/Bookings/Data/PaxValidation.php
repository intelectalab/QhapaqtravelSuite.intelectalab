<?php

declare(strict_types=1);

namespace App\Domain\Bookings\Data;

/** Resultado de validatePax: errores con el MISMO texto del prototipo (Datasets/prd011.php → PRD011_PAX_INVALID). */
final readonly class PaxValidation
{
    /** @param list<string> $errors */
    public function __construct(
        public bool $ok,
        public array $errors,
        public int $seats,
    ) {
    }
}
