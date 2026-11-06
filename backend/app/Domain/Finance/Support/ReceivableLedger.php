<?php

declare(strict_types=1);

namespace App\Domain\Finance\Support;

use App\Domain\Iam\Models\User;
use App\Domain\Shared\Audit\AuditLogger;
use Illuminate\Support\Facades\DB;

final class ReceivableLedger
{
    public const TOLERANCE = 0.005;

    public function __construct(private readonly Consolidation $money, private readonly AuditLogger $audit) {}

    public static function status(string $stored, float $amount, float $paid, string $due, string $today): string
    {
        return match (true) {
            $stored === 'cancelada' => 'cancelada',
            $amount - $paid <= self::TOLERANCE => 'pagada',
            $due < $today => 'vencida',
            $paid > 0 => 'parcial',
            default => 'abierta',
        };
    }

    public function recalculate(string $receivableId, User $actor): object
    {
        $receivable = DB::table('fin_receivables')->where('id', $receivableId)->lockForUpdate()->first();
        $paid = (float) DB::table('fin_payment_applications as a')
            ->join('fin_payments as p', 'p.id', '=', 'a.payment_id')
            ->where('a.receivable_id', $receivableId)
            ->whereNull('a.reversed_at')
            ->where('p.status', 'aplicado')
            ->sum('a.amount');
        $paid = min($paid, (float) $receivable->amount);
        $status = self::status($receivable->status, (float) $receivable->amount, $paid, $receivable->due_date, $this->money->today());

        DB::table('fin_receivables')->where('id', $receivableId)->update([
            'paid_amount' => $paid,
            'status' => $status,
            'lock_version' => DB::raw('lock_version + 1'),
            'updated_by' => $actor->getKey(),
            'updated_at' => now(),
        ]);

        $this->syncReservation($receivable->reservation_id);

        return (object) ['code' => $receivable->code, 'before' => (float) $receivable->amount - (float) $receivable->paid_amount, 'after' => (float) $receivable->amount - $paid, 'status' => $status];
    }

    private function syncReservation(string $reservationId): void
    {
        $reservation = DB::table('booking_reservations')->where('id', $reservationId)->first(['code', 'status']);
        if ($reservation === null || $reservation->status !== 'pendiente_pago') {
            return;
        }

        $open = DB::table('fin_receivables')->where('reservation_id', $reservationId)->whereNull('deleted_at')->where('status', '<>', 'cancelada');
        if ((clone $open)->count() === 0 || (clone $open)->where('status', '<>', 'pagada')->exists()) {
            return;
        }

        DB::table('booking_reservations')->where('id', $reservationId)->update(['status' => 'confirmada', 'updated_at' => now()]);
        $this->audit->log('Reserva', $reservation->code, 'confirmar', 'pendiente_pago', 'confirmada (obligaciones pagadas)');
    }
}
