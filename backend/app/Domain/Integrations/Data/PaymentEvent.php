<?php

declare(strict_types=1);

namespace App\Domain\Integrations\Data;

final readonly class PaymentEvent
{
    public const APPROVED = 'payment.approved';

    public const REJECTED = 'payment.rejected';

    public const CHARGEBACK = 'payment.chargeback';

    public const REFUNDED = 'payment.refunded';

    public function __construct(
        public string $id,
        public string $type,
        public string $reference,
        public ?string $scope = null,
        public ?string $txn = null,
        public ?string $code = null,
        public ?string $masked = null,
        public ?string $message = null,
    ) {}

    public function toEvent(string $tenantId): array
    {
        return [
            'id' => $this->id,
            'type' => $this->type,
            'data' => array_filter([
                'tenant_id' => $tenantId,
                'reference' => $this->reference,
                'scope' => $this->scope ?? 'sin_ambito',
                'method' => 'card',
                'txn_id' => $this->txn,
                'code' => $this->code,
                'masked' => $this->masked,
                'message' => $this->message,
            ], fn ($value) => $value !== null),
        ];
    }
}
