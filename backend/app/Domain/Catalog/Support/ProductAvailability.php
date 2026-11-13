<?php

declare(strict_types=1);

namespace App\Domain\Catalog\Support;

use App\Domain\Booking\Inventory\DatabaseInventoryReader;
use App\Domain\Site\Support\SiteAvailability;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

final class ProductAvailability
{
    public const MAX_DAYS = 92;

    public function __construct(private readonly SiteAvailability $availability, private readonly DatabaseInventoryReader $inventory) {}

    public function days(string $productId, string $from, string $to, int $seats): array
    {
        $product = DB::table('catalog_products')->where('id', $productId)->whereNull('deleted_at')
            ->first(['id', 'code', 'name', 'slug', 'status', 'availability_model', 'availability_capacity', 'availability_source', 'booking_advance_min_days', 'booking_advance_max_days', 'operating_weekdays', 'minimum_passengers', 'maximum_passengers', 'cutoff_hours']);
        $today = Carbon::parse(CatalogAccess::today(), 'America/Lima');
        $this->availability->load([$productId], $from, $to);
        $ranges = DB::table('catalog_availability_ranges')->where('product_id', $productId)->whereNull('deleted_at')
            ->where('date_to', '>=', $from)->where('date_from', '<=', $to)->orderBy('date_from')->get(['code', 'date_from', 'date_to', 'status', 'capacity_per_day', 'note']);
        $held = DepartureDirectory::heldByDeparture($productId);
        $departures = $this->availability->departures($productId)->keyBy('departure_date');
        $days = [];

        for ($date = Carbon::parse($from); $date->toDateString() <= $to; $date = $date->addDay()) {
            $day = $date->toDateString();
            $status = $this->availability->day($product, $day, $seats, $today);
            $departure = $departures->get($day);
            $range = $ranges->first(fn (object $row) => $row->date_from <= $day && $row->date_to >= $day && $row->status !== 'disponible')
                ?? $ranges->first(fn (object $row) => $row->date_from <= $day && $row->date_to >= $day);

            $days[] = [
                'date' => $day,
                'status' => $status['status'],
                'label' => SiteAvailability::LABELS[$status['status']] ?? $status['status'],
                'note' => $status['note'],
                'left' => $status['spots'],
                'sellable' => $this->availability->sellable($status),
                'sold' => $departure !== null ? (int) $departure->sold : $this->inventory->soldOn($productId, $day),
                'held' => $departure !== null ? (int) ($held[$departure->id] ?? 0) : $this->inventory->heldOn($productId, $day),
                'departure' => $status['departure'],
                'range' => $range === null ? null : ['code' => $range->code, 'status' => $range->status, 'capacity_per_day' => (int) $range->capacity_per_day, 'note' => $range->note],
                'price' => $status['price'],
            ];
        }

        return [
            'product' => ['id' => $product->id, 'code' => $product->code, 'name' => $product->name, 'status' => $product->status],
            'model' => $product->availability_model,
            'capacity' => $product->availability_capacity === null ? null : (int) $product->availability_capacity,
            'source' => $product->availability_source,
            'from' => $from,
            'to' => $to,
            'seats' => $seats,
            'days' => $days,
            'next_available' => collect($days)->firstWhere('sellable', true)['date'] ?? null,
            'totals' => [
                'sold' => array_sum(array_column($days, 'sold')),
                'held' => array_sum(array_column($days, 'held')),
                'sellable_days' => count(array_filter($days, fn (array $day) => $day['sellable'])),
            ],
            'legend' => SiteAvailability::LABELS,
        ];
    }
}
