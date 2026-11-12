<?php

declare(strict_types=1);

namespace App\Domain\Catalog\Support;

use App\Domain\Crm\Support\Portfolio;
use App\Domain\Iam\Models\User;
use Illuminate\Support\Facades\DB;

final class ProductOverview
{
    public function __construct(private readonly ProductReview $review) {}

    public function find(string $code, User $viewer): ?array
    {
        $product = DB::table('catalog_products')->where('code', $code)->whereNull('deleted_at')->first();

        if ($product === null) {
            return null;
        }

        $today = CatalogAccess::today();
        $review = $this->review->build($product, $viewer, false);
        $departures = DB::table('catalog_product_departures')->where('product_id', $product->id)->orderByRaw('departure_date < ? , departure_date', [$today])->limit(40)
            ->get(['ref', 'departure_date', 'departure_time', 'capacity', 'sold', 'status', 'meeting_point']);
        $quotes = DB::table('quote_items as i')->join('quote_versions as v', 'v.id', '=', 'i.quote_version_id')->join('quote_quotes as q', 'q.id', '=', 'v.quote_id')->join('crm_clients as c', 'c.id', '=', 'q.client_id')
            ->where('i.product_id', $product->id)->when(Portfolio::ownOnly($viewer), fn ($query) => $query->where('q.owner_id', $viewer->getKey()))->select(['q.code', 'q.title', 'q.status', 'c.name as client'])->distinct()->orderByDesc('q.code')->limit(20)->get();
        $reservations = DB::table('booking_reservation_services as s')->join('booking_reservations as r', 'r.id', '=', 's.reservation_id')->join('crm_clients as c', 'c.id', '=', 'r.client_id')
            ->where('s.product_id', $product->id)->when(Portfolio::ownOnly($viewer), fn ($query) => $query->where('r.owner_id', $viewer->getKey()))->select(['r.code', 'r.title', 'r.status', 'c.name as client'])->distinct()->orderByDesc('r.code')->limit(20)->get();

        return [
            'code' => $product->code,
            'kpis' => [
                'components_cost' => $review['summary']['components_cost'],
                'future_departures' => DB::table('catalog_product_departures')->where('product_id', $product->id)->where('departure_date', '>=', $today)->whereIn('status', ['abierta', 'completa'])->count(),
                'quotes' => DB::table('quote_items as i')->join('quote_versions as v', 'v.id', '=', 'i.quote_version_id')->join('quote_quotes as q', 'q.id', '=', 'v.quote_id')->where('i.product_id', $product->id)->when(Portfolio::ownOnly($viewer), fn ($query) => $query->where('q.owner_id', $viewer->getKey()))->distinct()->count('v.quote_id'),
                'reservations' => DB::table('booking_reservation_services as s')->join('booking_reservations as r', 'r.id', '=', 's.reservation_id')->where('s.product_id', $product->id)->when(Portfolio::ownOnly($viewer), fn ($query) => $query->where('r.owner_id', $viewer->getKey()))->distinct()->count('s.reservation_id'),
                'sellable' => $product->status === 'ACTIVE' && (bool) $product->is_bookable,
                'version' => DB::table('catalog_product_versions')->where('id', $product->current_version_id)->value('version'),
            ],
            'checklist' => $review['checklist'],
            'departures' => $departures->map(fn (object $row) => [
                'ref' => $row->ref,
                'date' => $row->departure_date,
                'time' => $row->departure_time ? substr((string) $row->departure_time, 0, 5) : null,
                'capacity' => (int) $row->capacity,
                'sold' => (int) $row->sold,
                'status' => $row->status,
                'meeting_point' => $row->meeting_point,
                'future' => $row->departure_date >= $today,
            ]),
            'providers' => CatalogAccess::seesCost($viewer) ? $this->providers($product) : null,
            'related' => DB::table('catalog_product_related as r')->join('catalog_products as p', 'p.id', '=', 'r.related_product_id')->where('r.product_id', $product->id)->whereNull('p.deleted_at')
                ->orderBy('p.name')->get(['p.code', 'p.name', 'p.status', 'r.relation']),
            'b2b' => CatalogAccess::seesNetRates($viewer) ? DB::table('catalog_product_b2b_rates as b')->leftJoin('channel_b2b_agencies as a', 'a.id', '=', 'b.agency_id')
                ->where('b.product_id', $product->id)->whereNull('b.deleted_at')->orderBy('a.legal_name')
                ->get(['a.code as agency_code', 'a.legal_name as agency', 'b.price_list', 'b.price', 'b.currency', 'b.commission_pct', 'b.is_credit', 'b.valid_to']) : null,
            'promotions' => DB::table('catalog_product_promotions')->where('product_id', $product->id)->whereNull('deleted_at')->orderByDesc('date_from')
                ->get(['ref', 'name', 'kind', 'value', 'channel', 'promo_code', 'min_pax', 'date_from', 'date_to', 'status']),
            'profitability' => CatalogAccess::seesMargin($viewer) ? DB::table('catalog_rates')->where('product_id', $product->id)->orderByDesc('status')->orderBy('rate_type')
                ->get(['id', 'ref', 'rate_type', 'segment', 'channel', 'currency', 'cost', 'price', 'status', 'valid_from', 'valid_to'])
                ->map(fn (object $rate) => [...(array) $rate, 'status' => RateDirectory::state($rate, CatalogAccess::today()), 'margin' => number_format((float) $rate->price - (float) $rate->cost, 2, '.', ''), 'margin_pct' => CatalogAccess::marginPct($rate->price, $rate->cost)]) : null,
            'config_groups' => DB::table('catalog_product_config_groups')->where('product_id', $product->id)->orderBy('sort_order')->get(['id', 'name'])
                ->map(fn (object $group) => ['name' => $group->name, 'options' => DB::table('catalog_product_config_options')->where('group_id', $group->id)->orderBy('sort_order')->get(['label', 'price_delta'])]),
            'versions' => DB::table('catalog_product_versions as v')->leftJoin('iam_users as u', 'u.id', '=', 'v.created_by')->where('v.product_id', $product->id)->orderByDesc('v.created_at')
                ->get(['v.version', 'v.status', 'v.valid_from', 'v.reason', 'v.created_at', 'u.name as author']),
            'history' => $viewer->can('catalog.products.update') ? DB::table('audit_events as e')->leftJoin('iam_users as u', 'u.id', '=', 'e.actor_id')
                ->where('e.entity', 'Producto')->where('e.entity_id', $product->code)->orderByDesc('e.occurred_at')->limit(80)
                ->get(['e.code', 'e.action', 'e.before_value', 'e.after_value', 'e.occurred_at', 'u.name as actor']) : null,
            'usage' => ['quotes' => $quotes, 'reservations' => $reservations, 'own_only' => Portfolio::ownOnly($viewer)],
        ];
    }

