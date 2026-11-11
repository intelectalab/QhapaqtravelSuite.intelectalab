<?php

declare(strict_types=1);

namespace App\Domain\Finance\Events;

use Illuminate\Foundation\Events\Dispatchable;

final class PaymentReverted
{
    use Dispatchable;

    public function __construct(public readonly string $paymentId, public readonly ?string $actorId = null) {}
}
