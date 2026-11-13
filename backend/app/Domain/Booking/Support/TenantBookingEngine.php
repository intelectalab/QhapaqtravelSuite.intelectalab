<?php

declare(strict_types=1);

namespace App\Domain\Booking\Support;

use App\Domain\Admin\Support\PriceRounding;
use App\Domain\Booking\BookingEngine;
use App\Domain\Booking\Data\FxTable;
use App\Domain\Booking\Data\ProductData;
use App\Domain\Booking\Data\SeasonCalendar;
use App\Domain\Booking\Inventory\DatabaseInventoryReader;
use App\Domain\Booking\Rules\RuleResolver;
use App\Domain\Catalog\Support\ProductBookingConfig;
use App\Domain\Catalog\Support\RateResolver;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Tenancy\TenantContext;
use Brick\Math\BigDecimal;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

final class TenantBookingEngine
{
    private const DEFAULTS = [
        'paymentModes' => ['total', 'adelanto'],
        'depositPctDefault' => 30,
        'balanceDueDaysDefault' => 15,
        'chargeCurrencies' => ['PEN', 'USD'],
        'defaultPaxRules' => [
            'adultMinAge' => 11, 'childMinAge' => 4, 'childMaxAge' => 10, 'childPays' => true, 'childPricePct' => 70,
            'infantMaxAge' => 3, 'infantPays' => false, 'maxChildrenPerAdult' => 2, 'maxInfantsPerAdult' => 1, 'minAdults' => 1,
        ],
    ];

    private ?BookingEngine $engine = null;

    public function __construct(
        private readonly TenantContext $context,
        private readonly RuleResolver $rules,
        private readonly DatabaseInventoryReader $inventory,
    ) {}

    public function engine(?string $previewPlan = null): BookingEngine
    {
        if ($previewPlan !== null) {
            return new BookingEngine(
                rules: $this->rules->forTenant($previewPlan),
                fx: $this->fxTable(),
                seasons: $this->seasons(),
                inventory: $this->inventory,
                ecommerceDefaults: $this->defaults(),
                today: CarbonImmutable::now($this->context->timezone())->toDateString(),
                rounding: fn (BigDecimal $price): BigDecimal => app(PriceRounding::class)->apply($price),
            );
        }

        return $this->engine ??= new BookingEngine(
            rules: $this->rules->forTenant(),
            fx: $this->fxTable(),
            seasons: $this->seasons(),
            inventory: $this->inventory,
            ecommerceDefaults: $this->defaults(),
            today: CarbonImmutable::now($this->context->timezone())->toDateString(),
            rounding: fn (BigDecimal $price): BigDecimal => app(PriceRounding::class)->apply($price),
        );
    }

    public function product(string $productId, string $date): ProductData
    {
        $product = DB::table('catalog_products')->where('id', $productId)->whereNull('deleted_at')
            ->first(['id', 'code', 'maximum_passengers', 'booking_advance_min_days', 'cutoff_hours', 'operating_weekdays'])
            ?? throw ApiException::notFound('El producto no existe.');
        $paxRules = DB::table('catalog_pax_rules')->where('product_id', $productId)->first();
        [$overrides, $params] = $this->rules->productOverrides($productId);
        $sections = app(ProductBookingConfig::class)->engineSections($productId);

        return new ProductData(
            id: (string) $product->id,
            code: (string) $product->code,
            maxPax: $product->maximum_passengers === null ? null : (int) $product->maximum_passengers,
            ranges: [],
            departures: [],
            hasAvailabilityConfig: false,
            operatingWeekdays: $product->operating_weekdays === null ? null : array_map('intval', array_filter(explode(',', trim((string) $product->operating_weekdays, '{}')), 'is_numeric')),
            cutoffHours: $product->cutoff_hours === null ? null : (int) $product->cutoff_hours,
            advanceMinDays: (int) $product->booking_advance_min_days,
            paxRules: $paxRules === null ? [] : $this->paxRules($paxRules),
            ruleOverrides: $overrides,
            ruleParams: $params,
            rates: $this->rates($productId, $date),
            addons: $sections['addons'],
            accommodation: $sections['accommodation'],
            payment: $sections['payment'],
            trip: $sections['trip'],
        );
    }

