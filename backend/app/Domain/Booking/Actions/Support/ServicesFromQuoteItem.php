<?php

declare(strict_types=1);

namespace App\Domain\Booking\Actions\Support;

use App\Domain\Shared\Money\Decimal;
use Brick\Math\BigDecimal;
use Brick\Math\RoundingMode;
use Illuminate\Support\Facades\DB;

final class ServicesFromQuoteItem
{
    public function build(object $item, string $discountPct, string $currency, string $fxRate, ?string $departureId, ?string $mainProviderId): array
    {
        $qty = (int) $item->qty;
        $pax = (int) $item->pax;
        $costTotal = BigDecimal::of((string) $item->unit_cost)->multipliedBy($qty)->multipliedBy($pax);
        $saleTotal = BigDecimal::of((string) $item->unit_price)->multipliedBy($qty)->multipliedBy($pax)
            ->multipliedBy(BigDecimal::of(100)->minus($discountPct))->dividedBy(100, 6, RoundingMode::HALF_UP);

        $components = DB::table('catalog_product_items as i')
            ->join('catalog_services as s', 's.id', '=', 'i.service_id')
            ->where('i.product_id', $item->product_id)
            ->where('i.is_included', true)
            ->whereNotNull('i.service_id')
            ->orderBy('i.sort_order')
            ->get(['i.quantity', 'i.is_required', 'i.notes', 's.id as service_id', 's.name', 's.type', 's.unit', 's.cost', 's.currency', 's.provider_id']);

        $base = [
            'product_id' => $item->product_id,
            'quote_item_id' => $item->id,
            'departure_id' => $departureId,
            'service_date' => $item->service_date,
            'pax' => $pax,
            'status' => 'pendiente',
            'currency' => $currency,
            'fx_rate' => $fxRate,
        ];

        if ($components->isEmpty()) {
            $name = (string) DB::table('catalog_products')->where('id', $item->product_id)->value('name');

            return [[
                ...$base,
                'catalog_service_id' => null,
                'provider_id' => $mainProviderId,
                'name' => mb_substr("{$name} ({$pax} pax)", 0, 200),
                'service_time' => null,
                'cost_amount' => (string) Decimal::round2($costTotal),
                'price_amount' => (string) Decimal::round2($saleTotal),
                'is_required' => true,
                'service_kind' => 'libre',
                'requires_assignment' => false,
            ]];
        }

        $weights = $components->map(fn (object $component): BigDecimal => Decimal::convert((string) $component->cost, (string) $component->currency, $currency, $fxRate)
            ->multipliedBy($this->quantity($component))
            ->multipliedBy($component->unit === 'pax' ? $pax : 1))->all();
        $costs = Decimal::allocate($costTotal, $weights);
        $prices = Decimal::allocate($saleTotal, $weights);
        $firstTime = $this->firstItineraryTime((string) $item->product_id);
        $rows = [];

        foreach ($components->values() as $index => $component) {
            [$kind, $assign] = $this->kindFor((string) $component->type);
            $quantity = $this->quantity($component);
            $times = $quantity->isGreaterThan(1) ? ' ×'.$quantity->stripTrailingZeros() : '';

            $rows[] = [
                ...$base,
                'catalog_service_id' => $component->service_id,
                'provider_id' => $component->provider_id,
                'name' => mb_substr($component->name.$times, 0, 200),
                'service_time' => $this->timeFromNotes($component->notes) ?? ($index === 0 ? $firstTime : null),
                'cost_amount' => (string) $costs[$index],
                'price_amount' => (string) $prices[$index],
                'is_required' => (bool) $component->is_required,
                'service_kind' => $kind,
                'requires_assignment' => $assign,
            ];
        }

        return $rows;
    }

    private function quantity(object $component): BigDecimal
    {
        $quantity = BigDecimal::of((string) ($component->quantity ?: 1));

        return $quantity->isPositive() ? $quantity : BigDecimal::one();
    }

    private function timeFromNotes(?string $notes): ?string
    {
        return $notes !== null && preg_match('/\b([01]\d|2[0-3]):([0-5]\d)\b/', $notes, $match) === 1 ? $match[0] : null;
    }

    private function firstItineraryTime(string $productId): ?string
    {
        $time = DB::table('catalog_itineraries as it')
            ->join('catalog_itinerary_days as d', 'd.itinerary_id', '=', 'it.id')
            ->join('catalog_itinerary_items as x', 'x.day_id', '=', 'd.id')
            ->where('it.product_id', $productId)
            ->where('it.is_default', true)
            ->where('d.day_number', 1)
            ->whereNotNull('x.start_time')
            ->orderBy('x.start_time')
            ->value('x.start_time');

        return $time === null ? null : substr((string) $time, 0, 5);
    }

    private function kindFor(string $type): array
    {
        return match ($type) {
            'Traslado', 'Transporte' => ['traslado', true],
            'Guía', 'Tour', 'Actividad' => ['tour', true],
            'Tren', 'Entrada' => ['tren_entrada', false],
            'Alojamiento' => ['alojamiento', false],
            default => ['libre', false],
        };
    }
}
