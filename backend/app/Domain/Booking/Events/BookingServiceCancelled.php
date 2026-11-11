<?php

declare(strict_types=1);

namespace App\Domain\Booking\Events;

use Illuminate\Foundation\Events\Dispatchable;

final class BookingServiceCancelled
{
    use Dispatchable;

    public function __construct(
        public readonly string $reservationId,
        public readonly string $serviceId,
    ) {}
}
