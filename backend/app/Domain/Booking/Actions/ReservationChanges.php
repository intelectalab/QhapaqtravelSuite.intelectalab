<?php

declare(strict_types=1);

namespace App\Domain\Booking\Actions;

use App\Domain\Admin\Support\TenantSettings;
use App\Domain\Booking\Actions\Support\ServicesFromQuoteItem;
use App\Domain\Booking\Support\ReservationNotices;
use App\Domain\Crm\Support\Portfolio;
use App\Domain\Finance\Actions\SyncServicePayables;
use App\Domain\Finance\Support\ReceivableLedger;
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

final class ReservationChanges
{
    public const TYPES = ['pax', 'servicio', 'upgrade', 'otro'];

    public function __construct(
        private readonly TenantContext $context,
        private readonly SequenceService $sequences,
        private readonly AuditLogger $audit,
        private readonly ServicesFromQuoteItem $services,
        private readonly ReservationMailer $mailer,
        private readonly SyncServicePayables $payables,
    ) {}

    public function options(string $code, User $actor): array
    {
        $reservation = $this->open($code, $actor);

        return [
            'pax' => $this->paxCount($reservation->id),
            'can_approve' => $actor->can('quotes.approve_internal'),
            'products' => DB::table('catalog_products')->whereNull('deleted_at')->where('status', 'ACTIVE')->where('is_bookable', true)->orderBy('name')->get(['code', 'name']),
            'pending' => $this->pending($reservation->id),
        ];
    }

    public function preview(string $code, array $data, User $actor): array
    {
        $reservation = $this->open($code, $actor);

        return $this->impact($reservation, $data);
    }

    public function request(string $code, array $data, bool $applyNow, User $actor): void
    {
        DB::transaction(function () use ($code, $data, $applyNow, $actor): void {
            $reservation = $this->open($code, $actor, true);
            $minHours = (int) (app(TenantSettings::class)->section('operations')['modify_min_hours'] ?? 48);
            $start = CarbonImmutable::parse((string) $reservation->travel_from, $this->context->timezone())->startOfDay();

            if ($minHours > 0 && CarbonImmutable::now($this->context->timezone())->diffInHours($start, false) < $minHours && ! $actor->can('quotes.approve_internal')) {
                throw ApiException::conflict('RES-BR-30', "Los cambios se piden con al menos {$minHours} h de anticipación al viaje. Pide a Gerencia que lo gestione.");
            }

            $impact = $this->impact($reservation, $data);

            if (! $impact['available']) {
                throw ApiException::conflict('PRD-BR-012', $impact['note']);
            }

            $delta = isset($data['delta']) && $data['delta'] !== '' ? Decimal::money($data['delta']) : Decimal::of($impact['suggested']);
            $product = $data['type'] === 'servicio' ? DB::table('catalog_products')->where('code', $data['product_code'])->first(['id']) : null;
            $changeId = (string) DB::table('booking_changes')->insertGetId([
                'reservation_id' => $reservation->id,
                'type' => $data['type'],
                'description' => $data['description'],
                'extra_pax' => $data['type'] === 'pax' ? (int) $data['extra_pax'] : null,
                'product_id' => $product?->id,
                'service_date' => $data['type'] === 'servicio' ? $data['service_date'] : null,
                'delta_amount' => (string) $delta,
                'status' => 'pendiente',
                'requested_by' => $actor->getKey(),
                'payload' => json_encode(['suggested' => $impact['suggested'], 'unit_cost' => $impact['unit_cost'], 'pax' => $impact['pax']], JSON_UNESCAPED_UNICODE),
                'created_by' => $actor->getKey(),
            ]);
            $this->audit->log('Reserva', $reservation->code, 'solicitar_modificacion', null, "{$data['type']} · {$reservation->currency} {$delta} · {$data['description']}");

            if ($applyNow) {
                if (! $actor->can('quotes.approve_internal')) {
                    throw ApiException::forbidden('FORBIDDEN', 'Solo un supervisor aplica la modificación al momento.', ['quotes.approve_internal']);
                }
                $this->apply($reservation, $changeId, $actor);
            } else {
                app(ReservationNotices::class)->changeRequested((string) $reservation->id, (string) $data['description'], (string) $actor->getKey());
            }
        });
    }

