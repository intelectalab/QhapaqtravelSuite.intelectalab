<?php

declare(strict_types=1);

namespace App\Domain\Bookings\Data;

use Brick\Money\Money;
use Carbon\CarbonImmutable;

/**
 * Resultado de BookingEngine::quote (contrato `quote` de spec 16 §6.1; la spec lo llama QuoteResult y la
 * plantilla Pest BookingQuote — se usa el nombre de la plantilla).
 */
final readonly class BookingQuote
{
    /**
     * @param  list<QuoteLine>  $lines
     * @param  list<array{key:string,label:string,amount:Money}>  $adjustments
     * @param  list<string>  $modes  total | adelanto | pagar_despues
     * @param  list<string>  $warnings
     * @param  list<string>  $rulesApplied
     */
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
    ) {
    }
}
