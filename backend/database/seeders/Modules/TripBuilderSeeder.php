<?php

declare(strict_types=1);

namespace Database\Seeders\Modules;

use App\Domain\Platform\Models\Tenant;
use Database\Support\KitSeeds;
use Database\Support\SeedsTenant;
use Illuminate\Support\Facades\DB;

final class TripBuilderSeeder
{
    use SeedsTenant;

    public const ORDER = 60;

    private const MODES = ['Vuelo' => 'vuelo', 'Bus' => 'bus', 'Tren' => 'tren', 'Privado' => 'traslado', 'Traslado' => 'traslado', 'Movilidad local' => 'movilidad'];

    public function __construct(private readonly Tenant $tenant) {}

    protected function tenant(): Tenant
    {
        return $this->tenant;
    }

    public function run(): void
    {
        foreach (KitSeeds::read('products') as $seed) {
            if (! isset($seed['trip']) || ! isset($seed['accommodation']['legs'])) {
                continue;
            }
            $productId = DB::table('catalog_products')->where('tenant_id', $this->tenant->getKey())->where('ref', $seed['id'])->value('id');
            if ($productId === null) {
                continue;
            }
            $this->seedProduct((string) $productId, $seed);
        }

        foreach (KitSeeds::read('reservations') as $seed) {
            if (! empty($seed['booking']['tripLegs'])) {
                $this->seedReservation($seed);
            }
        }
    }

    private function seedProduct(string $productId, array $seed): void
    {
        $legs = DB::table('catalog_accommodation_legs')->where('product_id', $productId)->pluck('id', 'code');
        $providers = DB::table('catalog_providers')->where('tenant_id', $this->tenant->getKey())->pluck('id', 'ref');
        $currency = (string) ($seed['trip']['currency'] ?? 'USD');

        foreach ($seed['accommodation']['legs'] as $leg) {
            $legId = $legs[$leg['id']] ?? null;
            if ($legId === null) {
                continue;
            }
            if (isset($leg['minNights'], $leg['maxNights'])) {
                DB::table('catalog_accommodation_legs')->where('id', $legId)->update(['min_nights' => (int) $leg['minNights'], 'max_nights' => (int) $leg['maxNights']]);
            }
            foreach ($leg['hotels'] ?? [] as $hotel) {
                $hotelId = DB::table('catalog_accommodation_hotels')->where('leg_id', $legId)->where('code', $hotel['id'])->value('id');
                if ($hotelId === null) {
                    continue;
                }
                foreach ($hotel['seasonRates'] ?? [] as $rate) {
                    $this->upsert('catalog_hotel_season_rates', ['hotel_id' => $hotelId, 'date_from' => $this->day($rate['from'])], [
                        'label' => $rate['label'],
                        'date_to' => $this->day($rate['to']),
                        'adjust_pct' => $rate['pct'],
                    ]);
                }
            }
        }

        foreach ($seed['trip']['tours'] ?? [] as $tour) {
            $legId = $legs[$tour['legId']] ?? null;
            if ($legId === null) {
                continue;
            }
            $this->upsert('catalog_leg_tours', ['leg_id' => $legId, 'code' => $tour['id']], [
                'name' => $tour['name'],
                'day_offset' => (int) ($tour['dayOffset'] ?? 0),
                'start_time' => $tour['time'],
                'duration_hours' => $tour['hours'],
                'currency' => $currency,
                'price_adult' => $tour['priceAdt'],
                'price_child' => $tour['priceChd'] ?? 0,
                'min_age' => $tour['minAge'] ?? null,
                'capacity' => $tour['capacity'] ?? null,
                'provider_id' => isset($tour['providerId']) ? ($providers[$tour['providerId']] ?? null) : null,
                'in_trip_sale' => (bool) ($tour['inTrip'] ?? true),
                'active' => true,
            ]);
        }

        foreach ($seed['trip']['transport'] ?? [] as $option) {
            $from = $legs[$option['fromLegId']] ?? null;
            if ($from === null) {
                continue;
            }
            $vehicle = ($option['pricing'] ?? 'pax') === 'vehiculo';
            $optionId = $this->upsert('catalog_transport_options', ['product_id' => $productId, 'code' => $option['id']], [
                'from_leg_id' => $from,
                'to_leg_id' => isset($option['toLegId']) ? ($legs[$option['toLegId']] ?? null) : null,
                'mode' => self::MODES[$option['kind']] ?? 'traslado',
                'name' => $option['name'],
                'pricing' => $vehicle ? 'vehiculo' : 'pax',
                'currency' => $currency,
                'price_adult' => $vehicle ? null : $option['priceAdt'],
                'price_child' => $vehicle ? null : ($option['priceChd'] ?? null),
                'duration_hours' => $option['hours'] ?? null,
                'provider_id' => isset($option['providerId']) ? ($providers[$option['providerId']] ?? null) : null,
                'in_trip_sale' => (bool) ($option['inTrip'] ?? true),
                'active' => true,
            ]);
            foreach ($option['vehicles'] ?? [] as $row) {
                $this->upsert('catalog_transport_vehicles', ['option_id' => $optionId, 'name' => $row['name']], ['max_pax' => (int) $row['maxPax'], 'price' => $row['price']]);
            }
        }
    }

