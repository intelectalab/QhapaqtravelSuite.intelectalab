<?php

declare(strict_types=1);

namespace App\Domain\Booking\Support;

use App\Domain\Booking\Data\ProductData;
use App\Domain\Booking\Rules\RuleResolver;
use App\Domain\Catalog\Support\ProductBookingConfig;
use App\Domain\Crm\Support\Portfolio;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Money\Decimal;
use App\Domain\Shared\Tenancy\TenantContext;
use Brick\Math\BigDecimal;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use stdClass;

final class TripReservations
{
    public const SELLABLE = ['confirmada', 'en_operacion'];

    public const LIVE_OFFERS = ['ofrecida', 'link_enviado', 'pagada', 'confirmada'];

    public const OFFER_STATUS = [
        'ofrecida' => 'Ofrecida',
        'link_enviado' => 'Link enviado',
        'pagada' => 'Pagada',
        'confirmada' => 'Confirmada',
        'vencida' => 'Vencida',
        'cancelada' => 'Cancelada',
        'reembolsada' => 'Reembolsada',
    ];

    public function __construct(
        private readonly ProductBookingConfig $config,
        private readonly TenantBookingEngine $engine,
        private readonly RuleResolver $rules,
        private readonly TenantContext $context,
    ) {}

    public function reservation(User $viewer, string $code): stdClass
    {
        return Portfolio::scope(DB::table('booking_reservations as r')->whereNull('r.deleted_at'), $viewer, 'r.owner_id')
            ->where('r.code', $code)->first(['r.id', 'r.code', 'r.title', 'r.status', 'r.currency', 'r.fx_rate', 'r.client_id', 'r.travel_from', 'r.travel_to', 'r.total_amount'])
            ?? throw ApiException::notFound('La reserva no existe.');
    }

    public function byId(string $id): stdClass
    {
        return DB::table('booking_reservations')->where('id', $id)->first(['id', 'code', 'title', 'status', 'currency', 'fx_rate', 'client_id', 'travel_from', 'travel_to', 'total_amount'])
            ?? throw ApiException::notFound('La reserva no existe.');
    }

    public function show(stdClass $reservation): array
    {
        $legs = $this->legs($reservation->id);
        $items = $this->items($reservation->id);
        $productId = $this->productId($reservation->id);
        $data = $productId === null ? null : $this->config->engineProduct($productId);

        return [
            'reservation' => ['code' => $reservation->code, 'title' => $reservation->title, 'status' => $reservation->status, 'currency' => $reservation->currency, 'travel_from' => $reservation->travel_from, 'travel_to' => $reservation->travel_to],
            'product' => $productId === null ? null : DB::table('catalog_products')->where('id', $productId)->first(['id', 'code', 'name']),
            'rules' => [
                'trip_builder' => $data !== null && $this->rules->forTenant()->on('R-TRIP-BUILDER', $data),
                'in_trip_sales' => $data !== null && $this->rules->forTenant()->on('R-IN-TRIP-SALES', $data),
                'min_hours_before' => $this->minHours($data),
            ],
            'pax' => $this->pax($reservation->id),
            'legs' => $legs->map(fn (stdClass $leg): array => [
                'id' => $leg->id,
                'sequence' => (int) $leg->sequence,
                'city' => $leg->city,
                'nights' => (int) $leg->nights,
                'check_in' => (string) $leg->check_in,
                'check_out' => (string) $leg->check_out,
                'items' => $items->where('trip_leg_id', $leg->id)->map(fn (stdClass $item): array => $this->item($item))->values()->all(),
            ])->values()->all(),
            'items' => $items->map(fn (stdClass $item): array => $this->item($item))->values()->all(),
            'trip_end' => $legs->isEmpty() ? null : (string) $legs->last()->check_out,
            'by_category' => $this->byCategory($reservation, $items),
            'offers' => $this->offers($reservation->id),
            'available' => $legs->isEmpty() ? null : $this->available($reservation),
        ];
    }

