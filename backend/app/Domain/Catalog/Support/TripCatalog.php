<?php

declare(strict_types=1);

namespace App\Domain\Catalog\Support;

use App\Domain\Booking\Rules\RuleResolver;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use stdClass;

final class TripCatalog
{
    public const MODES = ['vuelo' => 'Vuelo', 'bus' => 'Bus', 'tren' => 'Tren', 'traslado' => 'Traslado', 'movilidad' => 'Movilidad local'];

    public const PRICING = ['pax' => 'Por pasajero', 'vehiculo' => 'Por vehículo'];

    public function __construct(
        private readonly ProductBookingConfig $config,
        private readonly RuleResolver $rules,
    ) {}

    public static function seasonRatesFor(array $hotelIds): array
    {
        if ($hotelIds === []) {
            return [];
        }

        return DB::table('catalog_hotel_season_rates')->whereIn('hotel_id', $hotelIds)->orderBy('date_from')->get(['hotel_id', 'label', 'date_from', 'date_to', 'adjust_pct'])
            ->groupBy('hotel_id')
            ->map(fn (Collection $rows): array => $rows->map(fn (stdClass $row): array => ['from' => (string) $row->date_from, 'to' => (string) $row->date_to, 'pct' => (string) $row->adjust_pct, 'label' => $row->label])->values()->all())
            ->all();
    }

    public static function engineTrip(string $productId, array $legs): array
    {
        $codes = collect($legs)->pluck('code', 'id');
        $tours = DB::table('catalog_leg_tours')->whereIn('leg_id', $codes->keys()->all())->where('active', true)->orderBy('day_offset')->orderBy('start_time')->get();
        $options = DB::table('catalog_transport_options')->where('product_id', $productId)->where('active', true)->orderBy('code')->get();
        if ($tours->isEmpty() && $options->isEmpty()) {
            return [];
        }
        $vehicles = DB::table('catalog_transport_vehicles')->whereIn('option_id', $options->pluck('id')->all())->orderBy('max_pax')->get()->groupBy('option_id');

        return [
            'currency' => (string) ($tours->first()->currency ?? $options->first()->currency ?? 'USD'),
            'tours' => $tours->map(fn (stdClass $tour): array => [
                'id' => $tour->code,
                'uuid' => $tour->id,
                'legId' => $codes[$tour->leg_id],
                'name' => $tour->name,
                'dayOffset' => (int) $tour->day_offset,
                'time' => substr((string) $tour->start_time, 0, 5),
                'hours' => (string) $tour->duration_hours,
                'currency' => $tour->currency,
                'priceAdt' => (string) $tour->price_adult,
                'priceChd' => (string) $tour->price_child,
                'minAge' => $tour->min_age === null ? null : (int) $tour->min_age,
                'capacity' => $tour->capacity === null ? null : (int) $tour->capacity,
                'providerId' => $tour->provider_id,
                'inTrip' => (bool) $tour->in_trip_sale,
            ])->values()->all(),
            'transport' => $options->map(fn (stdClass $option): array => [
                'id' => $option->code,
                'uuid' => $option->id,
                'fromLegId' => $codes[$option->from_leg_id],
                'toLegId' => $option->to_leg_id === null ? null : $codes[$option->to_leg_id],
                'mode' => $option->mode,
                'kind' => self::MODES[$option->mode] ?? $option->mode,
                'name' => $option->name,
                'pricing' => $option->pricing,
                'currency' => $option->currency,
                'priceAdt' => $option->price_adult === null ? null : (string) $option->price_adult,
                'priceChd' => $option->price_child === null ? null : (string) $option->price_child,
                'hours' => $option->duration_hours === null ? null : (string) $option->duration_hours,
                'providerId' => $option->provider_id,
                'inTrip' => (bool) $option->in_trip_sale,
                'vehicles' => collect($vehicles->get($option->id, []))->map(fn (stdClass $vehicle): array => ['id' => $vehicle->id, 'name' => $vehicle->name, 'maxPax' => (int) $vehicle->max_pax, 'price' => (string) $vehicle->price])->values()->all(),
            ])->values()->all(),
        ];
    }

