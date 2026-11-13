<?php

declare(strict_types=1);

namespace App\Domain\Catalog\Http\Controllers;

use App\Domain\Catalog\Actions\SeasonRegistry;
use App\Domain\Catalog\Http\Controllers\Concerns\ResolvesActor;
use App\Domain\Catalog\Http\Controllers\Concerns\ResolvesProduct;
use App\Domain\Catalog\Support\CatalogAccess;
use App\Domain\Catalog\Support\ProductOverview;
use App\Domain\Catalog\Support\ProductPricing;
use App\Domain\Catalog\Support\RateDirectory;
use App\Domain\Shared\Http\CursorPage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

final class PricingController
{
    use ResolvesActor;
    use ResolvesProduct;

    private const SEASON_SORTS = ['date_from' => 'date_from', 'date_to' => 'date_to', 'priority' => 'priority', 'name' => 'name', 'ref' => 'ref'];

    private const RATE_SORTS = ['ref' => 'r.ref', 'valid_from' => 'r.valid_from', 'valid_to' => 'r.valid_to', 'price' => 'r.price', 'type' => 'r.rate_type', 'segment' => 'r.segment'];

    public function seasons(Request $request, RateDirectory $directory): JsonResponse
    {
        $filters = CursorPage::filters($request);
        $today = CatalogAccess::today();
        [$rates, $products] = RateDirectory::seasonUsage();
        $query = DB::table('catalog_seasons')->whereNull('deleted_at')
            ->when($filters['status'] ?? null, fn ($builder, string $status) => $builder->where('status', $status))
            ->when($filters['type'] ?? null, fn ($builder, string $type) => $builder->where('type', $type))
            ->when($filters['date'] ?? null, fn ($builder, string $date) => $builder->where('date_from', '<=', $date)->where('date_to', '>=', $date));
        $overlaps = CursorPage::isFirst($request) ? $directory->overlaps($directory->seasons($today)) : null;

        return response()->json(CursorPage::respond($request, $query, self::SEASON_SORTS, 'date_from,priority,ref',
            fn (object $season) => RateDirectory::presentSeason($season, $today, (int) ($rates[$season->id] ?? 0), (int) ($products[$season->id] ?? 0)),
            $overlaps === null ? [] : ['overlaps' => $overlaps]));
    }

    public function resolveSeason(Request $request): JsonResponse
    {
        $date = (string) ($request->validate(['date' => ['nullable', 'date_format:Y-m-d']], ['date.*' => 'Indica la fecha en formato AAAA-MM-DD.'])['date'] ?? CatalogAccess::today());
        $today = CatalogAccess::today();
        [$rates, $products] = RateDirectory::seasonUsage();
        $active = DB::table('catalog_seasons')->whereNull('deleted_at')->where('status', 'activa')->where('date_from', '<=', $date)->where('date_to', '>=', $date)
            ->orderBy('priority')->orderBy('date_from')->get()
            ->map(fn (object $season) => RateDirectory::presentSeason($season, $today, (int) ($rates[$season->id] ?? 0), (int) ($products[$season->id] ?? 0)))->values();
        $applied = $active->first();

        return response()->json(['data' => [
            'date' => $date,
            'season' => $applied,
            'factor' => $applied['factor'] ?? 1.0,
            'others' => $active->slice(1)->values(),
            'rule' => 'Gana la temporada activa de menor prioridad (0 es la que más pesa) que cubre la fecha.',
        ]]);
    }

    public function destroySeason(Request $request, SeasonRegistry $seasons, string $ref): Response
    {
        $seasons->delete($ref, $this->actor($request));

        return response()->noContent();
    }