    public function offers(string $reservationId): array
    {
        return DB::table('booking_in_trip_offers as o')
            ->leftJoin('catalog_leg_tours as t', 't.id', '=', 'o.leg_tour_id')
            ->leftJoin('catalog_transport_options as tr', 'tr.id', '=', 'o.transport_option_id')
            ->leftJoin('fin_payment_links as l', 'l.id', '=', 'o.payment_link_id')
            ->leftJoin('iam_users as u', 'u.id', '=', 'o.created_by')
            ->where('o.reservation_id', $reservationId)->orderByDesc('o.created_at')
            ->get(['o.*', 't.code as tour_code', 't.name as tour_name', 'tr.code as option_code', 'tr.name as option_name', 'l.code as link_code', 'l.url as link_url', 'l.status as link_status', 'u.name as created_by_name'])
            ->map(fn (stdClass $offer): array => self::offer($offer))->all();
    }

    public static function offer(stdClass $offer): array
    {
        return [
            'id' => $offer->id,
            'code' => $offer->code,
            'kind' => $offer->kind,
            'item_id' => $offer->kind === 'tour' ? ($offer->tour_code ?? null) : ($offer->option_code ?? null),
            'name' => $offer->kind === 'tour' ? ($offer->tour_name ?? null) : ($offer->option_name ?? null),
            'service_date' => (string) $offer->service_date,
            'currency' => $offer->currency,
            'amount' => (string) $offer->amount,
            'status' => $offer->status,
            'status_label' => self::OFFER_STATUS[$offer->status] ?? $offer->status,
            'channel' => $offer->channel,
            'expires_at' => CarbonImmutable::parse($offer->expires_at)->toIso8601String(),
            'payment_link' => ($offer->link_code ?? null) === null ? null : ['code' => $offer->link_code, 'url' => $offer->link_url ?? null, 'status' => $offer->link_status ?? null],
            'created_by' => $offer->created_by_name ?? null,
            'created_at' => CarbonImmutable::parse($offer->created_at)->toIso8601String(),
            'cancellable' => in_array($offer->status, ['ofrecida', 'link_enviado'], true),
        ];
    }

    public function available(stdClass $reservation): array
    {
        $productId = $this->productId($reservation->id);
        $data = $productId === null ? null : $this->config->engineProduct($productId);
        $legs = $this->legs($reservation->id);
        $minHours = $this->minHours($data);
        $base = ['reservation' => ['code' => $reservation->code, 'title' => $reservation->title, 'status' => $reservation->status], 'min_hours_before' => $minHours, 'currency' => (string) ($data->trip['currency'] ?? $reservation->currency), 'items' => [], 'offers' => $this->offers($reservation->id)];

        if ($data === null || $legs->isEmpty() || ($data->trip['tours'] ?? []) === [] && ($data->trip['transport'] ?? []) === []) {
            return [...$base, 'enabled' => false, 'reason' => 'Esta reserva no es un viaje por tramos.'];
        }
        if (! $this->rules->forTenant()->on('R-IN-TRIP-SALES', $data)) {
            return [...$base, 'enabled' => false, 'reason' => 'La venta en ruta no está activa para este viaje.'];
        }
        if (! in_array($reservation->status, self::SELLABLE, true)) {
            return [...$base, 'enabled' => false, 'reason' => 'La venta en ruta se abre cuando la reserva está confirmada o en operación.'];
        }

        return [...$base, 'enabled' => true, 'reason' => null, 'items' => $this->candidates($reservation, $data, $legs, $minHours)];
    }