    public function show(string $product, User $viewer): array
    {
        $row = $this->config->product($product);
        $data = $this->config->engineProduct($row->id);
        $set = $this->rules->forTenant();
        $legs = $this->config->legs($row->id);
        $seasons = DB::table('catalog_hotel_season_rates')->whereIn('hotel_id', collect($legs)->pluck('hotels')->flatten(1)->pluck('id')->all())->orderBy('date_from')->get()->groupBy('hotel_id');
        $tours = $this->tours($row->id)->groupBy('leg_id');
        $transport = $this->transport($row->id);
        $cities = collect($legs)->pluck('city', 'id');

        return [
            'product' => ['id' => $row->id, 'code' => $row->code, 'name' => $row->name, 'status' => $row->status, 'lock_version' => (int) $row->lock_version],
            'rules' => [
                'trip_builder' => ['on' => $set->on('R-TRIP-BUILDER', $data), 'tenant_on' => $set->on('R-TRIP-BUILDER'), 'plan_allows' => $set->planAllows('R-TRIP-BUILDER')],
                'in_trip_sales' => ['on' => $set->on('R-IN-TRIP-SALES', $data), 'min_hours_before' => (int) ($set->param('R-IN-TRIP-SALES', 'minHoursBefore', $data) ?? 12)],
            ],
            'accommodation_enabled' => (bool) DB::table('catalog_products')->where('id', $row->id)->value('accommodation_enabled'),
            'legs' => array_map(fn (array $leg): array => [
                'id' => $leg['id'],
                'code' => $leg['code'],
                'sequence' => $leg['sequence'],
                'city' => $leg['city'],
                'nights' => $leg['nights'],
                'min_nights' => $leg['min_nights'],
                'max_nights' => $leg['max_nights'],
                'hotels' => array_map(fn (array $hotel): array => [
                    'id' => $hotel['id'],
                    'code' => $hotel['code'],
                    'name' => $hotel['name'],
                    'category' => $hotel['category'],
                    'season_rates' => collect($seasons->get($hotel['id'], []))->map(fn (stdClass $rate): array => self::seasonRate($rate))->values()->all(),
                ], $leg['hotels']),
                'tours' => collect($tours->get($leg['id'], []))->map(fn (stdClass $tour): array => self::tour($tour, $leg['city']))->values()->all(),
            ], $legs),
            'transport' => $transport->map(fn (stdClass $option): array => self::option($option, $cities->all()))->values()->all(),
            'summary' => [
                'legs' => count($legs),
                'flexible_legs' => collect($legs)->whereNotNull('min_nights')->count(),
                'season_rates' => $seasons->flatten(1)->count(),
                'tours' => $tours->flatten(1)->count(),
                'tours_in_trip' => $tours->flatten(1)->where('in_trip_sale', true)->where('active', true)->count(),
                'transport' => $transport->count(),
            ],
            'options' => [
                'modes' => collect(self::MODES)->map(fn (string $label, string $value): array => ['value' => $value, 'label' => $label])->values()->all(),
                'pricing' => collect(self::PRICING)->map(fn (string $label, string $value): array => ['value' => $value, 'label' => $label])->values()->all(),
                'providers' => DB::table('catalog_providers')->whereNull('deleted_at')->where('status', 'activo')->orderBy('name')->get(['id', 'name', 'type'])->map(fn (stdClass $p): array => ['id' => $p->id, 'name' => $p->name, 'type' => $p->type])->all(),
            ],
            'can' => ['update' => $viewer->can('catalog.products.update')],
        ];
    }

    public function hotel(string $hotelId): stdClass
    {
        if (! Str::isUuid($hotelId)) {
            throw ApiException::notFound('El hotel no existe.');
        }

        return DB::table('catalog_accommodation_hotels as h')->join('catalog_accommodation_legs as l', 'l.id', '=', 'h.leg_id')->join('catalog_products as p', 'p.id', '=', 'l.product_id')
            ->where('h.id', $hotelId)->whereNull('p.deleted_at')
            ->first(['h.id', 'h.code', 'h.name', 'l.city', 'p.id as product_id', 'p.code as product_code'])
            ?? throw ApiException::notFound('El hotel no existe.');
    }

