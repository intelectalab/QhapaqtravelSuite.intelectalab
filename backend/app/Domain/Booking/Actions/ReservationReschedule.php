<?php

declare(strict_types=1);

namespace App\Domain\Booking\Actions;

use App\Domain\Booking\Events\ReservationRescheduled;
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
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

final class ReservationReschedule
{
    public function __construct(
        private readonly TenantContext $context,
        private readonly SequenceService $sequences,
        private readonly AuditLogger $audit,
        private readonly ReservationMailer $mailer,
        private readonly SyncServicePayables $payables,
    ) {}

    public function preview(string $code, ?string $newStart, User $actor): array
    {
        $reservation = $this->open($code, $actor);

        return $this->plan($reservation, $newStart);
    }

    public function apply(string $code, string $newStart, string $reason, User $actor): void
    {
        DB::transaction(function () use ($code, $newStart, $reason, $actor): void {
            $reservation = $this->open($code, $actor, true);
            $plan = $this->plan($reservation, $newStart);

            if ($plan['blocked']) {
                throw ApiException::conflict('RT-4', $plan['blocked']);
            }

            $now = now();
            $holds = DB::table('booking_inventory_holds')->where('reservation_id', $reservation->id)->whereIn('status', ['hold', 'confirmada'])->get(['id', 'departure_id', 'pax']);
            $release = $holds->groupBy('departure_id')->map(fn (Collection $items): int => (int) $items->max('pax'));
            $targets = collect($plan['lines'])->pluck('departure_id')->filter()->unique()->values();
            $lockIds = $release->keys()->merge($targets)->unique()->sort()->values()->all();

            if ($lockIds) {
                DB::table('catalog_product_departures')->whereIn('id', $lockIds)->orderBy('id')->lock('for no key update')->get(['id']);
            }

            foreach ($release as $departureId => $pax) {
                DB::table('catalog_product_departures')->where('id', $departureId)->update(['sold' => DB::raw("greatest(0, sold - {$pax})"), 'status' => DB::raw("case when status = 'completa' and sold - {$pax} < capacity then 'abierta' else status end"), 'updated_by' => $actor->getKey()]);
            }
            DB::table('booking_inventory_holds')->whereIn('id', $holds->pluck('id')->all())->update(['status' => 'liberada', 'released_at' => $now, 'updated_by' => $actor->getKey()]);

            $held = [];
            foreach ($plan['lines'] as $line) {
                $values = ['service_date' => $line['new_date'], 'price_amount' => $line['new_price'], 'cost_amount' => $line['new_cost'], 'status' => 'pendiente', 'confirmation_code' => null, 'confirmed_at' => null, 'confirmed_by' => null, 'confirmed_by_name' => null, 'departure_id' => $line['departure_id'], 'updated_by' => $actor->getKey(), 'updated_at' => $now];
                DB::table('booking_reservation_services')->where('id', $line['id'])->update($values);

                if ($line['departure_id'] && ! isset($held[$line['departure_id']])) {
                    $held[$line['departure_id']] = true;
                    $pax = (int) $line['pax'];
                    DB::table('catalog_product_departures')->where('id', $line['departure_id'])->update(['sold' => DB::raw("sold + {$pax}"), 'status' => DB::raw("case when sold + {$pax} >= capacity then 'completa' else status end"), 'updated_by' => $actor->getKey()]);
                    DB::table('booking_inventory_holds')->insert(['departure_id' => $line['departure_id'], 'reservation_id' => $reservation->id, 'booking_service_id' => $line['id'], 'pax' => $pax, 'status' => 'confirmada', 'created_by' => $actor->getKey(), 'updated_by' => $actor->getKey()]);
                }
            }

            foreach (DB::table('ops_vouchers')->where('reservation_id', $reservation->id)->where('status', 'emitido')->get(['id', 'code']) as $voucher) {
                DB::table('ops_vouchers')->where('id', $voucher->id)->update(['status' => 'anulado', 'void_reason' => 'Reserva reprogramada: requiere reemisión', 'void_at' => $now, 'void_by' => $actor->getKey()]);
                $this->audit->log('Voucher', $voucher->code, 'anular', 'emitido', 'requiere reemisión');
            }
            DB::table('ops_orders')->where('reservation_id', $reservation->id)->whereNotIn('status', ['completada', 'cancelada'])->update(['status' => 'pendiente_asignacion']);

            $diff = Decimal::of($plan['diff']);
            DB::table('booking_reservations')->where('id', $reservation->id)->update([
                'travel_from' => $plan['new_from'],
                'travel_to' => $plan['new_to'],
                'total_amount' => DB::raw('total_amount + ('.$diff.')'),
                'status' => 'reprogramada',
                'rescheduled_at' => $now,
                'lock_version' => DB::raw('lock_version + 1'),
                'updated_by' => $actor->getKey(),
                'updated_at' => $now,
            ]);
            DB::table('booking_changes')->insert(['reservation_id' => $reservation->id, 'type' => 'reprogramacion', 'description' => $reason, 'delta_amount' => (string) $diff, 'status' => 'aplicada', 'requested_by' => $actor->getKey(), 'decided_by' => $actor->getKey(), 'decided_at' => $now, 'applied_at' => $now, 'payload' => json_encode(['from' => $reservation->travel_from, 'to' => $plan['new_from'], 'shift' => $plan['shift']]), 'created_by' => $actor->getKey()]);

            if ($diff->isPositive()) {
                $code = $this->sequences->next('receivable');
                $due = CarbonImmutable::parse($plan['new_from'])->subDays(7)->max($this->today());
                DB::table('fin_receivables')->insert(['code' => $code, 'reservation_id' => $reservation->id, 'client_id' => $reservation->client_id, 'kind' => 'ajuste', 'concept' => mb_substr("Diferencia tarifaria por reprogramación — {$reservation->title}", 0, 255), 'amount' => (string) $diff, 'currency' => $reservation->currency, 'fx_rate' => $reservation->fx_rate, 'due_date' => $due->toDateString(), 'status' => 'abierta', 'created_by' => $actor->getKey(), 'updated_by' => $actor->getKey()]);
                $this->audit->log('Cuenta por cobrar', $code, 'crear', null, "{$reservation->currency} {$diff}");
            }

            $this->payables->handle((string) $reservation->id, $actor);
            ReservationRescheduled::dispatch((string) $reservation->id);
            $this->audit->log('Reserva', $reservation->code, 'reprogramar', "{$reservation->travel_from} → {$reservation->travel_to}", "{$plan['new_from']} → {$plan['new_to']} · {$reason}");
            $this->mailer->send($reservation->id, 'Tu viaje cambió de fecha', "Tu viaje {$reservation->title} ahora es del {$plan['new_from']} al {$plan['new_to']}.".($diff->isPositive() ? " La diferencia de tarifa es {$reservation->currency} {$diff}." : ''));
        });
    }

