<?php

declare(strict_types=1);

namespace App\Domain\Booking\Actions;

use App\Domain\Booking\Enums\ReservationStatus;
use App\Domain\Booking\Events\ReservationCancelled;
use App\Domain\Booking\Models\Reservation;
use App\Domain\Booking\StateMachines\ReservationStateMachine;
use App\Domain\Booking\Support\PassengerAgeCheck;
use App\Domain\Booking\Support\ReservationNotices;
use App\Domain\Catalog\Support\CancellationTiers;
use App\Domain\Channels\Support\B2bCredit;
use App\Domain\Crm\Support\Portfolio;
use App\Domain\Finance\Actions\SyncServicePayables;
use App\Domain\Iam\Models\User;
use App\Domain\Operations\Support\TravelDocChecklist;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Money\Decimal;
use App\Domain\Shared\Sequences\SequenceService;
use App\Domain\Shared\Tenancy\TenantContext;
use Brick\Math\BigDecimal;
use Brick\Math\RoundingMode;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

final class ReservationWorkflow
{
    public const CLOSED = ['cancelada', 'completada'];

    public const CANCEL_REASONS = ['Cliente desistió', 'Cambio de planes', 'Motivo de salud', 'Problema de pago', 'Fuerza mayor', 'Error de registro', 'Otro'];

    public function __construct(
        private readonly TenantContext $context,
        private readonly SequenceService $sequences,
        private readonly AuditLogger $audit,
        private readonly ReservationMailer $mailer,
        private readonly B2bCredit $credit,
        private readonly ReservationStateMachine $states,
        private readonly SyncServicePayables $payables,
    ) {}