    public function paxRulesFor(string $productId): array
    {
        $paxRules = DB::table('catalog_pax_rules')->where('product_id', $productId)->first();
        [$overrides, $params] = $this->rules->productOverrides($productId);

        return $this->engine()->paxRules(new ProductData(
            id: $productId,
            code: $productId,
            maxPax: null,
            ranges: [],
            departures: [],
            hasAvailabilityConfig: false,
            operatingWeekdays: null,
            cutoffHours: null,
            advanceMinDays: 0,
            paxRules: $paxRules === null ? [] : $this->paxRules($paxRules),
            ruleOverrides: $overrides,
            ruleParams: $params,
        ));
    }

    private function rates(string $productId, string $date): array
    {
        return DB::table('catalog_rates as r')
            ->where('r.product_id', $productId)
            ->where('r.status', 'vigente')
            ->where('r.valid_from', '<=', $date)
            ->where('r.valid_to', '>=', $date)
            ->whereNotIn('r.rate_type', RateResolver::NON_SALE_TYPES)
            ->orderByRaw("case when r.rate_type = 'Venta' then 0 else 1 end")
            ->orderBy('r.price')
            ->get(['r.segment', 'r.channel', 'r.currency', 'r.price', 'r.cost', 'r.status', 'r.rate_type', 'r.season_id'])
            ->map(fn (object $rate): array => (array) $rate)
            ->all();
    }

    private function paxRules(object $row): array
    {
        return [
            'adult_min_age' => $row->adult_min_age,
            'child_min_age' => $row->child_min_age,
            'child_max_age' => $row->child_max_age,
            'infant_max_age' => $row->infant_max_age,
            'child_pays' => (bool) $row->child_pays,
            'child_price_pct' => $row->child_price_pct === null ? null : (string) $row->child_price_pct,
            'infant_allowed' => (bool) $row->infant_allowed,
            'infant_pays' => (bool) $row->infant_pays,
            'max_children_per_adult' => $row->max_children_per_adult,
            'max_infants_per_adult' => $row->max_infants_per_adult,
            'min_adults' => $row->min_adults,
        ];
    }

    private function fxTable(): FxTable
    {
        $currencies = [['code' => 'PEN', 'rate' => '1', 'active' => true]];
        $latest = DB::table('fin_fx_rates')->where('currency_code', '<>', 'PEN')
            ->orderBy('currency_code')->orderByDesc('rate_date')->orderByDesc('effective_at')->get(['currency_code', 'rate_pen'])->unique('currency_code');

        foreach ($latest as $row) {
            $currencies[] = ['code' => $row->currency_code, 'rate' => (string) $row->rate_pen, 'active' => true];
        }

        return FxTable::fromArray($currencies, $this->defaults()['chargeCurrencies'], 'PEN');
    }

    private function seasons(): SeasonCalendar
    {
        return SeasonCalendar::fromArray(DB::table('catalog_seasons')->whereNull('deleted_at')->get(['id', 'name', 'date_from', 'date_to', 'priority', 'factor', 'status'])
            ->map(fn (object $season): array => [
                'id' => (string) $season->id,
                'name' => $season->name,
                'from' => (string) $season->date_from,
                'to' => (string) $season->date_to,
                'priority' => $season->priority,
                'factor' => (string) $season->factor,
                'status' => $season->status,
            ])->all());
    }

    private function defaults(): array
    {
        $stored = DB::table('sys_settings')->where('section', 'ecommerce')->value('values');

        return [...self::DEFAULTS, ...(array) json_decode((string) $stored, true)];
    }
}