    private function plan(object $reservation, ?string $newStart): array
    {
        $today = $this->today();
        $services = DB::table('booking_reservation_services as s')
            ->leftJoin('catalog_products as p', 'p.id', '=', 's.product_id')
            ->where('s.reservation_id', $reservation->id)
            ->whereNotIn('s.status', ['cancelado', 'rechazado'])
            ->orderBy('s.service_date')
            ->get(['s.id', 's.code', 's.name', 's.service_date', 's.status', 's.pax', 's.price_amount', 's.cost_amount', 's.departure_id', 's.product_id', 'p.status as product_status', 'p.availability_model']);
        $from = CarbonImmutable::parse((string) $reservation->travel_from, $today->getTimezone());
        $suggested = $this->suggestedStart($services, $from, $today);
        $start = $newStart ? CarbonImmutable::parse($newStart, $today->getTimezone()) : $suggested;
        $shift = (int) $from->diffInDays($start, false);
        $blocked = null;

        if ($services->contains('status', 'completado')) {
            $blocked = 'Hay servicios ya completados: usa Modificar.';
        } elseif ($start->lt($today)) {
            $blocked = 'La nueva fecha no puede ser pasada.';
        } elseif ($shift === 0) {
            $blocked = 'Elige una fecha distinta a la actual.';
        }

        $lines = [];
        $diff = BigDecimal::zero()->toScale(2);

        foreach ($services as $service) {
            $newDate = CarbonImmutable::parse((string) $service->service_date, $today->getTimezone())->addDays($shift)->toDateString();
            $fo = $this->seasonFactor((string) $service->product_id, (string) $service->service_date);
            $fn = $this->seasonFactor((string) $service->product_id, $newDate);
            $newPrice = Decimal::of($service->price_amount)->multipliedBy($fn)->dividedBy($fo, 2, RoundingMode::HALF_UP);
            $newCost = Decimal::of($service->cost_amount)->multipliedBy($fn)->dividedBy($fo, 2, RoundingMode::HALF_UP);
            $departureId = null;
            $note = 'Se pide de nuevo al proveedor.';
            $ok = true;

            if ($service->product_id && $service->product_status !== 'ACTIVE') {
                [$ok, $note] = [false, 'El producto ya no está activo.'];
            } elseif ($service->availability_model === 'POR_SALIDA') {
                $departure = DB::table('catalog_product_departures')->where('product_id', $service->product_id)->where('departure_date', $newDate)->whereNotIn('status', ['cerrada', 'cancelada'])->first(['id', 'ref', 'capacity', 'sold']);
                $free = $departure ? (int) $departure->capacity - (int) $departure->sold + ($departure->id === $service->departure_id ? (int) $service->pax : 0) : 0;
                $departureId = $departure?->id;
                [$ok, $note] = ! $departure ? [false, 'No hay salida programada en esa fecha.'] : ($free >= (int) $service->pax ? [true, "Salida {$departure->ref}: quedan {$free} cupos."] : [false, "Salida {$departure->ref}: solo quedan {$free} cupos."]);
            }

            if (! $ok && ! $blocked) {
                $blocked = "{$service->name}: {$note}";
            }

            $diff = $diff->plus($newPrice->minus(Decimal::money($service->price_amount)));
            $lines[] = ['id' => $service->id, 'code' => $service->code, 'name' => $service->name, 'date' => $service->service_date, 'new_date' => $newDate, 'pax' => (int) $service->pax, 'price' => (string) Decimal::money($service->price_amount), 'new_price' => (string) $newPrice, 'new_cost' => (string) $newCost, 'departure_id' => $departureId, 'ok' => $ok, 'note' => $note];
        }

        $length = (int) $from->diffInDays(CarbonImmutable::parse((string) $reservation->travel_to, $today->getTimezone()));

        return [
            'code' => $reservation->code,
            'currency' => $reservation->currency,
            'from' => $reservation->travel_from,
            'to' => $reservation->travel_to,
            'suggested' => $suggested->toDateString(),
            'new_from' => $start->toDateString(),
            'new_to' => $start->addDays($length)->toDateString(),
            'shift' => $shift,
            'diff' => (string) $diff,
            'blocked' => $blocked,
            'lines' => $lines,
        ];
    }

