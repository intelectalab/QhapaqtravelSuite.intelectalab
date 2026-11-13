<?php

declare(strict_types=1);

namespace App\Domain\Catalog\Support;

use App\Domain\Catalog\Actions\ProductPromotions;
use App\Domain\Crm\Support\Portfolio;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Money\Decimal;
use Brick\Math\BigDecimal;
use Brick\Math\RoundingMode;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

final class ProductOverview
{
    public function __construct(private readonly ProductReview $review, private readonly B2bRateDirectory $rates) {}

    private static function diffPct(string $price, string $currency, ?object $public): ?float
    {
        if ($public === null || trim($currency) !== trim((string) $public->currency) || BigDecimal::of((string) $public->price)->isZero()) {
            return null;
        }

        return BigDecimal::of($price)->minus((string) $public->price)->multipliedBy(100)->dividedBy((string) $public->price, 1, RoundingMode::HALF_UP)->toFloat();
    }

    private static function promotionPrice(object $promotion, ?object $public): ?array
    {
        if ($public === null) {
            return null;
        }

        $base = Decimal::money((string) $public->price);
        $value = Decimal::money((string) $promotion->value);
        $result = match (true) {
            in_array($promotion->kind, ProductPromotions::PERCENT_KINDS, true) => $base->multipliedBy(BigDecimal::of(100)->minus($value))->dividedBy(100, 2, RoundingMode::HALF_UP),
            $promotion->kind === 'Descuento fijo' => $base->minus($value),
            $promotion->kind === 'Precio promocional' => $value,
            default => null,
        };

        return $result === null ? null : ['amount' => Decimal::toApi(Decimal::round2($result)), 'currency' => trim((string) $public->currency)];
    }