    public function approve(string $code, string $changeId, User $actor): void
    {
        DB::transaction(function () use ($code, $changeId, $actor): void {
            $reservation = $this->open($code, $actor, true);
            $this->apply($reservation, $changeId, $actor);
            app(ReservationNotices::class)->changeDecided((string) $reservation->id, (string) DB::table('booking_changes')->where('id', $changeId)->value('requested_by'), true, null, (string) $actor->getKey());
        });
    }

    public function reject(string $code, string $changeId, string $note, User $actor): void
    {
        $reservation = $this->open($code, $actor);
        $updated = DB::table('booking_changes')->where('id', $changeId)->where('reservation_id', $reservation->id)->where('status', 'pendiente')
            ->update(['status' => 'rechazada', 'decided_by' => $actor->getKey(), 'decided_at' => now(), 'updated_by' => $actor->getKey(), 'updated_at' => now()]);

        if ($updated === 0) {
            throw ApiException::notFound('La modificación ya no está pendiente.');
        }

        $this->audit->log('Reserva', $reservation->code, 'rechazar_modificacion', null, $note);
        app(ReservationNotices::class)->changeDecided((string) $reservation->id, (string) DB::table('booking_changes')->where('id', $changeId)->value('requested_by'), false, $note, (string) $actor->getKey());
    }

    public function pending(string $reservationId): Collection
    {
        return DB::table('booking_changes as c')
            ->join('iam_users as u', 'u.id', '=', 'c.requested_by')
            ->leftJoin('catalog_products as p', 'p.id', '=', 'c.product_id')
            ->where('c.reservation_id', $reservationId)
            ->where('c.status', 'pendiente')
            ->orderBy('c.requested_at')
            ->get(['c.id', 'c.type', 'c.description', 'c.extra_pax', 'c.service_date', 'c.delta_amount', 'c.requested_at', 'u.name as requested_by', 'p.name as product']);
    }

    private function impact(object $reservation, array $data): array
    {
        $pax = $this->paxCount($reservation->id);
        $base = ['pax' => $pax, 'unit_cost' => '0.00', 'available' => true, 'note' => null];

        if ($data['type'] === 'pax') {
            $extra = max(1, (int) ($data['extra_pax'] ?? 1));
            foreach ($this->heldDepartures($reservation->id) as $departure) {
                if ((int) $departure->capacity - (int) $departure->sold < $extra) {
                    return [...$base, 'suggested' => '0.00', 'available' => false, 'note' => "Sin disponibilidad: la salida {$departure->ref} no tiene {$extra} cupos libres."];
                }
            }

            return [...$base, 'suggested' => (string) Decimal::of($reservation->total_amount)->multipliedBy($extra)->dividedBy(max(1, $pax), 2, RoundingMode::HALF_UP), 'note' => $extra === 1 ? 'Precio por pasajero de la reserva.' : "Precio por pasajero de la reserva por {$extra}."];
        }

        if ($data['type'] === 'servicio') {
            $product = DB::table('catalog_products')->whereNull('deleted_at')->where('code', $data['product_code'] ?? '')->first(['id', 'name', 'status', 'is_bookable', 'availability_model']);

            if (! $product || $product->status !== 'ACTIVE' || ! $product->is_bookable) {
                return [...$base, 'suggested' => '0.00', 'available' => false, 'note' => 'El producto no está activo para reservas.'];
            }

            $date = (string) ($data['service_date'] ?? '');
            $rate = DB::table('catalog_rates')->where('product_id', $product->id)->where('status', 'vigente')->where('rate_type', 'Venta')
                ->whereIn('segment', ['Adulto', 'Pasajero'])->where('valid_from', '<=', $date ?: now()->toDateString())->where('valid_to', '>=', $date ?: now()->toDateString())
                ->orderByRaw("case when channel = ? then 0 when channel = 'Todos' then 1 else 2 end", [$reservation->channel])->first(['price', 'cost', 'currency']);
            $price = $rate ? $this->convert((string) $rate->price, (string) $rate->currency, (string) $reservation->currency, (string) $reservation->fx_rate) : BigDecimal::zero();
            $cost = $rate ? $this->convert((string) $rate->cost, (string) $rate->currency, (string) $reservation->currency, (string) $reservation->fx_rate) : BigDecimal::zero();
            $check = $this->productAvailability($product, $date, $pax);

            return [...$base, 'suggested' => (string) Decimal::round2($price->multipliedBy($pax)), 'unit_cost' => (string) Decimal::round2($cost), 'available' => $check['ok'], 'note' => $rate ? $check['note'] : 'Sin tarifa vigente: escribe el monto.'];
        }

        return [...$base, 'suggested' => '0.00', 'note' => 'Escribe el monto: positivo es un cargo, negativo un saldo a favor.'];
    }