    private function suggestedStart(Collection $services, CarbonImmutable $from, CarbonImmutable $today): CarbonImmutable
    {
        $first = $services->first(fn (object $service): bool => $service->availability_model === 'POR_SALIDA');

        if ($first) {
            $date = DB::table('catalog_product_departures')->where('product_id', $first->product_id)->where('departure_date', '>', $first->service_date)->where('departure_date', '>=', $today->toDateString())
                ->whereNotIn('status', ['cerrada', 'cancelada', 'completa'])->whereRaw('capacity - sold >= ?', [(int) $first->pax])->orderBy('departure_date')->value('departure_date');

            if ($date) {
                return $from->addDays((int) CarbonImmutable::parse((string) $first->service_date)->diffInDays(CarbonImmutable::parse((string) $date)));
            }
        }

        return $from->addDays(7)->max($today);
    }

    private function seasonFactor(string $productId, string $date): string
    {
        if ($productId === '') {
            return '1';
        }

        $factor = DB::table('catalog_seasons as s')
            ->join('catalog_product_seasons as ps', 'ps.season_id', '=', 's.id')
            ->where('ps.product_id', $productId)
            ->whereNull('s.deleted_at')
            ->where('s.date_from', '<=', $date)
            ->where('s.date_to', '>=', $date)
            ->orderByDesc('s.priority')
            ->value('s.factor');

        return $factor !== null && Decimal::of($factor)->isPositive() ? (string) $factor : '1';
    }

    private function open(string $code, User $actor, bool $lock = false): object
    {
        $query = Portfolio::scope(DB::table('booking_reservations')->whereNull('deleted_at'), $actor, 'owner_id')->where('code', $code);
        $reservation = ($lock ? $query->lock('for no key update') : $query)->first() ?? throw Portfolio::missing($actor, 'booking_reservations', $code, 'La reserva no existe.', 'Esta reserva');

        if (in_array($reservation->status, ReservationWorkflow::CLOSED, true)) {
            throw ApiException::conflict('RESERVATION_CLOSED', 'La reserva ya está cerrada y no se puede reprogramar.');
        }

        return $reservation;
    }

    private function today(): CarbonImmutable
    {
        return CarbonImmutable::now($this->context->tenant()->timezone ?: 'America/Lima')->startOfDay();
    }
}