    public function find(string $code, User $viewer): ?array
    {
        $product = DB::table('catalog_products')->where('code', $code)->whereNull('deleted_at')->first();

        if ($product === null) {
            return null;
        }

        $today = CatalogAccess::today();
        $review = $this->review->build($product, $viewer, false);
        $public = $this->rates->publicPrice((string) $product->id);
        $held = DepartureDirectory::heldByDeparture((string) $product->id);
        $departures = DepartureDirectory::query()->where('d.product_id', $product->id)->orderByRaw('d.departure_date < ? , d.departure_date', [$today])->orderBy('d.departure_time')->limit(40)->get();
        $related = DB::table('catalog_product_related as r')->join('catalog_products as p', 'p.id', '=', 'r.related_product_id')->join('catalog_product_types as t', 't.id', '=', 'p.product_type_id')
            ->where('r.product_id', $product->id)->whereNull('p.deleted_at')->orderBy('p.name')->get(['p.id', 'p.code', 'p.name', 'p.status', 'r.relation', 't.name as type']);
        $referencing = DB::table('catalog_product_related as r')->join('catalog_products as p', 'p.id', '=', 'r.product_id')->join('catalog_product_types as t', 't.id', '=', 'p.product_type_id')
            ->where('r.related_product_id', $product->id)->whereNull('p.deleted_at')->orderBy('p.name')->get(['p.id', 'p.code', 'p.name', 'p.status', 'r.relation', 't.name as type']);
        $prices = ProductDirectory::pricesFrom($viewer, $related->pluck('id')->concat($referencing->pluck('id'))->all());
        $quotes = DB::table('quote_items as i')->join('quote_versions as v', 'v.id', '=', 'i.quote_version_id')->join('quote_quotes as q', 'q.id', '=', 'v.quote_id')->join('crm_clients as c', 'c.id', '=', 'q.client_id')
            ->where('i.product_id', $product->id)->when(Portfolio::ownOnly($viewer), fn ($query) => $query->where('q.owner_id', $viewer->getKey()))->select(['q.code', 'q.title', 'q.status', 'c.name as client'])->distinct()->orderByDesc('q.code')->limit(20)->get();
        $reservations = DB::table('booking_reservation_services as s')->join('booking_reservations as r', 'r.id', '=', 's.reservation_id')->join('crm_clients as c', 'c.id', '=', 'r.client_id')
            ->where('s.product_id', $product->id)->when(Portfolio::ownOnly($viewer), fn ($query) => $query->where('r.owner_id', $viewer->getKey()))->select(['r.code', 'r.title', 'r.status', 'c.name as client'])->distinct()->orderByDesc('r.code')->limit(20)->get();

        return [
            'code' => $product->code,
            'kpis' => [
                'components_cost' => $review['summary']['components_cost'],
                'cost_breakdown' => $review['summary']['cost_breakdown'],
                'future_departures' => DB::table('catalog_product_departures')->where('product_id', $product->id)->where('departure_date', '>=', $today)->whereIn('status', ['abierta', 'completa'])->count(),
                'quotes' => DB::table('quote_items as i')->join('quote_versions as v', 'v.id', '=', 'i.quote_version_id')->join('quote_quotes as q', 'q.id', '=', 'v.quote_id')->where('i.product_id', $product->id)->when(Portfolio::ownOnly($viewer), fn ($query) => $query->where('q.owner_id', $viewer->getKey()))->distinct()->count('v.quote_id'),
                'reservations' => DB::table('booking_reservation_services as s')->join('booking_reservations as r', 'r.id', '=', 's.reservation_id')->where('s.product_id', $product->id)->when(Portfolio::ownOnly($viewer), fn ($query) => $query->where('r.owner_id', $viewer->getKey()))->distinct()->count('s.reservation_id'),
                'sellable' => $product->status === 'ACTIVE' && (bool) $product->is_bookable,
                'version' => DB::table('catalog_product_versions')->where('id', $product->current_version_id)->value('version'),
            ],
            'checklist' => $review['checklist'],
            'departures' => $departures->map(fn (object $row) => [
                ...DepartureDirectory::present($row, (int) ($held[$row->id] ?? 0), $today),
                'time' => $row->departure_time ? substr((string) $row->departure_time, 0, 5) : null,
            ]),
            'providers' => CatalogAccess::seesCost($viewer) ? $this->providers($product) : null,
            'related' => $related->map(fn (object $row): array => self::relatedRow($row, $prices))->values(),
            'referenced_by' => $referencing->map(fn (object $row): array => self::relatedRow($row, $prices))->values(),
            'b2b' => CatalogAccess::seesNetRates($viewer) ? DB::table('catalog_product_b2b_rates as b')->leftJoin('channel_b2b_agencies as a', 'a.id', '=', 'b.agency_id')
                ->where('b.product_id', $product->id)->whereNull('b.deleted_at')->orderBy('a.legal_name')
                ->get(['a.code as agency_code', 'a.legal_name as agency', 'a.status as agency_status', 'b.price_list', 'b.price', 'b.currency', 'b.commission_pct', 'b.is_credit', 'b.valid_to', 'b.conditions', 'b.restrictions'])
                ->map(fn (object $row): array => [...(array) $row, 'diff_pct' => self::diffPct((string) $row->price, $row->currency, $public)]) : null,
            'public_price' => $public ? ['amount' => Decimal::toApi((string) $public->price), 'currency' => trim((string) $public->currency), 'channel' => $public->channel] : null,
            'promotions' => DB::table('catalog_product_promotions')->where('product_id', $product->id)->whereNull('deleted_at')->orderByDesc('date_from')
                ->get(['ref', 'name', 'kind', 'value', 'channel', 'promo_code', 'min_pax', 'date_from', 'date_to', 'status'])
                ->map(fn (object $row): array => [...(array) $row, 'result_price' => self::promotionPrice($row, $public)]),
            'profitability' => CatalogAccess::seesMargin($viewer) ? DB::table('catalog_rates')->where('product_id', $product->id)->orderByDesc('status')->orderBy('rate_type')
                ->get(['id', 'ref', 'rate_type', 'segment', 'channel', 'currency', 'cost', 'price', 'status', 'valid_from', 'valid_to'])
                ->map(fn (object $rate) => [...(array) $rate, 'status' => RateDirectory::state($rate, CatalogAccess::today()), 'margin' => number_format((float) $rate->price - (float) $rate->cost, 2, '.', ''), 'margin_pct' => CatalogAccess::marginPct($rate->price, $rate->cost)]) : null,
            'config_groups' => DB::table('catalog_product_config_groups')->where('product_id', $product->id)->orderBy('sort_order')->get(['id', 'name'])
                ->map(fn (object $group) => ['name' => $group->name, 'options' => DB::table('catalog_product_config_options')->where('group_id', $group->id)->orderBy('sort_order')->get(['label', 'price_delta'])]),
            'versions' => DB::table('catalog_product_versions as v')->leftJoin('iam_users as u', 'u.id', '=', 'v.created_by')->where('v.product_id', $product->id)->orderByDesc('v.created_at')
                ->get(['v.version', 'v.status', 'v.valid_from', 'v.reason', 'v.created_at', 'u.name as author']),
            'history' => $viewer->can('catalog.products.update') ? $this->history($product) : null,
            'usage' => ['quotes' => $quotes, 'reservations' => $reservations, 'own_only' => Portfolio::ownOnly($viewer)],
        ];
    }

