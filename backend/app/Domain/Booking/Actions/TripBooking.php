<?php

declare(strict_types=1);

namespace App\Domain\Booking\Actions;

use App\Domain\Crm\Support\CodeSequence;
use App\Domain\Shared\Money\Decimal;
use App\Domain\Shared\Tenancy\TenantContext;
use Brick\Math\BigDecimal;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use stdClass;

final class TripBooking
{
    public const TRANSPORT_KIND = ['vuelo' => 'tren_entrada', 'bus' => 'tren_entrada', 'tren' => 'tren_entrada', 'traslado' => 'traslado', 'movilidad' => 'traslado'];

    public function __construct(
        private readonly TenantContext $context,
        private readonly CodeSequence $codes,
    ) {}

    public function persist(string $reservationId, string $productId, ?string $mainServiceId, array $quote, array $pax, string $rate, ?string $userId = null): BigDecimal
    {
        $catalogLegs = DB::table('catalog_accommodation_legs')->where('product_id', $productId)->get(['id', 'code'])->keyBy('code');
        $tripLegs = [];

        foreach (array_values((array) ($quote['legs'] ?? [])) as $index => $leg) {
            $catalog = $catalogLegs->get($leg['leg_id']);
            if ($catalog === null || $leg['check_in'] === null) {
                continue;
            }
            $id = (string) Str::uuid7();
            DB::table('booking_trip_legs')->insert([
                'id' => $id,
                'tenant_id' => $this->context->idOrFail(),
                'reservation_id' => $reservationId,
                'leg_id' => $catalog->id,
                'sequence' => $index + 1,
                'city' => $leg['city'],
                'nights' => (int) $leg['nights'],
                'check_in' => $leg['check_in'],
                'check_out' => $leg['check_out'],
            ]);
            $tripLegs[$leg['leg_id']] = $id;
        }

        $total = BigDecimal::zero();
        foreach ((array) ($quote['lines'] ?? []) as $line) {
            if (! in_array($line['kind'] ?? null, ['tour', 'transport'], true) || ($line['removed'] ?? false)) {
                continue;
            }
            $meta = (array) ($line['meta'] ?? []);
            $item = $line['kind'] === 'tour' ? $this->tour($catalogLegs->pluck('id')->all(), (string) ($meta['tour_id'] ?? '')) : $this->option($productId, (string) ($meta['transport_id'] ?? ''));
            if ($item === null || ($meta['date'] ?? null) === null) {
                continue;
            }
            $legCode = $line['kind'] === 'tour' ? ($meta['leg_id'] ?? null) : ($meta['to_leg_id'] ?? $meta['from_leg_id'] ?? null);
            $this->item($reservationId, $tripLegs[$legCode] ?? null, $line['kind'], $item, [
                'date' => (string) $meta['date'],
                'time' => $line['kind'] === 'tour' ? ($meta['time'] ?? null) : null,
                'adults' => (int) ($meta['adt'] ?? $pax['adt'] ?? 0),
                'children' => (int) ($meta['chd'] ?? $pax['chd'] ?? 0),
                'vehicle' => $meta['vehicle'] ?? null,
                'units' => $meta['units'] ?? null,
                'amount' => (string) $line['amount'],
                'currency' => (string) ($quote['currency'] ?? 'PEN'),
                'label' => (string) $line['label'],
            ], $rate, false, $userId);
            $total = $total->plus((string) $line['amount']);
        }

        if ($mainServiceId !== null && $total->isPositive()) {
            DB::table('booking_reservation_services')->where('id', $mainServiceId)->update(['price_amount' => DB::raw('greatest(price_amount - '.Decimal::round2($total).', 0)')]);
        }

        return $total;
    }

    public function item(string $reservationId, ?string $tripLegId, string $kind, stdClass $item, array $data, string $rate, bool $inTrip, ?string $userId = null): string
    {
        $serviceId = (string) Str::uuid7();
        $people = (int) $data['adults'] + (int) $data['children'];
        DB::table('booking_reservation_services')->insert([
            'id' => $serviceId,
            'tenant_id' => $this->context->idOrFail(),
            'reservation_id' => $reservationId,
            'code' => $this->codes->next('booking_reservation_services', 'RS-'),
            'provider_id' => $item->provider_id,
            'name' => Str::limit(($kind === 'tour' ? 'Tour ' : 'Movilidad ').$data['label'], 195),
            'service_date' => $data['date'],
            'service_time' => $data['time'],
            'pax' => max(1, $people),
            'pax_detail' => json_encode(['adt' => (int) $data['adults'], 'chd' => (int) $data['children'], 'inf' => 0]),
            'status' => 'solicitado',
            'currency' => $data['currency'],
            'fx_rate' => $rate,
            'cost_amount' => '0',
            'price_amount' => $data['amount'],
            'service_kind' => $kind === 'tour' ? 'tour' : (self::TRANSPORT_KIND[$item->mode] ?? 'traslado'),
            'requires_assignment' => $kind === 'transport' && in_array($item->mode, ['traslado', 'movilidad'], true),
            'requested_at' => now(),
        ]);

        $vehicleId = $kind === 'transport' && $data['vehicle'] !== null ? DB::table('catalog_transport_vehicles')->where('option_id', $item->id)->where('name', $data['vehicle'])->value('id') : null;
        $itemId = (string) Str::uuid7();
        DB::table('booking_trip_items')->insert([
            'id' => $itemId,
            'tenant_id' => $this->context->idOrFail(),
            'reservation_id' => $reservationId,
            'trip_leg_id' => $tripLegId,
            'kind' => $kind === 'tour' ? 'tour' : 'transporte',
            'leg_tour_id' => $kind === 'tour' ? $item->id : null,
            'transport_option_id' => $kind === 'tour' ? null : $item->id,
            'vehicle_id' => $vehicleId,
            'vehicle_units' => $vehicleId === null ? null : max(1, (int) ($data['units'] ?? 1)),
            'service_date' => $data['date'],
            'start_time' => $data['time'],
            'adults' => (int) $data['adults'],
            'children' => (int) $data['children'],
            'currency' => $data['currency'],
            'amount' => $data['amount'],
            'reservation_service_id' => $serviceId,
            'sold_in_trip' => $inTrip,
            'created_by' => $userId,
        ]);

        return $itemId;
    }

    private function tour(array $legIds, string $code): ?stdClass
    {
        return $code === '' ? null : DB::table('catalog_leg_tours')->whereIn('leg_id', $legIds)->where('code', $code)->first();
    }

    private function option(string $productId, string $code): ?stdClass
    {
        return $code === '' ? null : DB::table('catalog_transport_options')->where('product_id', $productId)->where('code', $code)->first();
    }
}