    public function update(string $code, ?string $notes, User $actor): void
    {
        $reservation = $this->open($code, $actor);
        DB::table('booking_reservations')->where('id', $reservation->id)->update(['notes' => $notes, 'lock_version' => DB::raw('lock_version + 1'), 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
        $this->audit->log('Reserva', $reservation->code, 'editar', null, $notes);
    }

    public function savePassenger(string $code, ?string $passengerId, array $data, User $actor): object
    {
        $reservation = $this->open($code, $actor);

        $id = DB::transaction(function () use ($reservation, $passengerId, $data, $actor): string {
            $values = [
                'full_name' => $data['full_name'],
                'doc_type' => $data['doc_type'] ?? null,
                'doc_number' => $data['doc_number'] ?? null,
                'pax_type' => $data['pax_type'],
                'nationality' => $data['nationality'] ?? null,
                'birth_date' => $data['birth_date'] ?? null,
                'age' => isset($data['birth_date']) ? (int) CarbonImmutable::parse($data['birth_date'])->diffInYears(CarbonImmutable::parse((string) $reservation->travel_from)) : null,
                'phone' => $data['phone'] ?? null,
                'email' => $data['email'] ?? null,
                'diet_notes' => $data['diet_notes'] ?? null,
                'relationship' => $data['relationship'] ?? null,
                'is_placeholder' => false,
                'updated_by' => $actor->getKey(),
                'updated_at' => now(),
            ];

            if (! empty($data['is_lead'])) {
                DB::table('booking_passengers')->where('reservation_id', $reservation->id)->update(['is_lead' => false]);
                $values['is_lead'] = true;
            }

            if ($passengerId) {
                $updated = DB::table('booking_passengers')->where('reservation_id', $reservation->id)->where('id', $passengerId)->update($values);
                if ($updated === 0) {
                    throw ApiException::notFound('El pasajero no existe.');
                }
                $this->audit->log('Reserva', $reservation->code, 'editar_pasajero', null, $data['full_name']);
                $this->touch($reservation->id, $actor);

                return $passengerId;
            }

            $seq = (int) DB::table('booking_passengers')->where('reservation_id', $reservation->id)->max('seq') + 1;
            $first = ! DB::table('booking_passengers')->where('reservation_id', $reservation->id)->exists();
            $id = (string) DB::table('booking_passengers')->insertGetId([...$values, 'reservation_id' => $reservation->id, 'seq' => $seq, 'is_lead' => $values['is_lead'] ?? $first, 'created_by' => $actor->getKey()]);
            $this->audit->log('Reserva', $reservation->code, 'agregar_pasajero', null, $data['full_name']);
            $this->touch($reservation->id, $actor);
            app(TravelDocChecklist::class)->sync((string) $reservation->id);

            return $id;
        });

        $passenger = DB::table('booking_passengers')->where('id', $id)
            ->first(['id', 'reservation_id', 'seq', 'full_name', 'doc_type', 'doc_number', 'pax_type', 'nationality', 'birth_date', 'age', 'phone', 'email', 'diet_notes', 'relationship', 'is_lead', 'is_placeholder']);
        $passenger->warning = app(PassengerAgeCheck::class)->warning((string) $reservation->id, $passenger->age === null ? null : (int) $passenger->age, (string) $passenger->pax_type);

        return $passenger;
    }

    public function deletePassenger(string $code, string $passengerId, User $actor): void
    {
        $reservation = $this->open($code, $actor);

        DB::transaction(function () use ($reservation, $passengerId, $actor): void {
            $passengers = DB::table('booking_passengers')->where('reservation_id', $reservation->id)->orderBy('seq')->get(['id', 'full_name', 'is_lead']);
            $passenger = $passengers->firstWhere('id', $passengerId) ?? throw ApiException::notFound('El pasajero no existe.');

            if ($passengers->count() === 1) {
                throw ApiException::conflict('RES-BR-07', 'La reserva necesita al menos un pasajero.');
            }

            DB::table('booking_passengers')->where('id', $passengerId)->delete();

            if ($passenger->is_lead) {
                DB::table('booking_passengers')->where('id', $passengers->firstWhere('id', '!=', $passengerId)->id)->update(['is_lead' => true]);
            }

            $this->audit->log('Reserva', $reservation->code, 'quitar_pasajero', $passenger->full_name);
            $this->touch($reservation->id, $actor);
        });
    }

    public function cancellationPreview(string $code, User $actor): array
    {
        $reservation = $this->open($code, $actor);

        return $this->penalty($reservation);
    }

    public function cancel(string $code, string $reason, string $detail, User $actor): void
    {
        if (! $actor->can('reservations.cancel')) {
            throw ApiException::forbidden('FORBIDDEN', 'Tu rol solo puede solicitar la anulación.', ['reservations.cancel']);
        }

        DB::transaction(function () use ($code, $reason, $detail, $actor): void {
            $reservation = $this->open($code, $actor, true);
            $calc = $this->penalty($reservation);
            $full = "{$reason}: {$detail}";
            $now = now();

            $this->releaseSeats($reservation->id, $actor);
            $this->credit->reservationCancelled($reservation->id, $reservation->code, $actor->getKey());

            DB::table('booking_reservation_services')->where('reservation_id', $reservation->id)->whereNotIn('status', ['cancelado', 'completado', 'rechazado'])->update(['status' => 'cancelado', 'updated_by' => $actor->getKey(), 'updated_at' => $now]);

            foreach (DB::table('ops_vouchers')->where('reservation_id', $reservation->id)->where('status', 'emitido')->get(['id', 'code']) as $voucher) {
                DB::table('ops_vouchers')->where('id', $voucher->id)->update(['status' => 'anulado', 'void_reason' => 'Reserva cancelada', 'void_at' => $now, 'void_by' => $actor->getKey()]);
                $this->audit->log('Voucher', $voucher->code, 'anular', 'emitido', 'anulado');
            }

            foreach (DB::table('fin_receivables')->where('reservation_id', $reservation->id)->whereNull('deleted_at')->whereNotIn('status', ['pagada', 'cancelada'])->get(['id', 'code', 'status']) as $receivable) {
                DB::table('fin_receivables')->where('id', $receivable->id)->update(['status' => 'cancelada', 'cancelled_at' => $now, 'cancel_reason' => 'Reserva cancelada', 'updated_by' => $actor->getKey(), 'updated_at' => $now]);
                $this->audit->log('Cuenta por cobrar', $receivable->code, 'cancelar', $receivable->status, 'cancelada');
            }

            $penaltyReceivable = null;
            if (BigDecimal::of($calc['owed'])->isPositive()) {
                $penaltyCode = $this->sequences->next('receivable');
                $penaltyReceivable = (string) DB::table('fin_receivables')->insertGetId(['code' => $penaltyCode, 'reservation_id' => $reservation->id, 'client_id' => $reservation->client_id, 'kind' => 'penalidad', 'concept' => mb_substr("Penalidad por cancelación — {$reservation->code}", 0, 255), 'amount' => $calc['owed'], 'currency' => $reservation->currency, 'fx_rate' => $reservation->fx_rate, 'due_date' => $this->today()->addDays(7)->toDateString(), 'status' => 'abierta', 'created_by' => $actor->getKey(), 'updated_by' => $actor->getKey()]);
                $this->audit->log('Cuenta por cobrar', $penaltyCode, 'crear', null, "{$reservation->currency} {$calc['owed']}");
            }

            $refundPayment = null;
            if (BigDecimal::of($calc['refund'])->isPositive()) {
                $paymentCode = $this->sequences->next('payment');
                $refundPayment = (string) DB::table('fin_payments')->insertGetId(['code' => $paymentCode, 'reservation_id' => $reservation->id, 'kind' => 'reembolso', 'source' => 'reserva', 'method' => 'Reembolso (mismo medio de pago)', 'amount' => $calc['refund'], 'currency' => $reservation->currency, 'fx_rate' => $reservation->fx_rate, 'paid_on' => $this->today()->toDateString(), 'reference' => 'Reembolso por cancelación · 7 a 15 días hábiles', 'status' => 'pendiente', 'registered_by' => $actor->getKey(), 'created_by' => $actor->getKey(), 'updated_by' => $actor->getKey()]);
                $this->audit->log('Pago', $paymentCode, 'crear_reembolso', null, "{$reservation->currency} {$calc['refund']}");
            }

            $orders = DB::table('ops_orders')->where('reservation_id', $reservation->id)->pluck('id');
            $released = DB::table('ops_assignments')->whereIn('order_id', $orders)->whereNotIn('status', ['completada', 'cancelada'])
                ->where(fn ($query) => $query->whereNotNull('guide_id')->orWhereNotNull('driver_id')->orWhereNotNull('vehicle_id'))->update(['status' => 'cancelada', 'updated_by' => $actor->getKey(), 'updated_at' => $now]);
            if ($released > 0) {
                $this->audit->log('Asignación de recurso', $reservation->code, 'cancelar', null, "{$released} asignaciones liberadas por la cancelación de la reserva");
            }
            DB::table('ops_orders')->where('reservation_id', $reservation->id)->whereNotIn('status', ['completada', 'cancelada'])->update(['status' => 'cancelada', 'cancelled_at' => $now, 'cancel_reason' => 'Reserva cancelada']);

            $model = Reservation::query()->whereKey($reservation->id)->firstOrFail();
            $this->states->transition($model, ReservationStatus::Cancelada);
            $model->forceFill(['cancel_reason' => $full, 'cancelled_at' => $now, 'penalty_amount' => $calc['penalty'], 'refund_amount' => $calc['refund'], 'updated_by' => $actor->getKey()])->save();
            DB::table('booking_cancellations')->insert(['reservation_id' => $reservation->id, 'total_at_cancel' => $calc['total'], 'paid_at_cancel' => $calc['paid'], 'penalty_services' => $calc['penalty_services'], 'consumed_amount' => $calc['consumed'], 'factor_k' => $calc['factor_k'], 'penalty_amount' => $calc['penalty'], 'refund_amount' => $calc['refund'], 'owed_amount' => $calc['owed'], 'currency' => $reservation->currency, 'lines' => json_encode($calc['lines'], JSON_UNESCAPED_UNICODE), 'refund_payment_id' => $refundPayment, 'penalty_receivable_id' => $penaltyReceivable, 'reason' => $full, 'cancelled_by' => $actor->getKey(), 'cancelled_at' => $now, 'created_by' => $actor->getKey()]);
            $requesters = DB::table('booking_cancel_requests')->where('reservation_id', $reservation->id)->where('status', 'pendiente')->pluck('requested_by');
            DB::table('booking_cancel_requests')->where('reservation_id', $reservation->id)->where('status', 'pendiente')->update(['status' => 'aprobada', 'decided_by' => $actor->getKey(), 'decided_at' => $now, 'decision_note' => 'Cancelación procesada']);
            foreach ($requesters as $requester) {
                app(ReservationNotices::class)->cancelDecided((string) $reservation->id, (string) $requester, true, 'Cancelación procesada', (string) $actor->getKey());
            }
            app(ReservationNotices::class)->cancelled((string) $reservation->id, (string) $actor->getKey());
            $this->payables->handle((string) $reservation->id, $actor);
            ReservationCancelled::dispatch((string) $reservation->id);

            $this->mailer->send($reservation->id, 'Tu reserva fue cancelada', "Cancelamos tu viaje {$reservation->title}.".(BigDecimal::of($calc['refund'])->isPositive() ? " Te reembolsaremos {$reservation->currency} {$calc['refund']} en 7 a 15 días hábiles." : ''));
            $this->audit->log('Reserva', $reservation->code, 'cancelar', $reservation->status, "cancelada · penalidad {$reservation->currency} {$calc['penalty']} · reembolso {$calc['refund']}");
        });
    }

    public function requestCancel(string $code, string $reason, string $detail, User $actor): object
    {
        $reservation = $this->open($code, $actor);

        if ($reservation->owner_id !== $actor->getKey()) {
            throw ApiException::forbidden('FORBIDDEN', 'Solo el responsable de la reserva puede pedir su anulación.');
        }

        if (DB::table('booking_cancel_requests')->where('reservation_id', $reservation->id)->where('status', 'pendiente')->exists()) {
            throw ApiException::conflict('CANCEL_REQUEST_PENDING', 'Ya hay una solicitud de anulación pendiente.');
        }

        $id = (string) DB::table('booking_cancel_requests')->insertGetId(['reservation_id' => $reservation->id, 'reason' => "{$reason}: {$detail}", 'requested_by' => $actor->getKey(), 'requested_at' => now(), 'status' => 'pendiente', 'created_by' => $actor->getKey()]);
        $this->audit->log('Reserva', $reservation->code, 'solicitar_anulacion', null, "{$reason}: {$detail}");
        app(ReservationNotices::class)->cancelRequested((string) $reservation->id, "{$reason}: {$detail}", (string) $actor->getKey());

        return DB::table('booking_cancel_requests')->where('id', $id)->first(['id', 'reservation_id', 'reason', 'requested_by', 'requested_at', 'status']);
    }

    public function rejectCancelRequest(string $code, string $requestId, string $note, User $actor): object
    {
        $reservation = $this->open($code, $actor);
        $updated = DB::table('booking_cancel_requests')->where('reservation_id', $reservation->id)->where('id', $requestId)->where('status', 'pendiente')->update(['status' => 'rechazada', 'decided_by' => $actor->getKey(), 'decided_at' => now(), 'decision_note' => $note, 'updated_at' => now()]);

        if ($updated === 0) {
            throw ApiException::notFound('No hay una solicitud de anulación pendiente.');
        }

        $this->audit->log('Reserva', $reservation->code, 'rechazar_anulacion', null, $note);
        app(ReservationNotices::class)->cancelDecided((string) $reservation->id, (string) DB::table('booking_cancel_requests')->where('id', $requestId)->value('requested_by'), false, $note, (string) $actor->getKey());

        return DB::table('booking_cancel_requests')->where('id', $requestId)->first(['id', 'reservation_id', 'reason', 'requested_by', 'requested_at', 'status', 'decided_by', 'decided_at', 'decision_note']);
    }

    public function penalty(object $reservation): array
    {
        $today = $this->today();
        $services = DB::table('booking_reservation_services as s')
            ->leftJoin('catalog_products as p', 'p.id', '=', 's.product_id')
            ->where('s.reservation_id', $reservation->id)
            ->get(['s.code', 's.name', 's.status', 's.service_date', 's.price_amount', 's.product_id', 'p.code as product_code']);
        $snapshot = json_decode((string) $reservation->policies_snapshot, true) ?: [];
        $policies = DB::table('catalog_product_policies')->whereIn('product_id', $services->pluck('product_id')->filter()->unique()->values()->all())->get(['product_id', 'cancellation', 'penalty_tiers'])->keyBy('product_id');
        $active = $services->whereNotIn('status', ['cancelado', 'completado', 'rechazado']);
        $used = $services->where('status', 'completado');
        $lines = [];
        $penaltyServices = BigDecimal::zero()->toScale(2);

        foreach ($active as $service) {
            $frozen = self::frozenPolicy($snapshot, $service->product_id, $service->product_code);
            $live = $policies[$service->product_id] ?? null;
            $policy = (string) ($frozen['cancel'] ?? $frozen['cancellation'] ?? $live->cancellation ?? '');
            $structured = CancellationTiers::normalize($frozen['penalty_tiers'] ?? null) ?: CancellationTiers::normalize($live->penalty_tiers ?? null);
            $tiers = $structured ?: CancellationTiers::fromText($policy);
            $days = (int) $today->diffInDays(CarbonImmutable::parse($service->service_date, $today->getTimezone()), false);
            $pct = CancellationTiers::pct($tiers, $days);
            $amount = Decimal::round2(BigDecimal::of((string) $service->price_amount)->multipliedBy($pct)->dividedBy(100, 6, RoundingMode::HALF_UP));
            $penaltyServices = $penaltyServices->plus($amount);
            $lines[] = ['code' => $service->code, 'name' => $service->name, 'date' => $service->service_date, 'days' => $days, 'policy' => $policy ?: 'Política estándar', 'tiers' => CancellationTiers::describe($tiers), 'tiers_source' => $structured !== [] ? 'tramos' : 'texto', 'pct' => $pct, 'price' => (string) Decimal::round2((string) $service->price_amount), 'penalty' => (string) $amount];
        }

        $sum = fn (Collection $items): BigDecimal => $items->reduce(fn (BigDecimal $total, object $service): BigDecimal => $total->plus((string) $service->price_amount), BigDecimal::zero()->toScale(2));
        $consumed = $sum($used);
        $allTotal = $sum($active->merge($used));
        $total = Decimal::round2((string) $reservation->total_amount);
        $factor = $allTotal->isPositive() ? $total->dividedBy($allTotal, 6, RoundingMode::HALF_UP) : BigDecimal::one()->toScale(6);
        $paid = $this->paid($reservation);
        $base = $penaltyServices->plus($consumed);
        $penalty = BigDecimal::min($total, $allTotal->isPositive() ? Decimal::round2($base->multipliedBy($total)->dividedBy($allTotal, 6, RoundingMode::HALF_UP)) : $base);
        $refund = $paid->minus($penalty);
        $owed = $penalty->minus($paid);

        return [
            'code' => $reservation->code,
            'currency' => $reservation->currency,
            'total' => (string) $total,
            'paid' => (string) $paid,
            'penalty_services' => (string) $penaltyServices,
            'consumed' => (string) $consumed,
            'factor_k' => (string) $factor,
            'penalty' => (string) $penalty,
            'refund' => (string) ($refund->isPositive() ? $refund : BigDecimal::zero()->toScale(2)),
            'owed' => (string) ($owed->isPositive() ? $owed : BigDecimal::zero()->toScale(2)),
            'lines' => $lines,
            'reasons' => self::CANCEL_REASONS,
            'request' => DB::table('booking_cancel_requests')->where('reservation_id', $reservation->id)->where('status', 'pendiente')->value('reason'),
            'request_id' => DB::table('booking_cancel_requests')->where('reservation_id', $reservation->id)->where('status', 'pendiente')->value('id'),
        ];
    }

    private static function frozenPolicy(array $snapshot, ?string $productId, ?string $productCode): array
    {
        if ($productCode !== null && is_array($snapshot[$productCode] ?? null)) {
            return $snapshot[$productCode];
        }

        if (array_is_list($snapshot)) {
            foreach ($snapshot as $row) {
                if (is_array($row) && ($row['product_id'] ?? null) === $productId) {
                    return $row;
                }
            }

            return [];
        }

        return isset($snapshot['cancellation']) || isset($snapshot['penalty_tiers']) ? $snapshot : [];
    }

    private function paid(object $reservation): BigDecimal
    {
        $fx = (string) ($reservation->fx_rate ?: '1');

        return DB::table('fin_payments')->where('reservation_id', $reservation->id)->where('kind', 'cobro')->whereIn('status', ['aplicado', 'confirmado'])->get(['amount', 'currency'])
            ->reduce(fn (BigDecimal $sum, object $payment): BigDecimal => $sum->plus(Decimal::round2(Decimal::convert((string) $payment->amount, (string) $payment->currency, (string) $reservation->currency, $fx))), BigDecimal::zero()->toScale(2));
    }

    private function releaseSeats(string $reservationId, User $actor): void
    {
        $holds = DB::table('booking_inventory_holds')->where('reservation_id', $reservationId)->whereIn('status', ['hold', 'confirmada'])->get(['id', 'departure_id', 'pax']);
        $byDeparture = $holds->groupBy('departure_id')->map(fn (Collection $items): int => (int) $items->max('pax'));
        $ids = $byDeparture->keys()->sort()->values()->all();

        if ($ids) {
            DB::table('catalog_product_departures')->whereIn('id', $ids)->orderBy('id')->lock('for no key update')->get(['id']);
        }

        foreach ($byDeparture as $departureId => $pax) {
            DB::table('catalog_product_departures')->where('id', $departureId)->update([
                'sold' => DB::raw("greatest(0, sold - {$pax})"),
                'status' => DB::raw("case when status = 'completa' and sold - {$pax} < capacity then 'abierta' else status end"),
                'updated_by' => $actor->getKey(),
            ]);
            $this->audit->log('Disponibilidad', (string) $departureId, 'liberar', null, "{$pax} cupos");
        }

        DB::table('booking_inventory_holds')->whereIn('id', $holds->pluck('id')->all())->update(['status' => 'liberada', 'released_at' => now(), 'updated_by' => $actor->getKey()]);
    }

    private function open(string $code, User $actor, bool $lock = false): object
    {
        $query = Portfolio::scope(DB::table('booking_reservations')->whereNull('deleted_at'), $actor, 'owner_id')->where('code', $code);
        $reservation = ($lock ? $query->lock('for no key update') : $query)->first() ?? throw Portfolio::missing($actor, 'booking_reservations', $code, 'La reserva no existe.', 'Esta reserva');

        if (in_array($reservation->status, self::CLOSED, true)) {
            throw ApiException::conflict('RESERVATION_CLOSED', 'La reserva ya está '.($reservation->status === 'cancelada' ? 'cancelada' : 'completada').' y no admite cambios.');
        }

        return $reservation;
    }

    private function touch(string $reservationId, User $actor): void
    {
        DB::table('booking_reservations')->where('id', $reservationId)->update(['lock_version' => DB::raw('lock_version + 1'), 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
    }

    private function today(): CarbonImmutable
    {
        return CarbonImmutable::now($this->context->tenant()->timezone ?: 'America/Lima')->startOfDay();
    }
}