    private function productAvailability(object $product, string $date, int $pax): array
    {
        if ($product->availability_model !== 'POR_SALIDA') {
            return ['ok' => true, 'note' => 'Se pide al proveedor y queda sujeto a su confirmación.'];
        }

        $departure = DB::table('catalog_product_departures')->where('product_id', $product->id)->where('departure_date', $date)->whereNotIn('status', ['cerrada', 'cancelada'])->first(['ref', 'capacity', 'sold']);

        if (! $departure) {
            return ['ok' => false, 'note' => 'No hay salida programada en esa fecha.'];
        }

        $free = (int) $departure->capacity - (int) $departure->sold;

        return ['ok' => $free >= $pax, 'note' => $free >= $pax ? "Salida {$departure->ref}: quedan {$free} cupos." : "Sin disponibilidad: la salida {$departure->ref} no tiene {$pax} cupos libres."];
    }

    private function apply(object $reservation, string $changeId, User $actor): void
    {
        if (! $actor->can('quotes.approve_internal')) {
            throw ApiException::forbidden('FORBIDDEN', 'Solo un supervisor aprueba modificaciones.', ['quotes.approve_internal']);
        }

        $change = DB::table('booking_changes')->where('id', $changeId)->where('reservation_id', $reservation->id)->lockForUpdate()->first();
        if (! $change || $change->status !== 'pendiente') {
            throw ApiException::notFound('La modificación ya no está pendiente.');
        }

        $delta = Decimal::money($change->delta_amount);
        $payload = json_decode((string) $change->payload, true) ?: [];

        if ($change->type === 'pax') {
            $this->applyPax($reservation, (int) $change->extra_pax, $delta, $actor);
        }

        if ($change->type === 'servicio') {
            $this->applyService($reservation, $change, $delta, Decimal::of($payload['unit_cost'] ?? '0'), $actor);
        }

        $credit = $delta->isNegative() ? $this->absorbCredit($reservation, $delta->abs(), $actor) : null;

        if ($delta->isPositive()) {
            $code = $this->sequences->next('receivable');
            $due = CarbonImmutable::parse((string) $reservation->travel_from)->subDays(7)->max($this->today());
            DB::table('fin_receivables')->insert(['code' => $code, 'reservation_id' => $reservation->id, 'client_id' => $reservation->client_id, 'kind' => 'ajuste', 'concept' => mb_substr("Ajuste por modificación — {$reservation->title}", 0, 255), 'amount' => (string) $delta, 'currency' => $reservation->currency, 'fx_rate' => $reservation->fx_rate, 'due_date' => $due->toDateString(), 'status' => 'abierta', 'created_by' => $actor->getKey(), 'updated_by' => $actor->getKey()]);
            $this->audit->log('Cuenta por cobrar', $code, 'crear', null, "{$reservation->currency} {$delta}");
        }

        DB::table('booking_reservations')->where('id', $reservation->id)->update(['total_amount' => DB::raw('total_amount + ('.$delta.')'), 'lock_version' => DB::raw('lock_version + 1'), 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
        DB::table('booking_changes')->where('id', $changeId)->update(['status' => 'aplicada', 'credit_amount' => $credit === null ? null : (string) $credit, 'decided_by' => $actor->getKey(), 'decided_at' => now(), 'applied_at' => now(), 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
        $this->payables->handle((string) $reservation->id, $actor);
        $this->audit->log('Reserva', $reservation->code, 'modificar', null, "{$change->type} · {$reservation->currency} {$delta} · {$change->description}");
        $this->mailer->send($reservation->id, 'Tu reserva fue modificada', "Registramos este cambio en tu viaje {$reservation->title}: {$change->description}.".($delta->isPositive() ? " El nuevo cargo es {$reservation->currency} {$delta}." : ($delta->isNegative() ? ' Tienes un saldo a favor de '.$reservation->currency.' '.$delta->abs().'.' : '')));
    }

    private function applyPax(object $reservation, int $extra, BigDecimal $delta, User $actor): void
    {
        foreach ($this->heldDepartures($reservation->id) as $departure) {
            if ((int) $departure->capacity - (int) $departure->sold < $extra) {
                throw ApiException::conflict('PRD-BR-012', "Sin disponibilidad: la salida {$departure->ref} no tiene {$extra} cupos libres.");
            }
            DB::table('catalog_product_departures')->where('id', $departure->id)->update(['sold' => DB::raw("sold + {$extra}"), 'status' => DB::raw("case when sold + {$extra} >= capacity then 'completa' else status end"), 'updated_by' => $actor->getKey()]);
        }

        $seq = (int) DB::table('booking_passengers')->where('reservation_id', $reservation->id)->max('seq');
        $adults = DB::table('booking_passengers')->where('reservation_id', $reservation->id)->where('pax_type', 'ADT')->count();
        $rows = [];
        for ($i = 1; $i <= $extra; $i++) {
            $rows[] = ['reservation_id' => $reservation->id, 'seq' => $seq + $i, 'full_name' => 'Pasajero ADT '.($adults + $i).' (por completar)', 'pax_type' => 'ADT', 'is_placeholder' => true, 'is_lead' => false, 'created_by' => $actor->getKey()];
        }
        DB::table('booking_passengers')->insert($rows);
        $services = DB::table('booking_reservation_services')->where('reservation_id', $reservation->id)->whereNotIn('status', ['cancelado', 'completado', 'rechazado'])->orderBy('service_date')->orderBy('code')->get(['id', 'name', 'pax', 'price_amount', 'cost_amount']);
        $weights = $services->map(fn (object $service): BigDecimal => Decimal::of($service->price_amount)->isPositive() ? Decimal::of($service->price_amount) : BigDecimal::zero())->all();
        $total = array_reduce($weights, fn (BigDecimal $sum, BigDecimal $weight): BigDecimal => $sum->plus($weight), BigDecimal::zero());
        $shares = Decimal::allocate($delta, $total->isZero() ? array_fill(0, count($weights), BigDecimal::one()) : $weights);

        foreach ($services->values() as $index => $service) {
            $share = $shares[$index];
            $pax = $service->pax === null ? null : (int) $service->pax + $extra;
            DB::table('booking_reservation_services')->where('id', $service->id)->update([
                'pax' => $pax,
                'name' => $pax === null ? $service->name : (string) preg_replace('/\(\d+ pax\)/', "({$pax} pax)", (string) $service->name),
                'price_amount' => (string) Decimal::round2(Decimal::of($service->price_amount)->plus($share)),
                'cost_amount' => $service->pax ? (string) Decimal::of($service->cost_amount)->multipliedBy((int) $pax)->dividedBy((int) $service->pax, 2, RoundingMode::HALF_UP) : $service->cost_amount,
                'updated_by' => $actor->getKey(),
                'updated_at' => now(),
            ]);
        }
    }

    private function applyService(object $reservation, object $change, BigDecimal $delta, BigDecimal $unitCost, User $actor): void
    {
        $product = DB::table('catalog_products')->where('id', $change->product_id)->first(['id', 'name', 'status', 'is_bookable', 'availability_model', 'main_provider_id']);
        $pax = $this->paxCount($reservation->id);
        $check = $product ? $this->productAvailability($product, (string) $change->service_date, $pax) : ['ok' => false, 'note' => 'El producto ya no existe.'];

        if (! $check['ok'] || ! $product || $product->status !== 'ACTIVE') {
            throw ApiException::conflict('PRD-BR-012', $check['note'] ?: 'El producto ya no está activo.');
        }

        $departureId = $product->availability_model === 'POR_SALIDA'
            ? DB::table('catalog_product_departures')->where('product_id', $product->id)->where('departure_date', $change->service_date)->whereNotIn('status', ['cerrada', 'cancelada'])->lock('for no key update')->value('id')
            : null;
        $item = (object) ['id' => null, 'product_id' => $product->id, 'service_date' => $change->service_date, 'qty' => 1, 'pax' => $pax, 'unit_price' => (string) ($delta->isPositive() ? $delta->dividedBy(max(1, $pax), 6, RoundingMode::HALF_UP) : BigDecimal::zero()), 'unit_cost' => (string) $unitCost];
        $version = (object) ['discount_pct' => 0, 'currency' => $reservation->currency, 'fx_rate' => $reservation->fx_rate];
        $count = DB::table('booking_reservation_services')->where('reservation_id', $reservation->id)->count();
        $number = (int) substr((string) $reservation->code, -6);

        foreach ($this->services->build($item, (string) $version->discount_pct, (string) $version->currency, (string) $version->fx_rate, $departureId, $product->main_provider_id) as $index => $row) {
            $count++;
            $serviceId = (string) DB::table('booking_reservation_services')->insertGetId([...$row, 'reservation_id' => $reservation->id, 'code' => sprintf('RS-%d%02d', $number, $count), 'created_by' => $actor->getKey(), 'updated_by' => $actor->getKey()]);

            if ($departureId && $index === 0) {
                DB::table('booking_inventory_holds')->insert(['departure_id' => $departureId, 'reservation_id' => $reservation->id, 'booking_service_id' => $serviceId, 'pax' => $pax, 'status' => 'confirmada', 'created_by' => $actor->getKey(), 'updated_by' => $actor->getKey()]);
            }
        }

        if ($departureId) {
            DB::table('catalog_product_departures')->where('id', $departureId)->update(['sold' => DB::raw("sold + {$pax}"), 'status' => DB::raw("case when sold + {$pax} >= capacity then 'completa' else status end"), 'updated_by' => $actor->getKey()]);
        }

        DB::table('booking_reservations')->where('id', $reservation->id)->update([
            'travel_from' => min((string) $reservation->travel_from, (string) $change->service_date),
            'travel_to' => max((string) $reservation->travel_to, (string) $change->service_date),
        ]);
    }

    private function absorbCredit(object $reservation, BigDecimal $credit, User $actor): ?BigDecimal
    {
        $receivables = DB::table('fin_receivables')->where('reservation_id', $reservation->id)->whereNull('deleted_at')->whereIn('status', ['abierta', 'parcial', 'vencida'])->orderBy('due_date')->lockForUpdate()->get(['id', 'code', 'amount', 'paid_amount', 'status']);

        foreach ($receivables as $receivable) {
            if (! $credit->isPositive()) {
                break;
            }

            $open = ReceivableLedger::balance($receivable);
            $take = $open->isLessThan($credit) ? $open : $credit;
            $credit = $credit->minus($take);
            $left = Decimal::of($receivable->amount)->minus($take);

            if ($left->isGreaterThan(Decimal::of($receivable->paid_amount))) {
                DB::table('fin_receivables')->where('id', $receivable->id)->update(['amount' => (string) $left, 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
            } elseif (Decimal::of($receivable->paid_amount)->isPositive()) {
                DB::table('fin_receivables')->where('id', $receivable->id)->update(['amount' => $receivable->paid_amount, 'status' => 'pagada', 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
            } else {
                DB::table('fin_receivables')->where('id', $receivable->id)->update(['status' => 'cancelada', 'cancelled_at' => now(), 'cancel_reason' => 'Cubierta por saldo a favor de una modificación', 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
            }

            $this->audit->log('Cuenta por cobrar', $receivable->code, 'reducir', (string) $receivable->amount, (string) ($left->isNegative() ? BigDecimal::zero()->toScale(2) : $left));
        }

        return $credit->isPositive() ? $credit : null;
    }

    private function heldDepartures(string $reservationId): Collection
    {
        $ids = DB::table('booking_inventory_holds')->where('reservation_id', $reservationId)->whereIn('status', ['hold', 'confirmada'])->distinct()->pluck('departure_id')->sort()->values()->all();

        return $ids ? DB::table('catalog_product_departures')->whereIn('id', $ids)->orderBy('id')->lock('for no key update')->get(['id', 'ref', 'capacity', 'sold']) : collect();
    }

    private function paxCount(string $reservationId): int
    {
        return max(1, DB::table('booking_passengers')->where('reservation_id', $reservationId)->count());
    }

    private function convert(string $amount, string $from, string $to, string $fx): BigDecimal
    {
        if ($from === $to || ! Decimal::of($fx)->isPositive()) {
            return Decimal::of($amount);
        }

        return Decimal::convert($amount, $from, $to, Decimal::of($fx));
    }

    private function open(string $code, User $actor, bool $lock = false): object
    {
        $query = Portfolio::scope(DB::table('booking_reservations')->whereNull('deleted_at'), $actor, 'owner_id')->where('code', $code);
        $reservation = ($lock ? $query->lock('for no key update') : $query)->first() ?? throw Portfolio::missing($actor, 'booking_reservations', $code, 'La reserva no existe.', 'Esta reserva');

        if (in_array($reservation->status, ReservationWorkflow::CLOSED, true)) {
            throw ApiException::conflict('RESERVATION_CLOSED', 'La reserva ya está cerrada y no admite modificaciones.');
        }

        return $reservation;
    }

    private function today(): CarbonImmutable
    {
        return CarbonImmutable::now($this->context->tenant()->timezone ?: 'America/Lima')->startOfDay();
    }
}
