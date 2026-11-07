<?php

declare(strict_types=1);

namespace App\Domain\Catalog\Support;

use App\Domain\Iam\Models\User;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

final class ProductDirectory
{
    public function list(): Collection
    {
        $from = DB::table('catalog_rates')->where('status', 'vigente')->where('rate_type', 'Venta')->whereIn('segment', ['Adulto', 'Pasajero'])
            ->orderBy('price')->get(['product_id', 'price', 'currency'])->groupBy('product_id');

        return $this->rows()->orderBy('p.name')->get()->map(fn (object $row) => [
            ...$this->summary($row),
            'price_from' => isset($from[$row->id]) ? ['amount' => $from[$row->id]->first()->price, 'currency' => $from[$row->id]->first()->currency] : null,
        ]);
    }

    public function find(string $code, User $viewer): ?array
    {
        $row = $this->rows()->where('p.code', $code)->first();

        if ($row === null) {
            return null;
        }

        $showCost = $viewer->can('catalog.products.view_profitability');
        $itinerary = DB::table('catalog_itineraries')->where('product_id', $row->id)->where('is_default', true)->value('id');
        $days = $itinerary ? DB::table('catalog_itinerary_days')->where('itinerary_id', $itinerary)->orderBy('day_number')->get(['id', 'day_number', 'title']) : collect();
        $items = DB::table('catalog_itinerary_items')->whereIn('day_id', $days->pluck('id'))->orderBy('start_time')->get(['day_id', 'start_time', 'activity', 'item_type', 'location'])->groupBy('day_id');
        $texts = DB::table('catalog_product_inclusions')->where('product_id', $row->id)->orderBy('sort_order')->get(['kind', 'text']);
        $policy = DB::table('catalog_product_policies')->where('product_id', $row->id)->first(['cancellation', 'modification', 'no_show', 'refund', 'penalties', 'advance_min', 'advance_max']);

        return [
            ...$this->summary($row),
            'internal_name' => $row->internal_name,
            'lock_version' => (int) $row->lock_version,
            'ids' => [
                'type' => $row->product_type_id,
                'category' => $row->category_id,
                'subcategory' => $row->subcategory_id,
                'destination' => $row->primary_destination_id,
                'provider' => $row->main_provider_id,
            ],
            'raw' => [
                'is_b2b' => (bool) $row->is_b2b,
                'is_ecommerce' => (bool) $row->is_ecommerce,
                'availability_model' => $row->availability_model,
                'markup_pct' => $showCost ? (float) $row->markup_pct : null,
            ],
            'sku' => $row->sku,
            'short_description' => $row->short_description,
            'long_description' => $row->long_description,
            'pax' => ['min' => (int) $row->minimum_passengers, 'max' => (int) $row->maximum_passengers],
            'age' => ['min' => (int) $row->minimum_age, 'max' => (int) $row->maximum_age],
            'advance_days' => ['min' => (int) $row->booking_advance_min_days, 'max' => (int) $row->booking_advance_max_days],
            'markup_pct' => $showCost ? $row->markup_pct : null,
            'provider' => $row->provider_name ? ['name' => $row->provider_name, 'type' => $row->provider_type, 'phone' => $row->provider_phone] : null,
            'itinerary' => $days->map(fn (object $day) => [
                'day' => (int) $day->day_number,
                'title' => $day->title,
                'items' => ($items[$day->id] ?? collect())->map(fn (object $item) => [
                    'time' => $item->start_time ? substr($item->start_time, 0, 5) : null,
                    'activity' => $item->activity,
                    'type' => $item->item_type,
                    'location' => $item->location,
                ])->values(),
            ])->values(),
            'includes' => $texts->where('kind', 'include')->pluck('text')->values(),
            'excludes' => $texts->where('kind', 'exclude')->pluck('text')->values(),
            'requirements' => DB::table('catalog_product_requirements')->where('product_id', $row->id)->pluck('text'),
            'policies' => $policy,
            'rates' => DB::table('catalog_rates')->where('product_id', $row->id)->orderBy('status', 'desc')->orderBy('rate_type')->orderBy('segment')
                ->get(['ref', 'rate_type', 'segment', 'channel', 'currency', 'price_basis', 'cost', 'price', 'valid_from', 'valid_to', 'status'])
                ->map(fn (object $rate) => [
                    'ref' => $rate->ref,
                    'type' => $rate->rate_type,
                    'segment' => $rate->segment,
                    'channel' => $rate->channel,
                    'currency' => $rate->currency,
                    'basis' => $rate->price_basis,
                    'price' => $rate->price,
                    'cost' => $showCost ? $rate->cost : null,
                    'margin_pct' => $showCost && (float) $rate->price > 0 ? round(((float) $rate->price - (float) $rate->cost) / (float) $rate->price * 100, 1) : null,
                    'valid_from' => $rate->valid_from,
                    'valid_to' => $rate->valid_to,
                    'active' => $rate->status === 'vigente',
                ]),
        ];
    }

    private function rows(): Builder
    {
        return DB::table('catalog_products as p')
            ->join('catalog_product_types as t', 't.id', '=', 'p.product_type_id')
            ->join('catalog_product_categories as c', 'c.id', '=', 'p.category_id')
            ->leftJoin('catalog_product_subcategories as s', 's.id', '=', 'p.subcategory_id')
            ->join('catalog_destinations as d', 'd.id', '=', 'p.primary_destination_id')
            ->leftJoin('catalog_providers as pr', 'pr.id', '=', 'p.main_provider_id')
            ->whereNull('p.deleted_at')
            ->select(['p.*', 't.name as type_name', 'c.name as category_name', 's.name as subcategory_name', 'd.name as destination_name', 'd.path as destination_path', 'pr.name as provider_name', 'pr.type as provider_type', 'pr.phone as provider_phone']);
    }

    private function summary(object $row): array
    {
        return [
            'code' => $row->code,
            'name' => $row->name,
            'lock_version' => (int) $row->lock_version,
            'type' => $row->type_name,
            'category' => $row->category_name,
            'subcategory' => $row->subcategory_name,
            'destination' => $row->destination_name,
            'destination_path' => $row->destination_path,
            'duration' => ['value' => (float) $row->duration_value, 'unit' => $row->duration_unit],
            'modality' => $row->modality,
            'status' => $row->status,
            'channels' => array_keys(array_filter([
                'Venta directa' => true,
                'Agencias B2B' => (bool) $row->is_b2b,
                'Tienda en línea' => (bool) $row->is_ecommerce,
            ])),
            'featured' => (bool) $row->is_featured,
        ];
    }
}
