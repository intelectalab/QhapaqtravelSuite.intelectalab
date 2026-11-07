<?php

declare(strict_types=1);

namespace App\Domain\Shared\Outbox;

use Illuminate\Foundation\Events\Dispatchable;

final class OutboxMessagePublished
{
    use Dispatchable;

    public function __construct(
        public readonly string $tenantId,
        public readonly string $messageId,
        public readonly string $aggregateType,
        public readonly string $aggregateId,
        public readonly string $event,
        public readonly array $payload,
    ) {}
}