    public function candidate(stdClass $reservation, string $kind, string $itemId): array
    {
        $available = $this->available($reservation);
        if (! $available['enabled']) {
            throw ApiException::unprocessable('TB-09', (string) $available['reason']);
        }
        $item = collect($available['items'])->first(fn (array $row): bool => $row['kind'] === $kind && ($row['item_id'] === $itemId || $row['uuid'] === $itemId));
        if ($item !== null) {
            return [...$item, 'min_hours_before' => $available['min_hours_before']];
        }

        $productId = (string) $this->productId($reservation->id);
        $data = $this->config->engineProduct($productId);
        $catalog = collect($kind === 'tour' ? ($data->trip['tours'] ?? []) : ($data->trip['transport'] ?? []))->first(fn (array $row): bool => $row['id'] === $itemId || $row['uuid'] === $itemId);
        if ($catalog === null) {
            throw ApiException::notFound($kind === 'tour' ? 'El tour no existe en este viaje.' : 'La opción de movilidad no existe en este viaje.');
        }
        $all = $this->candidates($reservation, $data, $this->legs($reservation->id), $available['min_hours_before'], false);
        $row = collect($all)->first(fn (array $r): bool => $r['kind'] === $kind && $r['item_id'] === $catalog['id']);

        throw ApiException::unprocessable('TB-09', $row['blocked_reason'] ?? 'Ese servicio no se puede comprar en ruta.', ['item_id' => [$row['blocked_reason'] ?? 'Ese servicio no se puede comprar en ruta.']]);
    }

    public function productId(string $reservationId): ?string
    {
        $snapshot = DB::table('booking_reservation_web_snapshots')->where('reservation_id', $reservationId)->value('product_id');
        if ($snapshot !== null && DB::table('catalog_accommodation_legs')->where('product_id', $snapshot)->exists()) {
            return (string) $snapshot;
        }
        $leg = DB::table('booking_trip_legs as b')->join('catalog_accommodation_legs as l', 'l.id', '=', 'b.leg_id')->where('b.reservation_id', $reservationId)->value('l.product_id');

        return $leg === null ? null : (string) $leg;
    }

    public function pax(string $reservationId): array
    {
        $snapshot = DB::table('booking_reservation_web_snapshots')->where('reservation_id', $reservationId)->first(['pax_adt', 'pax_chd', 'pax_inf']);
        if ($snapshot !== null) {
            return ['adt' => (int) $snapshot->pax_adt, 'chd' => (int) $snapshot->pax_chd, 'inf' => (int) $snapshot->pax_inf];
        }
        $types = DB::table('booking_passengers')->where('reservation_id', $reservationId)->selectRaw('pax_type, count(*) as n')->groupBy('pax_type')->pluck('n', 'pax_type');

        return ['adt' => max(1, (int) ($types['ADT'] ?? 0)), 'chd' => (int) ($types['CHD'] ?? 0), 'inf' => (int) ($types['INF'] ?? 0)];
    }

    public function minHours(?ProductData $data): int
    {
        return (int) ($this->rules->forTenant()->param('R-IN-TRIP-SALES', 'minHoursBefore', $data) ?? 12) ?: 12;
    }

    public function startsAt(string $date, ?string $time): CarbonImmutable
    {
        return CarbonImmutable::parse($date.' '.($time ?: '08:00'), $this->context->timezone());
    }

