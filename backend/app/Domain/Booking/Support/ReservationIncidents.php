<?php

declare(strict_types=1);

namespace App\Domain\Booking\Support;

use App\Domain\Booking\Enums\ReservationStatus;
use App\Domain\Booking\Models\Reservation;
use App\Domain\Booking\StateMachines\ReservationStateMachine;
use App\Domain\Shared\Audit\AuditLogger;
use Illuminate\Support\Facades\DB;

final class ReservationIncidents
{
    public const HIGH_SEVERITIES = ['alta', 'critica'];

    public const OPEN_STATUSES = ['abierta', 'en_proceso'];

    private const AFFECTED = [ReservationStatus::Confirmada, ReservationStatus::EnOperacion, ReservationStatus::Parcial];

    public function __construct(private readonly ReservationStateMachine $states, private readonly AuditLogger $audit) {}

    public function syncForIncident(string $incidentId): void
    {
        $this->sync(DB::table('ops_incidents')->where('id', $incidentId)->value('reservation_id'));
    }

    public function sync(?string $reservationId): void
    {
        if ($reservationId === null) {
            return;
        }

        $reservation = Reservation::query()->whereKey($reservationId)->lock('for no key update')->first();
        if ($reservation === null) {
            return;
        }

        $open = DB::table('ops_incidents')->where('reservation_id', $reservationId)
            ->whereIn('severity', self::HIGH_SEVERITIES)->whereIn('status', self::OPEN_STATUSES)->exists();
        $status = $reservation->statusEnum();

        $target = match (true) {
            $open && in_array($status, self::AFFECTED, true) => ReservationStatus::Incidencia,
            ! $open && $status === ReservationStatus::Incidencia => ReservationStatus::EnOperacion,
            default => null,
        };

        if ($target === null) {
            return;
        }

        $this->states->transition($reservation, $target);
        $reservation->save();
        $this->audit->log('Reserva', (string) $reservation->code, 'cambio_estado', $status->value, $target->value);
    }
}
