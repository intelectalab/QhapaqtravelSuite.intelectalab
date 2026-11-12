<?php

declare(strict_types=1);

namespace App\Domain\Operations\Listeners;

use App\Domain\Booking\Events\ReservationConfirmed;
use App\Domain\Operations\Support\TravelDocChecklist;
use App\Domain\Shared\Tenancy\Jobs\RestoreTenantContext;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Queue\InteractsWithQueue;

final class CreateTravelDocChecklist implements ShouldQueue
{
    use InteractsWithQueue;

    public int $tries = 5;

    public array $backoff = [10, 30, 90, 270];

    public function __construct(private readonly TravelDocChecklist $checklist) {}

    public function middleware(ReservationConfirmed $event): array
    {
        return [new RestoreTenantContext($event->tenantId)];
    }

    public function handle(ReservationConfirmed $event): void
    {
        $this->checklist->sync($event->reservationId);
    }
}
