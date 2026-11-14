<?php

declare(strict_types=1);

namespace App\Domain\Site\Support;

use App\Domain\Booking\Data\ProductData;
use App\Domain\Booking\Rules\RuleResolver;
use App\Domain\Booking\Support\TenantBookingEngine;
use App\Domain\Catalog\Support\RateCurrencyPrices;
use Brick\Math\BigDecimal;
use Brick\Math\RoundingMode;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

final class SiteCurrency
{
    public const HEADER = 'X-Site-Currency';

    private const DEFAULTS = ['PEN' => ['name' => 'Sol peruano', 'symbol' => 'S/'], 'USD' => ['name' => 'Dólar estadounidense', 'symbol' => 'US$']];

    private ?array $selectable = null;

    public function __construct(
        private readonly RateCurrencyPrices $prices,
        private readonly TenantBookingEngine $engine,
        private readonly RuleResolver $rules,
    ) {}

    public function selectable(): array
    {
        if ($this->selectable !== null) {
            return $this->selectable;
        }

        $rates = DB::table('fin_fx_rates')->where('currency_code', '<>', 'PEN')->orderBy('currency_code')->orderByDesc('rate_date')->orderByDesc('effective_at')
            ->get(['currency_code', 'rate_pen'])->unique('currency_code')->mapWithKeys(fn (object $row): array => [trim((string) $row->currency_code) => (float) $row->rate_pen])->all();

        $rows = DB::table('fin_currencies')->where('active', true)->orderByDesc('is_base')->orderBy('code')->get(['code', 'name', 'symbol', 'is_charge']);
        if (! DB::table('fin_currencies')->exists()) {
            $rows = collect(self::DEFAULTS)->map(fn (array $row, string $code): object => (object) ['code' => $code, ...$row, 'is_charge' => true])->values();
        }

        return $this->selectable = $rows
            ->map(fn (object $row): array => ['code' => trim((string) $row->code), 'name' => $row->name, 'symbol' => $row->symbol, 'charge' => (bool) $row->is_charge, 'rate' => trim((string) $row->code) === 'PEN' ? 1.0 : ($rates[trim((string) $row->code)] ?? null)])
            ->filter(fn (array $row): bool => $row['rate'] !== null)->values()->all();
    }

    public function settings(): array
    {
        return [
            'currencies' => $this->selectable(),
            'margin_pct' => $this->marginPct(),
            'charge_multi' => $this->prices->enabled(),
        ];
    }

    public function requested(?string $currency): ?string
    {
        $code = strtoupper(trim((string) $currency));

        return $code !== '' && in_array($code, array_column($this->selectable(), 'code'), true) ? $code : null;
    }

    public function payable(?string $currency): ?string
    {
        $code = $this->requested($currency);

        return $code !== null && in_array($code, RateCurrencyPrices::PAYABLE, true) ? $code : null;
    }

    public function override(string $productId, ?string $rateId, string $rateCurrency, ?string $requested): ?array
    {
        $code = $this->requested($requested);
        if ($code === null || $rateId === null || $code === trim($rateCurrency) || ! $this->prices->enabled() || ! in_array($code, $this->prices->chargeCurrencies(), true)) {
            return null;
        }

        $prices = DB::table('catalog_rate_prices as p')->join('catalog_rates as r', 'r.id', '=', 'p.rate_id')
            ->where('r.product_id', $productId)->where('p.currency', $code)->pluck('p.price', 'p.rate_id')
            ->map(fn (mixed $price): string => (string) $price)->all();

        return isset($prices[$rateId]) ? ['currency' => $code, 'prices' => $prices] : null;
    }

    public function apply(ProductData $data, array $override): ProductData
    {
        $fx = $this->engine->fx();
        $code = (string) $override['currency'];
        $rates = array_map(function (array $rate) use ($override, $fx, $code): array {
            $id = (string) ($rate['id'] ?? '');
            if (isset($override['prices'][$id])) {
                return [...$rate, 'price' => $override['prices'][$id], 'currency' => $code];
            }

            try {
                $price = $fx->convert(BigDecimal::of((string) $rate['price']), trim((string) $rate['currency']), $code)->toScale(2, RoundingMode::HALF_UP);
            } catch (InvalidArgumentException) {
                return $rate;
            }

            return [...$rate, 'price' => (string) $price, 'currency' => $code];
        }, $data->rates);

        return new ProductData(
            id: $data->id,
            code: $data->code,
            maxPax: $data->maxPax,
            ranges: $data->ranges,
            departures: $data->departures,
            hasAvailabilityConfig: $data->hasAvailabilityConfig,
            operatingWeekdays: $data->operatingWeekdays,
            cutoffHours: $data->cutoffHours,
            advanceMinDays: $data->advanceMinDays,
            paxRules: $data->paxRules,
            ruleOverrides: $data->ruleOverrides,
            ruleParams: $data->ruleParams,
            rates: $rates,
            addons: $data->addons,
            accommodation: $data->accommodation,
            options: $data->options,
            payment: $data->payment,
            trip: $data->trip,
        );
    }

    private function marginPct(): float
    {
        $set = $this->rules->forTenant();

        return $set->on('R-MULTICURRENCY') ? (float) ($set->param('R-MULTICURRENCY', 'fxMarginPct') ?? 0) : 0.0;
    }
}