    private function providers(object $product): array
    {
        $today = CatalogAccess::today();
        $rows = DB::table('catalog_product_items as i')->join('catalog_services as s', 's.id', '=', 'i.service_id')->join('catalog_providers as pv', 'pv.id', '=', 's.provider_id')
            ->where('i.product_id', $product->id)->get(['pv.id', 'pv.ref', 'pv.name', 'pv.type', 'pv.status', 'pv.contract_end', 's.ref as service_ref', 's.name as service']);
        $main = $product->main_provider_id ? DB::table('catalog_providers')->where('id', $product->main_provider_id)->first(['id', 'ref', 'name', 'type', 'status', 'contract_end']) : null;
        $providers = [];

        if ($main) {
            $providers[$main->id] = ['ref' => $main->ref, 'name' => $main->name, 'type' => $main->type, 'status' => $main->status, 'contract_end' => $main->contract_end, 'main' => true, 'services' => []];
        }

        foreach ($rows as $row) {
            $providers[$row->id] ??= ['ref' => $row->ref, 'name' => $row->name, 'type' => $row->type, 'status' => $row->status, 'contract_end' => $row->contract_end, 'main' => false, 'services' => []];
            $providers[$row->id]['services'][] = "{$row->service_ref} {$row->service}";
        }

        return array_values(array_map(fn (array $provider) => [...$provider, 'usable' => $provider['status'] === 'activo' && $provider['contract_end'] >= $today], $providers));
    }
}
