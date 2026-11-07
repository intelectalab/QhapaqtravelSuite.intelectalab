<?php

declare(strict_types=1);

namespace App\Domain\Quotes\Events;

use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

final class QuoteConverted implements ShouldDispatchAfterCommit
{
    use Dispatchable;
    use SerializesModels;

    public function __construct(
        public readonly string $tenantId,
        public readonly string $reservationId,
        public readonly string $reservationCode,
        public readonly ?string $quoteId = null,
        public readonly ?string $actorId = null,
    ) {}
}
