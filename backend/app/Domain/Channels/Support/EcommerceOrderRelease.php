<?php

declare(strict_types=1);

namespace App\Domain\Channels\Support;

use App\Domain\Booking\Enums\ReservationStatus;
use App\Domain\Booking\Models\Reservation;
use App\Domain\Booking\StateMachines\ReservationStateMachine;
use App\Domain\Shared\Audit\AuditLogger;
use Illuminate\Support\Facades\DB;

final class EcommerceOrderRelease
{
    public function __construct(private readonly ReservationStateMachine $states, private readonly AuditLogger $audit) {}

    public function release(string $orderId, string $holdStatus, string $reason, string $note): void
    {
        DB::table('catalog_availability_holds')->where('reference_id', $orderId)->where('status', 'hold')
            ->update(['status' => $holdStatus, ...($holdStatus === 'liberada' ? ['released_reason' => mb_substr($reason, 0, 200)] : []), 'updated_at' => now()]);

        foreach (Reservation::query()->where('ecom_order_id', $orderId)->lock('for no key update')->get() as $reservation) {
            $from = (string) $reservation->status;

            if (! $this->states->can($from, ReservationStatus::Cancelada->value)) {
                continue;
            }

            $this->states->transition($reservation, ReservationStatus::Cancelada);
            $reservation->forceFill(['cancelled_at' => now(), 'cancel_reason' => $reason])->save();
            DB::table('booking_reservation_services')->where('reservation_id', $reservation->id)->whereNotIn('status', ['cancelado', 'completado'])
                ->update(['status' => 'cancelado', 'updated_at' => now()]);
            DB::table('fin_receivables')->where('reservation_id', $reservation->id)->whereIn('status', ['abierta', 'vencida'])
                ->update(['status' => 'cancelada', 'cancel_reason' => $reason, 'updated_at' => now()]);
            $this->audit->log('Reserva', (string) $reservation->code, 'cancelar', $from, "cancelada · {$note}");
        }
    }
}