    private function candidates(stdClass $reservation, ProductData $data, Collection $legs, int $minHours, bool $onlySellable = true): array
    {
        $engine = $this->engine->engine();
        $pax = $this->pax($reservation->id);
        $byCatalog = $legs->keyBy('leg_code');
        $items = $this->items($reservation->id);
        $offers = DB::table('booking_in_trip_offers')->where('reservation_id', $reservation->id)->whereIn('status', self::LIVE_OFFERS)->get(['leg_tour_id', 'transport_option_id', 'service_date']);
        $haveTours = $items->pluck('leg_tour_id')->merge($offers->pluck('leg_tour_id'))->filter()->all();
        $haveOptions = $items->pluck('transport_option_id')->merge($offers->pluck('transport_option_id'))->filter()->all();
        $options = collect($data->trip['transport'] ?? [])->keyBy('uuid');
        $pairs = collect($haveOptions)->map(fn (string $id): ?string => ($options[$id]['toLegId'] ?? null) === null ? null : $options[$id]['fromLegId'].'>'.$options[$id]['toLegId'])->filter()->all();
        $cutoff = CarbonImmutable::now($this->context->timezone())->addHours($minHours);
        $out = [];

        foreach ($data->trip['tours'] ?? [] as $tour) {
            $leg = $byCatalog->get($tour['legId']);
            if ($leg === null) {
                continue;
            }
            $date = (string) $engine->tourDate($tour, ['checkIn' => (string) $leg->check_in, 'nights' => (int) $leg->nights]);
            $blocked = match (true) {
                ! $tour['inTrip'] => 'Este tour no se vende en ruta.',
                in_array($tour['uuid'], $haveTours, true) => 'Ya está en el viaje o tiene una oferta abierta.',
                $this->startsAt($date, $tour['time'])->lt($cutoff) => "Se compra hasta {$minHours} h antes del inicio.",
                default => null,
            };
            $out[] = $this->row('tour', $tour, (string) $leg->city, $date, $tour['time'], $engine->tripItemAmount($tour, 'tour', $pax), $blocked, $leg->id);
        }

        foreach ($data->trip['transport'] ?? [] as $option) {
            $from = $byCatalog->get($option['fromLegId']);
            $to = $option['toLegId'] === null ? null : $byCatalog->get($option['toLegId']);
            if ($from === null || ($option['toLegId'] !== null && $to === null)) {
                continue;
            }
            $date = (string) ($to !== null ? $to->check_in : $from->check_in);
            $blocked = match (true) {
                ! $option['inTrip'] => 'Esta movilidad no se vende en ruta.',
                in_array($option['uuid'], $haveOptions, true) => 'Ya está en el viaje o tiene una oferta abierta.',
                $option['toLegId'] !== null && in_array($option['fromLegId'].'>'.$option['toLegId'], $pairs, true) => 'Ese trayecto ya tiene movilidad elegida.',
                $this->startsAt($date, null)->lt($cutoff) => "Se compra hasta {$minHours} h antes del inicio.",
                default => null,
            };
            $out[] = $this->row('transport', $option, (string) ($to->city ?? $from->city), $date, null, $engine->tripItemAmount($option, 'transport', $pax), $blocked, ($to ?? $from)->id, $to !== null ? (string) $from->city : null);
        }

        $out = collect($out)->sortBy(fn (array $row): string => $row['date'].' '.($row['time'] ?? '08:00'))->values();

        return ($onlySellable ? $out->whereNull('blocked_reason') : $out)->values()->all();
    }

    private function row(string $kind, array $item, string $city, string $date, ?string $time, array $priced, ?string $blocked, string $tripLegId, ?string $fromCity = null): array
    {
        return [
            'kind' => $kind,
            'item_id' => $item['id'],
            'uuid' => $item['uuid'],
            'name' => $item['name'],
            'city' => $city,
            'from_city' => $fromCity,
            'mode' => $item['mode'] ?? null,
            'mode_label' => $item['kind'] ?? null,
            'date' => $date,
            'time' => $time,
            'currency' => (string) ($item['currency'] ?? 'USD'),
            'amount' => (string) Decimal::round2($priced['amount']),
            'adults' => $priced['adt'],
            'children' => $priced['chd'],
            'vehicle' => $priced['vehicle']['name'] ?? null,
            'units' => $priced['units'],
            'trip_leg_id' => $tripLegId,
            'blocked_reason' => $blocked,
        ];
    }

    private function legs(string $reservationId): Collection
    {
        return DB::table('booking_trip_legs as b')->join('catalog_accommodation_legs as l', 'l.id', '=', 'b.leg_id')
            ->where('b.reservation_id', $reservationId)->orderBy('b.sequence')
            ->get(['b.id', 'b.sequence', 'b.city', 'b.nights', 'b.check_in', 'b.check_out', 'b.leg_id', 'l.code as leg_code']);
    }

