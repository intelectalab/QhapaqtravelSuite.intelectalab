<?php

declare(strict_types=1);

namespace App\Domain\Integrations\Data;

final readonly class PaymentRequest
{
    public function __construct(
        public string $reference,
        public string $amount,
        public string $currency,
        public string $method,
        public string $customerEmail,
        public ?string $returnUrl = null,
        public array $metadata = [],
    ) {
    }
}
