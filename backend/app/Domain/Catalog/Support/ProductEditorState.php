<?php

declare(strict_types=1);

namespace App\Domain\Catalog\Support;

use App\Domain\Catalog\Actions\ProductSections;
use App\Domain\Iam\Models\User;
use Illuminate\Support\Facades\DB;

final class ProductEditorState
{
    public function __construct(private readonly ProductReview $review, private readonly ProductSections $sections) {}

    public function find(string $code, User $viewer): ?array
    {
        $product = DB::table('catalog_products')->where('code', $code)->whereNull('deleted_at')->first();

        if ($product === null) {
            return null;
        }

        $seesCost = CatalogAccess::seesCost($viewer);
        $texts = DB::table('catalog_product_inclusions')->where('product_id', $product->id)->orderBy('sort_order')->get(['kind', 'text']);
        $policy = DB::table('catalog_product_policies')->where('product_id', $product->id)->first(['cancellation', 'modification', 'no_show', 'refund', 'penalties', 'date_change', 'penalty_tiers']);
        $costs = $this->review->components($product->id)->keyBy('sort_order');

        return [
            'code' => $product->code,
            'ref' => $product->ref,
            'status' => $product->status,
            'lock_version' => (int) $product->lock_version,
            'master' => [
                'name' => $product->name,
                'internal_name' => $product->internal_name,
                'code' => $product->code,
                'sku' => $product->sku,
                'type_id' => $product->product_type_id,
                'category_id' => $product->category_id,
                'subcategory_id' => $product->subcategory_id,
                'destination_id' => $product->primary_destination_id,
                'short_description' => $product->short_description,
                'duration_value' => (float) $product->duration_value,
                'duration_unit' => $product->duration_unit,
                'modality' => $product->modality,
                'minimum_passengers' => (int) $product->minimum_passengers,
                'maximum_passengers' => (int) $product->maximum_passengers,
                'minimum_age' => (int) $product->minimum_age,
                'maximum_age' => (int) $product->maximum_age,
                'booking_advance_min_days' => (int) $product->booking_advance_min_days,
                'booking_advance_max_days' => (int) $product->booking_advance_max_days,
                'is_bookable' => (bool) $product->is_bookable,
                'is_quoteable' => (bool) $product->is_quoteable,
                'is_b2b' => (bool) $product->is_b2b,
                'is_ecommerce' => (bool) $product->is_ecommerce,
                'is_featured' => (bool) $product->is_featured,
                'markup_pct' => $seesCost ? (float) $product->markup_pct : null,
            ],
            'secondary_destination_ids' => DB::table('catalog_product_destinations')->where('product_id', $product->id)->pluck('destination_id'),
            'main_provider_id' => $product->main_provider_id,
            'components' => array_map(fn (array $item, int $index) => [...$item, 'unit_cost' => $seesCost ? ($costs[$index + 1]['unit_cost'] ?? null) : null, 'cost_currency' => $costs[$index + 1]['currency'] ?? null, 'subtotal_pen' => $seesCost && isset($costs[$index + 1]) ? (string) $costs[$index + 1]['subtotal_pen'] : null], $components = $this->sections->currentComponents($product->id), array_keys($components)),
            'fx_usd' => $seesCost ? (string) $this->review->fx() : null,
            'itinerary_id' => $this->sections->itineraryId($product->id),
            'itinerary' => $this->sections->currentItinerary($product->id),
            'rates' => DB::table('catalog_rates')->where('product_id', $product->id)->orderByDesc('status')->orderBy('valid_from')
                ->get(['ref', 'rate_type', 'segment', 'channel', 'currency', 'price_basis', 'cost', 'price', 'min_price', 'max_price', 'conditions', 'valid_from', 'valid_to', 'season_id', 'status', 'lock_version'])
                ->map(fn (object $rate) => [
                    'ref' => $rate->ref,
                    'rate_type' => $rate->rate_type,
                    'segment' => $rate->segment,
                    'channel' => $rate->channel,
                    'currency' => $rate->currency,
                    'price_basis' => $rate->price_basis,
                    'cost' => $seesCost ? $rate->cost : null,
                    'price' => $rate->price,
                    'min_price' => $rate->min_price,
                    'max_price' => $rate->max_price,
                    'conditions' => $rate->conditions,
                    'margin_pct' => CatalogAccess::seesMargin($viewer) ? CatalogAccess::marginPct($rate->price, $rate->cost) : null,
                    'valid_from' => $rate->valid_from,
                    'valid_to' => $rate->valid_to,
                    'season_id' => $rate->season_id,
                    'state' => RateDirectory::state($rate, CatalogAccess::today()),
                    'lock_version' => (int) $rate->lock_version,
                ]),
            'season_ids' => DB::table('catalog_product_seasons')->where('product_id', $product->id)->pluck('season_id'),
            'availability' => ['model' => $product->availability_model, 'capacity' => $product->availability_capacity, 'source' => $product->availability_source],
            'content' => [
                'long_description' => $product->long_description,
                'seo_title' => $product->seo_title,
                'seo_description' => $product->seo_description,
                'slug' => $product->slug,
                'video_url' => $product->video_url,
                'inclusions' => $texts->where('kind', 'include')->pluck('text')->values(),
                'exclusions' => $texts->where('kind', 'exclude')->pluck('text')->values(),
                'requirements' => DB::table('catalog_product_requirements')->where('product_id', $product->id)->orderBy('created_at')->get(['category', 'text']),
                'faqs' => DB::table('catalog_product_faqs')->where('product_id', $product->id)->orderBy('sort_order')->get(['question', 'answer']),
                'media' => DB::table('catalog_product_media')->where('product_id', $product->id)->orderByDesc('is_main')->orderBy('sort_order')->get(['storage_path as url', 'alt_text', 'is_main']),
            ],
            'policies' => $policy === null ? null : [...(array) $policy, 'penalty_tiers' => CancellationTiers::resolve($policy->penalty_tiers, $policy->cancellation), 'tiers_from_text' => CancellationTiers::normalize($policy->penalty_tiers) === []],
            'channels' => DB::table('catalog_product_channels')->where('product_id', $product->id)->where('is_published', true)->pluck('channel'),
            'review' => $this->review->build($product, $viewer),
        ];
    }
}
