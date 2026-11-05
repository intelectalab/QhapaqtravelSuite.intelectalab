<?php

declare(strict_types=1);

namespace App\Domain\Integrations\Data;

/** Cobro en línea (spec 15 checkout, spec 08 e-commerce). Pasarela por definir (D-02). */
final readonly class PaymentRequest
{
    /** @param array<string, string> $metadata ids internos (order_id, reservation_id) — nunca datos de tarjeta */
    public function __construct(
        public string $reference,      // código del pedido o de la CxC
        public string $amount,         // string decimal
        public string $currency,
        public string $method,         // card | transfer | yape | plin (spec 15 §3.6; Por definir con la pasarela)
        public string $customerEmail,
        public ?string $returnUrl = null,
        public array $metadata = [],
    ) {
    }
}
