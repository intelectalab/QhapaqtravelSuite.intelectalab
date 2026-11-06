<?php

declare(strict_types=1);

namespace App\Domain\B2bPortal\Actions;

use App\Domain\B2bPortal\Support\B2bAccount;
use App\Domain\Booking\Actions\ReservationWorkflow;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class B2bReservationChanges
{
    public function __construct(private readonly AuditLogger $audit) {}

    public function savePassenger(B2bAccount $account, string $code, int $seq, array $data): void
    {
        $reservation = $this->open($account, $code);
        $passenger = DB::table('booking_passengers')->where('reservation_id', $reservation->id)->where('seq', $seq)->first(['id', 'full_name'])
            ?? throw ApiException::notFound('Ese pasajero no está en la reserva.');
        $doc = isset($data['doc_number']) ? Str::upper((string) preg_replace('/\s+/', '', (string) $data['doc_number'])) : null;

        DB::table('booking_passengers')->where('id', $passenger->id)->update([
            'full_name' => trim((string) $data['full_name']),
            'doc_type' => $doc ? $data['doc_type'] : null,
            'doc_number' => $doc ?: null,
            'nationality' => $data['nationality'] ?? null,
            'birth_date' => $data['birth_date'] ?? null,
            'age' => isset($data['birth_date']) ? Carbon::parse($data['birth_date'])->age : null,
            'is_placeholder' => false,
            'pending' => ! $doc,
            'updated_by' => $account->user->getKey(),
            'updated_at' => now(),
        ]);

        $this->audit->log('Reserva', $reservation->code, 'editar_pasajero_b2b', $passenger->full_name, trim((string) $data['full_name']));
    }

    public function requestCancel(B2bAccount $account, string $code, string $reason, string $detail): void
    {
        $reservation = $this->open($account, $code);

        if (DB::table('booking_cancel_requests')->where('reservation_id', $reservation->id)->where('status', 'pendiente')->exists()) {
            throw ApiException::conflict('CANCEL_REQUEST_PENDING', 'Ya enviaste una solicitud de anulación para esta reserva.');
        }

        $text = "{$reason}: {$detail}";
        DB::table('booking_cancel_requests')->insert([
            'reservation_id' => $reservation->id,
            'reason' => "Agencia {$account->agency->code} · {$text}",
            'requested_by' => $account->user->getKey(),
            'requested_at' => now(),
            'status' => 'pendiente',
            'created_by' => $account->user->getKey(),
        ]);

        $this->audit->log('Reserva', $reservation->code, 'solicitar_anulacion', null, "{$account->agency->code} · {$text}");
    }

    public function withdrawCancel(B2bAccount $account, string $code): void
    {
        $reservation = $account->reservation($code);
        $updated = DB::table('booking_cancel_requests')->where('reservation_id', $reservation->id)->where('status', 'pendiente')->where('requested_by', $account->user->getKey())
            ->update(['status' => 'retirada', 'decided_at' => now(), 'decision_note' => 'Retirada por la agencia', 'updated_by' => $account->user->getKey(), 'updated_at' => now()]);

        if ($updated === 0) {
            throw ApiException::notFound('No hay una solicitud de anulación pendiente.');
        }

        $this->audit->log('Reserva', $reservation->code, 'retirar_anulacion', 'pendiente', 'retirada');
    }

    private function open(B2bAccount $account, string $code): object
    {
        $reservation = $account->reservation($code);

        if (in_array($reservation->status, ReservationWorkflow::CLOSED, true)) {
            throw ApiException::conflict('RESERVATION_CLOSED', 'La reserva ya está '.($reservation->status === 'cancelada' ? 'anulada' : 'completada').' y no admite cambios.');
        }

        return $reservation;
    }
}
