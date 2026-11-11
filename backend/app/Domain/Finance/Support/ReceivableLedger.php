<?php

declare(strict_types=1);

namespace App\Domain\Finance\Support;

use App\Domain\Finance\Actions\SyncServicePayables;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Money\Decimal;
use App\Domain\Site\Support\WebOrderSettlement;
use Brick\Math\BigDecimal;
use Illuminate\Support\Facades\DB;

final class ReceivableLedger
{
    public const TOLERANCE = 0.005;

    public function __construct(private readonly Consolidation $money, private readonly AuditLogger $audit, private readonly SyncServicePayables $payables, private readonly WebOrderSettlement $web) {}

    public static function balance(object $row): BigDecimal
    {
        return Decimal::of($row->amount)->minus(Decimal::of($row->paid_amount));
    }

    public static function available(object $reservation): BigDecimal
    {
        $committed = Decimal::of(DB::table('fin_receivables')->where('reservation_id', $reservation->id)->whereNull('deleted_at')->where('status', '<>', 'cancelada')->sum('amount'));
        $available = Decimal::of($reservation->total_amount)->minus($committed);

        return $available->isNegative() ? BigDecimal::zero() : Decimal::round2($available);
    }

    public static function status(string $stored, BigDecimal|string|float $amount, BigDecimal|string|float $paid, string $due, string $today): string
    {
        $paid = Decimal::of($paid);

        return match (true) {
            $stored === 'cancelada' => 'cancelada',
            ! Decimal::of($amount)->minus($paid)->isPositive() => 'pagada',
            $due < $today => 'vencida',
            $paid->isPositive() => 'parcial',
            default => 'abierta',
        };
    }

    public function recalculate(string $receivableId, ?User $actor): object
    {
        $receivable = DB::table('fin_receivables')->where('id', $receivableId)->lockForUpdate()->first();
        $paid = Decimal::of(DB::table('fin_payment_applications as a')
            ->join('fin_payments as p', 'p.id', '=', 'a.payment_id')
            ->where('a.receivable_id', $receivableId)
            ->whereNull('a.reversed_at')
            ->where('p.status', 'aplicado')
            ->sum('a.amount'));
        $amount = Decimal::of($receivable->amount);
        $paid = $paid->isGreaterThan($amount) ? $amount : $paid;
        $status = self::status($receivable->status, $amount, $paid, $receivable->due_date, $this->money->today());

        DB::table('fin_receivables')->where('id', $receivableId)->update([
            'paid_amount' => (string) Decimal::round2($paid),
            'status' => $status,
            'lock_version' => DB::raw('lock_version + 1'),
            'updated_by' => $actor?->getKey(),
            'updated_at' => now(),
        ]);

        $this->syncReservation($receivable->reservation_id, $actor);

        return (object) ['code' => $receivable->code, 'before' => (string) Decimal::round2(self::balance($receivable)), 'after' => (string) Decimal::round2($amount->minus($paid)), 'status' => $status];
    }

    private function syncReservation(string $reservationId, ?User $actor): void
    {
        $reservation = DB::table('booking_reservations')->where('id', $reservationId)->first(['code', 'status', 'ecom_order_id']);
        if ($reservation === null || $reservation->status !== 'pendiente_pago') {
            return;
        }

        if ($reservation->ecom_order_id !== null) {
            $this->web->confirm($reservationId, $actor);

            return;
        }

        $open = DB::table('fin_receivables')->where('reservation_id', $reservationId)->whereNull('deleted_at')->where('status', '<>', 'cancelada');
        if ((clone $open)->count() === 0 || (clone $open)->where('status', '<>', 'pagada')->exists()) {
            return;
        }

        DB::table('booking_reservations')->where('id', $reservationId)->update(['status' => 'confirmada', 'updated_at' => now()]);
        $this->audit->log('Reserva', $reservation->code, 'confirmar', 'pendiente_pago', 'confirmada (obligaciones pagadas)');
        $this->payables->handle($reservationId, $actor);
    }
}
