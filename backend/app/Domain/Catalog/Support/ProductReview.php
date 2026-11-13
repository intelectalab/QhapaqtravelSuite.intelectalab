<?php

declare(strict_types=1);

namespace App\Domain\Catalog\Support;

use App\Domain\Iam\Models\User;
use Brick\Math\BigDecimal;
use Brick\Math\RoundingMode;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

final class ProductReview
{
    public function __construct(private readonly ProductChecklist $checklist) {}

    public function build(object $product, User $viewer, bool $assumeApproved = true): array
    {
        $components = $this->components($product->id);
        $checklist = $this->checklist->evaluate((object) [...(array) $product, 'status' => $assumeApproved && ! in_array($product->status, ProductChecklist::ACTIVATABLE, true) ? 'APPROVED' : $product->status]);
        $passed = count(array_filter($checklist, fn (array $item) => $item['ok']));
        $itinerary = DB::table('catalog_itineraries')->where('product_id', $product->id)->where('is_default', true)->value('id');
        $seasons = DB::table('catalog_product_seasons')->where('product_id', $product->id)->pluck('season_id')
            ->merge(DB::table('catalog_rates')->where('product_id', $product->id)->whereNotNull('season_id')->pluck('season_id'))->unique();
        $names = DB::table('catalog_products as p')
            ->join('catalog_product_types as t', 't.id', '=', 'p.product_type_id')
            ->join('catalog_product_categories as c', 'c.id', '=', 'p.category_id')
            ->leftJoin('catalog_product_subcategories as s', 's.id', '=', 'p.subcategory_id')
            ->join('catalog_destinations as d', 'd.id', '=', 'p.primary_destination_id')
            ->leftJoin('catalog_providers as pv', 'pv.id', '=', 'p.main_provider_id')
            ->where('p.id', $product->id)
            ->first(['t.name as type', 'c.name as category', 's.name as subcategory', 'd.path as destination', 'pv.name as provider']);

        return [
            'summary' => [
                'name' => $product->name,
                'code' => $product->code,
                'sku' => $product->sku,
                'type' => $names?->type,
                'category' => $names?->category,
                'subcategory' => $names?->subcategory,
                'destination' => $names?->destination,
                'provider' => $names?->provider,
                'components' => $components->count(),
                'components_cost' => CatalogAccess::seesCost($viewer) ? (string) $components->reduce(fn (BigDecimal $sum, array $item) => $sum->plus($item['subtotal_pen']), BigDecimal::zero())->toScale(2, RoundingMode::HALF_UP) : null,
                'cost_breakdown' => CatalogAccess::seesCost($viewer) ? $this->breakdown($product->id, $components) : null,
                'itinerary_days' => $itinerary ? DB::table('catalog_itinerary_days')->where('itinerary_id', $itinerary)->count() : 0,
                'rates' => DB::table('catalog_rates')->where('product_id', $product->id)->count(),
                'seasons' => $seasons->count(),
                'availability' => $product->availability_model,
                'status' => $product->status,
            ],
            'checklist' => [
                'items' => $checklist,
                'passed' => $passed,
                'total' => count($checklist),
            ],
        ];
    }

    public function components(string $productId): Collection
    {
        $fx = $this->fx();
        $services = DB::table('catalog_product_items as i')->join('catalog_services as s', 's.id', '=', 'i.service_id')->join('catalog_providers as pv', 'pv.id', '=', 's.provider_id')
            ->where('i.product_id', $productId)
            ->get(['i.sort_order', 'i.service_id', 'i.quantity', 'i.unit_cost_override', 's.cost', 's.currency', 's.ref', 's.name', 'i.unit', 'pv.name as provider']);
        $products = DB::table('catalog_product_items as i')->join('catalog_products as c', 'c.id', '=', 'i.component_product_id')
            ->where('i.product_id', $productId)
            ->get(['i.sort_order', 'i.component_product_id', 'i.quantity', 'i.unit_cost_override', 'c.code as ref', 'c.name', 'i.unit']);
        $productCosts = DB::table('catalog_rates')->whereIn('product_id', $products->pluck('component_product_id'))->where('status', 'vigente')
            ->orderBy('cost')->get(['product_id', 'cost', 'currency'])->groupBy('product_id');

        return $services->map(fn (object $row) => $this->line($row, (string) ($row->unit_cost_override ?? $row->cost), $row->currency, $fx))
            ->merge($products->map(function (object $row) use ($productCosts, $fx): array {
                $rate = ($productCosts[$row->component_product_id] ?? collect())->first();

                return $this->line($row, (string) ($row->unit_cost_override ?? $rate->cost ?? '0'), $rate->currency ?? 'PEN', $fx);
            }))
            ->sortBy('sort_order')->values();
    }

    private function line(object $row, string $unitCost, string $currency, BigDecimal $fx): array
    {
        $subtotal = BigDecimal::of($unitCost)->multipliedBy(BigDecimal::of((string) $row->quantity));
        $pen = $currency === 'PEN' ? $subtotal : $subtotal->multipliedBy($fx);

        return [
            'sort_order' => (int) $row->sort_order,
            'ref' => $row->ref,
            'name' => $row->name,
            'provider' => $row->provider ?? null,
            'unit' => $row->unit,
            'unit_cost' => (string) BigDecimal::of($unitCost)->toScale(2, RoundingMode::HALF_UP),
            'currency' => $currency,
            'subtotal_pen' => $pen->toScale(2, RoundingMode::HALF_UP),
        ];
    }

    public function breakdown(string $productId, Collection $components): array
    {
        $pax = DB::table('catalog_products')->where('id', $productId)->first(['minimum_passengers', 'maximum_passengers']);

        return ComponentCostBreakdown::of(
            $components,
            $pax?->minimum_passengers === null ? null : (int) $pax->minimum_passengers,
            $pax?->maximum_passengers === null ? null : (int) $pax->maximum_passengers,
            $this->publicPrice($productId),
        );
    }

    public function publicPrice(string $productId): ?BigDecimal
    {
        $rates = DB::table('catalog_rates')->where('product_id', $productId)
            ->get(['segment', 'channel', 'rate_type', 'status', 'valid_from', 'valid_to', 'price', 'currency', 'season_id']);
        $rate = RateResolver::pick($rates, CatalogAccess::today(), ['Adulto', 'Pasajero'], RateResolver::FALLBACK_CHANNEL);

        if (! is_object($rate)) {
            return null;
        }

        $price = BigDecimal::of((string) $rate->price);

        return trim((string) $rate->currency) === 'PEN' ? $price : $price->multipliedBy($this->fx());
    }

    public function fx(): BigDecimal
    {
        $rate = DB::table('fin_fx_rates')->where('currency_code', 'USD')->orderByDesc('rate_date')->orderByDesc('effective_at')->value('rate_pen');

        return BigDecimal::of((string) ($rate ?? '3.75'));
    }
}
