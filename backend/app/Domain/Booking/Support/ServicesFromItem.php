<?php

declare(strict_types=1);

namespace App\Domain\Booking\Support;

use Brick\Math\BigDecimal;
use Brick\Math\RoundingMode;
use Illuminate\Support\Facades\DB;

final class ServicesFromItem
{
    public function build(object $item, object $version, ?string $departureId, ?string $mainProvider): array
    {
        $pax = (int) $item->pax;
        $qty = (int) $item->qty;
        $costTotal = BigDecimal::of((string) $item->unit_cost)->multipliedBy($qty)->multipliedBy($pax);
        $saleTotal = BigDecimal::of((string) $item->unit_price)->multipliedBy($qty)->multipliedBy($pax)->multipliedBy(BigDecimal::of(100)->minus((string) $version->discount_pct))->dividedBy(100, 6, RoundingMode::HALF_UP);
        $base = ['product_id' => $item->product_id, 'quote_item_id' => $item->id, 'departure_id' => $departureId, 'service_date' => $item->service_date, 'pax' => $pax, 'status' => 'pendiente', 'currency' => $version->currency, 'fx_rate' => $version->fx_rate];

        $components = DB::table('catalog_product_items as i')
            ->join('catalog_services as s', 's.id', '=', 'i.service_id')
            ->where('i.product_id', $item->product_id)
            ->where('i.is_included', true)
            ->orderBy('i.sort_order')
            ->get(['i.quantity', 'i.is_required', 'i.notes', 's.id as service_id', 's.name', 's.type', 's.unit', 's.cost', 's.currency', 's.provider_id']);

        if ($components->isEmpty()) {
            $name = DB::table('catalog_products')->where('id', $item->product_id)->value('name');

            return [[...$base, 'catalog_service_id' => null, 'provider_id' => $mainProvider, 'name' => mb_substr("{$name} ({$pax} pax)", 0, 200), 'service_time' => null, 'cost_amount' => (string) $costTotal->toScale(2, RoundingMode::HALF_UP), 'price_amount' => (string) $saleTotal->toScale(2, RoundingMode::HALF_UP), 'is_required' => true, 'service_kind' => 'libre', 'requires_assignment' => false]];
        }

        $weights = $components->map(fn (object $component): BigDecimal => $this->convertMoney((string) $component->cost, (string) $component->currency, (string) $version->currency, (string) $version->fx_rate)
            ->multipliedBy((string) ((float) $component->quantity > 0 ? $component->quantity : 1))
            ->multipliedBy($component->unit === 'pax' ? $pax : 1))->all();
        $costs = $this->allocate($costTotal, $weights);
        $prices = $this->allocate($saleTotal, $weights);
        $firstTime = $this->firstItineraryTime((string) $item->product_id);
        $rows = [];

        foreach ($components->values() as $index => $component) {
            [$kind, $assign] = $this->kindFor((string) $component->type);
            $times = (float) $component->quantity > 1 ? ' ×'.rtrim(rtrim((string) $component->quantity, '0'), '.') : '';
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

    private function allocate(BigDecimal $total, array $weights): array
    {
        $sum = array_reduce($weights, fn (BigDecimal $carry, BigDecimal $weight): BigDecimal => $carry->plus($weight), BigDecimal::zero());
        $target = $total->toScale(2, RoundingMode::HALF_UP);
        $parts = [];
        $assigned = BigDecimal::zero();
        $last = count($weights) - 1;

        foreach ($weights as $index => $weight) {
            $part = $index === $last
                ? $target->minus($assigned)
                : ($sum->isZero() ? BigDecimal::zero()->toScale(2) : $target->multipliedBy($weight)->dividedBy($sum, 2, RoundingMode::HALF_UP));
            $assigned = $assigned->plus($part);
            $parts[] = $part;
        }

        return $parts;
    }

    private function convertMoney(string $amount, string $from, string $to, string $fx): BigDecimal
    {
        $value = BigDecimal::of($amount);

        if ($from === $to) {
            return $value;
        }

        return $from === 'USD' ? $value->multipliedBy($fx) : $value->dividedBy($fx, 6, RoundingMode::HALF_UP);
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