    private function history(object $product): array
    {
        $rates = DB::table('catalog_rates')->where('product_id', $product->id)->pluck('ref')->all();
        $departures = DB::table('catalog_product_departures')->where('product_id', $product->id)->pluck('ref')->all();

        return DB::table('audit_events as e')->leftJoin('iam_users as u', 'u.id', '=', 'e.actor_id')
            ->where(fn ($query) => $query->where(fn ($own) => $own->where('e.entity', 'Producto')->where('e.entity_id', $product->code))
                ->orWhere(fn ($rate) => $rate->where('e.entity', 'Tarifa')->whereIn('e.entity_id', $rates))
                ->orWhere(fn ($departure) => $departure->where('e.entity', 'Salida')->whereIn('e.entity_id', $departures)))
            ->orderByDesc('e.occurred_at')->limit(150)
            ->get(['e.code', 'e.entity', 'e.entity_id', 'e.action', 'e.before_value', 'e.after_value', 'e.occurred_at', 'u.name as actor'])
            ->map(fn (object $event): array => [...(array) $event, 'scope' => match ($event->entity) {
                'Tarifa' => 'tarifa',
                'Salida' => 'salida',
                default => 'producto',
            }])
            ->all();
    }

    public function providers(object $product): array
    {
        $today = CatalogAccess::today();
        $rows = DB::table('catalog_product_items as i')->join('catalog_services as s', 's.id', '=', 'i.service_id')->join('catalog_providers as pv', 'pv.id', '=', 's.provider_id')
            ->where('i.product_id', $product->id)->get(['pv.id', 'pv.ref', 'pv.name', 'pv.type', 'pv.status', 'pv.contract_end', 'pv.ruc', 'pv.payment_terms', 'pv.rating', 's.ref as service_ref', 's.name as service']);
        $main = $product->main_provider_id ? DB::table('catalog_providers')->where('id', $product->main_provider_id)->first(['id', 'ref', 'name', 'type', 'status', 'contract_end', 'ruc', 'payment_terms', 'rating']) : null;
        $providers = [];

        if ($main) {
            $providers[$main->id] = self::providerRow($main, true, $today);
        }

        foreach ($rows as $row) {
            $providers[$row->id] ??= self::providerRow($row, false, $today);
            $providers[$row->id]['services'][] = "{$row->service_ref} {$row->service}";
        }

        return array_values($providers);
    }

    private static function providerRow(object $provider, bool $isMain, string $today): array
    {
        return [
            'ref' => $provider->ref,
            'name' => $provider->name,
            'type' => $provider->type,
            'status' => $provider->status,
            'contract_end' => $provider->contract_end,
            'contract_days' => (int) Carbon::parse($today)->diffInDays(Carbon::parse($provider->contract_end), false),
            'ruc' => $provider->ruc,
            'payment_terms' => $provider->payment_terms,
            'rating' => (float) $provider->rating,
            'main' => $isMain,
            'services' => [],
            'usable' => $provider->status === 'activo' && $provider->contract_end >= $today,
        ];
    }

    private static function relatedRow(object $row, Collection $prices): array
    {
        return ['code' => $row->code, 'name' => $row->name, 'status' => $row->status, 'relation' => $row->relation, 'type' => $row->type, 'price_from' => $prices[$row->id] ?? null];
    }
}
