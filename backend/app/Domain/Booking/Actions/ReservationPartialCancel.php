<?php

declare(strict_types=1);

namespace App\Domain\Booking\Actions;

use App\Domain\Booking\Enums\ReservationStatus;
use App\Domain\Booking\Models\Reservation;
use App\Domain\Booking\StateMachines\ReservationStateMachine;
use App\Domain\Crm\Support\Portfolio;
use App\Domain\Finance\Actions\SyncServicePayables;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Money\Decimal;
use App\Domain\Shared\Sequences\SequenceService;
use App\Domain\Shared\Tenancy\TenantContext;
use Brick\Math\BigDecimal;
use Brick\Math\RoundingMode;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

final class ReservationPartialCancel
{
    private const FROM = ['confirmada', 'en_operacion', 'parcial'];

    public function __construct(
        private readonly ReservationWorkflow $workflow,
        private readonly ReservationStateMachine $states,
        private readonly SequenceService $sequences,
        private readonly AuditLogger $audit,
        private readonly SyncServicePayables $payables,
        private readonly TenantContext $context,
    ) {}

    public function preview(string $code, array $services, User $actor): array
    {
        return $this->calculate($this->reservation($code, $actor), $services);
    }

    public function cancel(string $code, array $services, string $reason, string $detail, User $actor): void
    {
        DB::transaction(function () use ($code, $services, $reason, $detail, $actor): void {
            $reservation = $this->reservation($code, $actor, true);
            $calc = $this->calculate($reservation, $services);
            $ids = DB::table('booking_reservation_services')->where('reservation_id', $reservation->id)->whereIn('code', $calc['services'])->pluck('id')->all();
            $now = now();

            $this->releaseSeats($ids, $actor);
            DB::table('booking_reservation_services')->whereIn('id', $ids)->update(['status' => 'cancelado', 'updated_by' => $actor->getKey(), 'updated_at' => $now]);

            foreach (DB::table('ops_vouchers')->whereIn('reservation_service_id', $ids)->where('status', 'emitido')->get(['id', 'code']) as $voucher) {
                DB::table('ops_vouchers')->where('id', $voucher->id)->update(['status' => 'anulado', 'void_reason' => 'Servicio cancelado', 'void_at' => $now, 'void_by' => $actor->getKey()]);
                $this->audit->log('Voucher', $voucher->code, 'anular', 'emitido', 'anulado');
            }

            DB::table('ops_assignments')->whereIn('reservation_service_id', $ids)->whereNotIn('status', ['completada', 'cancelada'])->update(['status' => 'cancelada', 'updated_by' => $actor->getKey(), 'updated_at' => $now]);

            $this->reduceReceivables($reservation, BigDecimal::of($calc['credit']), $actor);

            if (BigDecimal::of($calc['refund'])->isPositive()) {
                $paymentCode = $this->sequences->next('payment');
                DB::table('fin_payments')->insert(['code' => $paymentCode, 'reservation_id' => $reservation->id, 'kind' => 'reembolso', 'source' => 'reserva', 'method' => 'Reembolso (mismo medio de pago)', 'amount' => $calc['refund'], 'currency' => $reservation->currency, 'fx_rate' => $reservation->fx_rate, 'paid_on' => $this->today()->toDateString(), 'reference' => 'Reembolso por cancelación parcial · 7 a 15 días hábiles', 'status' => 'pendiente', 'registered_by' => $actor->getKey(), 'created_by' => $actor->getKey(), 'updated_by' => $actor->getKey()]);
                $this->audit->log('Pago', $paymentCode, 'crear_reembolso', null, "{$reservation->currency} {$calc['refund']}");
            }

            $model = Reservation::query()->whereKey($reservation->id)->firstOrFail();
            if ($model->statusEnum() !== ReservationStatus::Parcial) {
                $this->states->transition($model, ReservationStatus::Parcial);
            }
            $model->forceFill(['total_amount' => $calc['new_total'], 'updated_by' => $actor->getKey()])->save();
            DB::table('booking_reservations')->where('id', $reservation->id)->update(['lock_version' => DB::raw('lock_version + 1')]);
            $this->payables->handle((string) $reservation->id, $actor);
            $this->audit->log('Reserva', $reservation->code, 'cancelar_servicios', $reservation->status, mb_substr("parcial · {$reason}: {$detail} · ".implode(', ', $calc['services'])." · penalidad {$reservation->currency} {$calc['penalty']} · reembolso {$calc['refund']}", 0, 250));
        });
    }

