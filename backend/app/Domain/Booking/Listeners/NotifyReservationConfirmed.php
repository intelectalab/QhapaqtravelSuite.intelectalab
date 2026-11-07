<?php

declare(strict_types=1);

namespace App\Domain\Booking\Listeners;

use App\Domain\Admin\Support\EmailNotifications;
use App\Domain\Booking\Events\ReservationConfirmed;
use App\Domain\Shared\Tenancy\Jobs\RestoreTenantContext;
use Carbon\CarbonImmutable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Support\Facades\DB;

final class NotifyReservationConfirmed implements ShouldQueue
{
    use InteractsWithQueue;

    public string $queue = 'notifications';

    public int $tries = 5;

    public array $backoff = [10, 30, 90, 270];

    public function __construct(private readonly EmailNotifications $notifications) {}

    public function middleware(ReservationConfirmed $event): array
    {
        return [new RestoreTenantContext($event->tenantId)];
    }

    public function handle(ReservationConfirmed $event): void
    {
        $row = DB::table('booking_reservations as r')
            ->join('crm_clients as c', 'c.id', '=', 'r.client_id')
            ->leftJoin('iam_users as u', 'u.id', '=', 'r.owner_id')
            ->where('r.id', $event->reservationId)
            ->first(['r.id', 'r.code', 'r.client_id', 'r.travel_from', 'c.name', 'c.email', 'u.name as owner_name']);

        if ($row === null || $row->email === null) {
            return;
        }

        $this->notifications->queue('reserva.confirmada', (string) $row->email, [
            'cliente' => (string) $row->name,
            'reserva' => (string) $row->code,
            'fecha_viaje' => CarbonImmutable::parse((string) $row->travel_from)->format('d/m/Y'),
            'vendedor' => (string) ($row->owner_name ?? ''),
        ], ['source_type' => 'booking_reservation', 'source_id' => $row->id, 'client_id' => $row->client_id, 'reservation_id' => $row->id]);
    }
}