    private function items(string $reservationId): Collection
    {
        return DB::table('booking_trip_items as i')
            ->leftJoin('catalog_leg_tours as t', 't.id', '=', 'i.leg_tour_id')
            ->leftJoin('catalog_transport_options as o', 'o.id', '=', 'i.transport_option_id')
            ->leftJoin('catalog_transport_vehicles as v', 'v.id', '=', 'i.vehicle_id')
            ->leftJoin('booking_reservation_services as s', 's.id', '=', 'i.reservation_service_id')
            ->leftJoin('catalog_providers as p', 'p.id', '=', 's.provider_id')
            ->where('i.reservation_id', $reservationId)->orderBy('i.service_date')->orderByRaw('i.start_time nulls last')
            ->get(['i.*', 't.code as tour_code', 't.name as tour_name', 'o.code as option_code', 'o.name as option_name', 'o.mode', 'v.name as vehicle_name', 's.code as service_code', 's.status as service_status', 'p.name as provider_name']);
    }

    private function item(stdClass $item): array
    {
        return [
            'id' => $item->id,
            'kind' => $item->kind === 'tour' ? 'tour' : 'transport',
            'code' => $item->tour_code ?? $item->option_code,
            'name' => $item->tour_name ?? $item->option_name,
            'mode' => $item->mode,
            'service_date' => (string) $item->service_date,
            'start_time' => $item->start_time === null ? null : substr((string) $item->start_time, 0, 5),
            'adults' => (int) $item->adults,
            'children' => (int) $item->children,
            'vehicle' => $item->vehicle_name === null ? null : ['name' => $item->vehicle_name, 'units' => (int) $item->vehicle_units],
            'currency' => $item->currency,
            'amount' => (string) $item->amount,
            'sold_in_trip' => (bool) $item->sold_in_trip,
            'service' => $item->service_code === null ? null : ['code' => $item->service_code, 'status' => $item->service_status, 'provider' => $item->provider_name],
        ];
    }

    private function byCategory(stdClass $reservation, Collection $items): array
    {
        $lines = DB::table('booking_reservation_web_snapshots')->where('reservation_id', $reservation->id)->value('lines');
        $out = ['base' => BigDecimal::zero(), 'lodging' => BigDecimal::zero(), 'tour' => BigDecimal::zero(), 'transport' => BigDecimal::zero(), 'addon' => BigDecimal::zero(), 'surcharge' => BigDecimal::zero()];

        if ($lines !== null) {
            foreach ((array) json_decode((string) $lines, true) as $line) {
                $kind = ($line['kind'] ?? 'base') === 'option' ? 'base' : ($line['kind'] ?? 'base');
                if (! ($line['removed'] ?? false) && isset($out[$kind])) {
                    $out[$kind] = $out[$kind]->plus((string) $line['amount']);
                }
            }
            foreach ($items->where('sold_in_trip', true) as $item) {
                $out[$item->kind === 'tour' ? 'tour' : 'transport'] = $out[$item->kind === 'tour' ? 'tour' : 'transport']->plus((string) $item->amount);
            }
        } else {
            $services = DB::table('booking_reservation_services')->where('reservation_id', $reservation->id)->whereNotIn('status', ['cancelado'])->whereNull('replaced_by_id')->get(['id', 'service_kind', 'price_amount']);
            $tripServices = $items->pluck('reservation_service_id')->filter()->all();
            foreach ($services as $service) {
                if (in_array($service->id, $tripServices, true)) {
                    continue;
                }
                $kind = $service->service_kind === 'alojamiento' ? 'lodging' : 'base';
                $out[$kind] = $out[$kind]->plus((string) $service->price_amount);
            }
            foreach ($items as $item) {
                $kind = $item->kind === 'tour' ? 'tour' : 'transport';
                $out[$kind] = $out[$kind]->plus((string) $item->amount);
            }
        }

        $total = array_reduce($out, fn (BigDecimal $sum, BigDecimal $value): BigDecimal => $sum->plus($value), BigDecimal::zero());

        return ['currency' => $reservation->currency, 'total' => (string) Decimal::round2($total), 'categories' => array_map(fn (BigDecimal $value): string => (string) Decimal::round2($value), $out)];
    }
}