    private function seedReservation(array $seed): void
    {
        $reservationId = DB::table('booking_reservations')->where('tenant_id', $this->tenant->getKey())->where('code', $seed['id'])->value('id');
        $productRef = $seed['booking']['productId'] ?? null;
        $productId = $productRef === null ? null : DB::table('catalog_products')->where('tenant_id', $this->tenant->getKey())->where('ref', $productRef)->value('id');
        if ($reservationId === null || $productId === null) {
            return;
        }
        $legs = DB::table('catalog_accommodation_legs')->where('product_id', $productId)->pluck('id', 'code');
        $tripLegs = [];

        foreach (array_values($seed['booking']['tripLegs']) as $index => $leg) {
            if (! isset($legs[$leg['legId']])) {
                continue;
            }
            $tripLegs[$leg['legId']] = $this->upsert('booking_trip_legs', ['reservation_id' => $reservationId, 'sequence' => $index + 1], [
                'leg_id' => $legs[$leg['legId']],
                'city' => $leg['city'],
                'nights' => (int) $leg['nights'],
                'check_in' => $this->day($leg['checkIn']),
                'check_out' => $this->day($leg['checkOut']),
            ]);
        }

        $adults = (int) ($seed['booking']['pax']['adt'] ?? 1);
        $children = (int) ($seed['booking']['pax']['chd'] ?? 0);
        foreach ($seed['services'] ?? [] as $service) {
            $serviceId = DB::table('booking_reservation_services')->where('tenant_id', $this->tenant->getKey())->where('code', $service['id'])->value('id');
            if ($serviceId === null || (! isset($service['tourId']) && ! isset($service['transportId']))) {
                continue;
            }
            $tour = isset($service['tourId']) ? DB::table('catalog_leg_tours')->whereIn('leg_id', $legs->values()->all())->where('code', $service['tourId'])->first(['id', 'leg_id']) : null;
            $option = isset($service['transportId']) ? DB::table('catalog_transport_options')->where('product_id', $productId)->where('code', $service['transportId'])->first(['id', 'to_leg_id', 'from_leg_id']) : null;
            if ($tour === null && $option === null) {
                continue;
            }
            $legCode = $legs->search($tour->leg_id ?? $option->to_leg_id ?? $option->from_leg_id);
            $this->upsert('booking_trip_items', ['reservation_service_id' => $serviceId], [
                'reservation_id' => $reservationId,
                'trip_leg_id' => $legCode === false ? null : ($tripLegs[$legCode] ?? null),
                'kind' => $tour !== null ? 'tour' : 'transporte',
                'leg_tour_id' => $tour?->id,
                'transport_option_id' => $tour === null ? $option->id : null,
                'service_date' => $this->day($service['date']),
                'start_time' => preg_match('/^\d{1,2}:\d{2}$/', (string) ($service['time'] ?? '')) ? $service['time'] : null,
                'adults' => $adults,
                'children' => $children,
                'currency' => $seed['currency'],
                'amount' => $service['price'] ?? 0,
                'sold_in_trip' => (bool) ($service['soldInTrip'] ?? false),
            ]);
        }
    }
}