    public function productRates(Request $request, string $product): JsonResponse
    {
        $viewer = $this->actor($request);
        $productId = $this->productId($product);
        $filters = CursorPage::filters($request);
        $today = CatalogAccess::today();
        $seesCost = CatalogAccess::seesCost($viewer);
        $seesMargin = CatalogAccess::seesMargin($viewer);
        $query = RateDirectory::rateQuery()->where('r.product_id', $productId)
            ->when(! CatalogAccess::seesNetRates($viewer), fn ($builder) => RateDirectory::withoutNet($builder))
            ->when($filters['status'] ?? null, fn ($builder, string $status) => $builder->where('r.status', $status))
            ->when($filters['channel'] ?? null, fn ($builder, string $channel) => $builder->where('r.channel', $channel))
            ->when($filters['segment'] ?? null, fn ($builder, string $segment) => $builder->where('r.segment', $segment))
            ->when($filters['currency'] ?? null, fn ($builder, string $currency) => $builder->where('r.currency', $currency))
            ->when($filters['date'] ?? null, fn ($builder, string $date) => $builder->where('r.valid_from', '<=', $date)->where('r.valid_to', '>=', $date));

        return response()->json(CursorPage::respond($request, $query, self::RATE_SORTS, 'ref', fn (object $rate) => RateDirectory::presentRate($rate, $today, $seesCost, $seesMargin)));
    }

    public function productSeasons(Request $request, string $product): JsonResponse
    {
        $productId = $this->productId($product);
        $today = CatalogAccess::today();
        [$rates, $products] = RateDirectory::seasonUsage();
        $query = DB::table('catalog_seasons')->whereNull('deleted_at')
            ->whereIn('id', DB::table('catalog_product_seasons')->where('product_id', $productId)->select('season_id'));

        return response()->json(CursorPage::respond($request, $query, self::SEASON_SORTS, 'date_from,priority,ref',
            fn (object $season) => [
                ...RateDirectory::presentSeason($season, $today, (int) ($rates[$season->id] ?? 0), (int) ($products[$season->id] ?? 0)),
                'used_by_rates' => DB::table('catalog_rates')->where('product_id', $productId)->where('season_id', $season->id)->count(),
            ]));
    }

    public function providers(Request $request, ProductOverview $overview, string $product): JsonResponse
    {
        $row = DB::table('catalog_products')->where('id', $this->productId($product))->first();
        $items = $overview->providers($row);

        return response()->json(CursorPage::respondItems($request, array_map(fn (array $provider) => CatalogAccess::seesCost($this->actor($request)) ? $provider : array_diff_key($provider, ['contract_end' => true, 'contract_days' => true, 'payment_terms' => true]), $items)));
    }

    public function priceQuote(Request $request, ProductPricing $pricing, string $product): JsonResponse
    {
        $data = $request->validate([
            'rate_id' => ['required', 'uuid'],
            'selections' => ['nullable', 'array', 'max:20'],
            'selections.*' => ['required', 'string', 'max:80'],
            'date' => ['nullable', 'date_format:Y-m-d'],
            'pax' => ['nullable', 'integer', 'between:1,500'],
            'channel' => ['nullable', Rule::in(RateDirectory::CHANNELS)],
        ], [
            'rate_id.*' => 'Elige la tarifa base.',
            'selections.*' => 'Revisa las opciones elegidas.',
            'date.*' => 'Indica la fecha en formato AAAA-MM-DD.',
            'pax.*' => 'Los pasajeros van de 1 a 500.',
            'channel.*' => 'Elige un canal válido.',
        ]);
        $row = DB::table('catalog_products')->where('id', $this->productId($product))->first(['id', 'code', 'name']);

        return response()->json(['data' => $pricing->priceQuote($row, $data, $this->actor($request))]);
    }

    public function profitability(Request $request, ProductPricing $pricing, string $product): JsonResponse
    {
        $data = $request->validate([
            'rate_id' => ['nullable', 'uuid'],
            'pax' => ['nullable', 'integer', 'between:1,500'],
            'other_cost' => ['nullable', 'numeric', 'min:0', 'max:999999'],
            'commission_pct' => ['nullable', 'numeric', 'min:0', 'max:100'],
        ], [
            'rate_id.*' => 'Elige una tarifa válida.',
            'pax.*' => 'Los pasajeros van de 1 a 500.',
            'other_cost.*' => 'Los otros costos deben ser cero o mayores.',
            'commission_pct.*' => 'La comisión va de 0 a 100 %.',
        ]);
        $row = DB::table('catalog_products')->where('id', $this->productId($product))->first(['id', 'code', 'name']);

        return response()->json(['data' => $pricing->profitability($row, $data)]);
    }
}