    public function seasonRates(string $hotelId): array
    {
        $hotel = $this->hotel($hotelId);

        return DB::table('catalog_hotel_season_rates')->where('hotel_id', $hotel->id)->orderBy('date_from')->get()->map(fn (stdClass $rate): array => self::seasonRate($rate))->all();
    }

    public function tours(string $productId): Collection
    {
        return DB::table('catalog_leg_tours as t')->join('catalog_accommodation_legs as l', 'l.id', '=', 't.leg_id')
            ->leftJoin('catalog_providers as pr', 'pr.id', '=', 't.provider_id')
            ->where('l.product_id', $productId)->orderBy('l.sequence')->orderBy('t.day_offset')->orderBy('t.start_time')
            ->get(['t.*', 'pr.name as provider_name']);
    }

    public function transport(string $productId): Collection
    {
        $options = DB::table('catalog_transport_options as o')->leftJoin('catalog_providers as pr', 'pr.id', '=', 'o.provider_id')
            ->where('o.product_id', $productId)->orderBy('o.code')->get(['o.*', 'pr.name as provider_name']);
        $vehicles = DB::table('catalog_transport_vehicles')->whereIn('option_id', $options->pluck('id')->all())->orderBy('max_pax')->get()->groupBy('option_id');

        return $options->map(function (stdClass $option) use ($vehicles): stdClass {
            $option->vehicles = collect($vehicles->get($option->id, []))->values()->all();

            return $option;
        });
    }

    public static function seasonRate(stdClass $rate): array
    {
        return ['id' => $rate->id, 'hotel_id' => $rate->hotel_id, 'label' => $rate->label, 'date_from' => (string) $rate->date_from, 'date_to' => (string) $rate->date_to, 'adjust_pct' => (string) $rate->adjust_pct];
    }

    public static function tour(stdClass $tour, ?string $city = null): array
    {
        return [
            'id' => $tour->id,
            'code' => $tour->code,
            'leg_id' => $tour->leg_id,
            'city' => $city,
            'name' => $tour->name,
            'day_offset' => (int) $tour->day_offset,
            'start_time' => substr((string) $tour->start_time, 0, 5),
            'duration_hours' => (string) $tour->duration_hours,
            'currency' => $tour->currency,
            'price_adult' => (string) $tour->price_adult,
            'price_child' => (string) $tour->price_child,
            'min_age' => $tour->min_age === null ? null : (int) $tour->min_age,
            'capacity' => $tour->capacity === null ? null : (int) $tour->capacity,
            'provider' => $tour->provider_id === null ? null : ['id' => $tour->provider_id, 'name' => $tour->provider_name ?? null],
            'in_trip_sale' => (bool) $tour->in_trip_sale,
            'active' => (bool) $tour->active,
        ];
    }

    public static function option(stdClass $option, array $cities = []): array
    {
        return [
            'id' => $option->id,
            'code' => $option->code,
            'from_leg_id' => $option->from_leg_id,
            'to_leg_id' => $option->to_leg_id,
            'from_city' => $cities[$option->from_leg_id] ?? null,
            'to_city' => $option->to_leg_id === null ? null : ($cities[$option->to_leg_id] ?? null),
            'scope' => $option->to_leg_id === null ? 'local' : 'entre_ciudades',
            'mode' => $option->mode,
            'mode_label' => self::MODES[$option->mode] ?? $option->mode,
            'name' => $option->name,
            'pricing' => $option->pricing,
            'currency' => $option->currency,
            'price_adult' => $option->price_adult === null ? null : (string) $option->price_adult,
            'price_child' => $option->price_child === null ? null : (string) $option->price_child,
            'duration_hours' => $option->duration_hours === null ? null : (string) $option->duration_hours,
            'provider' => $option->provider_id === null ? null : ['id' => $option->provider_id, 'name' => $option->provider_name ?? null],
            'in_trip_sale' => (bool) $option->in_trip_sale,
            'active' => (bool) $option->active,
            'vehicles' => array_map(fn (stdClass $vehicle): array => ['id' => $vehicle->id, 'name' => $vehicle->name, 'max_pax' => (int) $vehicle->max_pax, 'price' => (string) $vehicle->price], $option->vehicles ?? []),
        ];
    }
}