    private function calculate(object $reservation, array $codes): array
    {
        $full = $this->workflow->penalty($reservation);
        $lines = collect($full['lines'])->whereIn('code', $codes)->values();

        if ($lines->isEmpty() || $lines->count() !== count(array_unique($codes))) {
            throw ApiException::unprocessable('RES-PARTIAL-SERVICES', 'Elige servicios activos de la reserva.', ['services' => ['Elige servicios activos de la reserva.']]);
        }

        if ($lines->count() >= count($full['lines'])) {
            throw ApiException::conflict('RES-PARTIAL-ALL', 'Si cancelas todos los servicios, cancela la reserva completa.');
        }

        $factor = BigDecimal::of($full['factor_k']);
        $value = $lines->reduce(fn (BigDecimal $sum, array $line): BigDecimal => $sum->plus($line['price']), BigDecimal::zero()->toScale(2));
        $penaltyServices = $lines->reduce(fn (BigDecimal $sum, array $line): BigDecimal => $sum->plus($line['penalty']), BigDecimal::zero()->toScale(2));
        $credit = Decimal::round2($value->minus($penaltyServices)->multipliedBy($factor)->toScale(6, RoundingMode::HALF_UP));
        $penalty = Decimal::round2($penaltyServices->multipliedBy($factor)->toScale(6, RoundingMode::HALF_UP));
        $total = BigDecimal::of($full['total']);
        $newTotal = BigDecimal::max(BigDecimal::zero()->toScale(2), $total->minus($credit));
        $paid = BigDecimal::of($full['paid']);
        $refund = $paid->minus($newTotal);

        return [
            'code' => $reservation->code,
            'currency' => $reservation->currency,
            'services' => $lines->pluck('code')->all(),
            'lines' => $lines->all(),
            'total' => (string) $total,
            'paid' => (string) $paid,
            'value' => (string) $value,
            'penalty' => (string) $penalty,
            'credit' => (string) $credit,
            'new_total' => (string) $newTotal,
            'refund' => (string) ($refund->isPositive() ? Decimal::round2($refund) : BigDecimal::zero()->toScale(2)),
            'reasons' => ReservationWorkflow::CANCEL_REASONS,
        ];
    }

    private function reduceReceivables(object $reservation, BigDecimal $credit, User $actor): void
    {
        $left = $credit;
        $rows = DB::table('fin_receivables')->where('reservation_id', $reservation->id)->whereNull('deleted_at')->whereNotIn('status', ['pagada', 'cancelada'])->orderByDesc('due_date')->lockForUpdate()->get(['id', 'code', 'amount', 'paid_amount', 'status']);

        foreach ($rows as $row) {
            if (! $left->isPositive()) {
                break;
            }

            $balance = BigDecimal::of((string) $row->amount)->minus((string) $row->paid_amount);
            $cut = BigDecimal::min($balance, $left);
            $left = $left->minus($cut);
            $amount = BigDecimal::of((string) $row->amount)->minus($cut);
            $paid = BigDecimal::of((string) $row->paid_amount);

            if (! $amount->isPositive() || $amount->isEqualTo($paid) && ! $paid->isPositive()) {
                DB::table('fin_receivables')->where('id', $row->id)->update(['status' => 'cancelada', 'cancelled_at' => now(), 'cancel_reason' => 'Servicios cancelados', 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
                $this->audit->log('Cuenta por cobrar', $row->code, 'cancelar', $row->status, 'cancelada');

                continue;
            }

            DB::table('fin_receivables')->where('id', $row->id)->update(['amount' => (string) $amount, 'status' => $amount->isEqualTo($paid) ? 'pagada' : $row->status, 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
            $this->audit->log('Cuenta por cobrar', $row->code, 'recalcular', (string) $row->amount, (string) $amount);
        }
    }

    private function releaseSeats(array $serviceIds, User $actor): void
    {
        $holds = DB::table('booking_inventory_holds')->whereIn('booking_service_id', $serviceIds)->whereIn('status', ['hold', 'confirmada'])->get(['id', 'departure_id', 'pax']);

        foreach ($holds->groupBy('departure_id') as $departureId => $items) {
            if ($departureId === '') {
                continue;
            }
            $pax = (int) $items->max('pax');
            DB::table('catalog_product_departures')->where('id', $departureId)->lock('for no key update')->first(['id']);
            DB::table('catalog_product_departures')->where('id', $departureId)->update([
                'sold' => DB::raw("greatest(0, sold - {$pax})"),
                'status' => DB::raw("case when status = 'completa' and sold - {$pax} < capacity then 'abierta' else status end"),
                'updated_by' => $actor->getKey(),
            ]);
            $this->audit->log('Disponibilidad', (string) $departureId, 'liberar', null, "{$pax} cupos");
        }

        DB::table('booking_inventory_holds')->whereIn('id', $holds->pluck('id')->all())->update(['status' => 'liberada', 'released_at' => now(), 'updated_by' => $actor->getKey()]);
    }

    private function reservation(string $code, User $actor, bool $lock = false): object
    {
        if (! $actor->can('reservations.cancel')) {
            throw ApiException::forbidden('FORBIDDEN', 'Tu rol no cancela servicios de una reserva.', ['reservations.cancel']);
        }

        $query = Portfolio::scope(DB::table('booking_reservations')->whereNull('deleted_at'), $actor, 'owner_id')->where('code', $code);
        $reservation = ($lock ? $query->lock('for no key update') : $query)->first() ?? throw Portfolio::missing($actor, 'booking_reservations', $code, 'La reserva no existe.', 'Esta reserva');

        if (! in_array($reservation->status, self::FROM, true)) {
            throw ApiException::conflict('RES-PARTIAL-STATE', 'Solo se cancelan servicios de una reserva confirmada o en operación.');
        }

        return $reservation;
    }

    private function today(): CarbonImmutable
    {
        return CarbonImmutable::now($this->context->tenant()->timezone ?: 'America/Lima')->startOfDay();
    }
}
