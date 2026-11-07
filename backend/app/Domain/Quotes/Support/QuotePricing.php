<?php

declare(strict_types=1);

namespace App\Domain\Quotes\Support;

use App\Domain\Shared\Money\Decimal;
use Brick\Math\BigDecimal;
use Brick\Math\RoundingMode;

final class QuotePricing
{
    public const MAX_DISCOUNT = '10';

    public static function lineTotal(BigDecimal|string $unit, int $qty, int $pax): BigDecimal
    {
        return Decimal::round2(BigDecimal::of((string) $unit)->multipliedBy($qty)->multipliedBy($pax));
    }

    public static function lineMargin(BigDecimal|string $unitPrice, BigDecimal|string $unitCost): ?string
    {
        $price = BigDecimal::of((string) $unitPrice);

        return $price->isPositive()
            ? (string) $price->minus((string) $unitCost)->multipliedBy(100)->dividedBy($price, 1, RoundingMode::HALF_UP)
            : null;
    }

    public static function totals(array $items, BigDecimal|string $discountPct, BigDecimal|string $taxPct): array
    {
        $cost = BigDecimal::zero();
        $sale = BigDecimal::zero();

        foreach ($items as $item) {
            $cost = $cost->plus(self::lineTotal((string) $item['unit_cost'], (int) $item['qty'], (int) $item['pax']));
            $sale = $sale->plus(self::lineTotal((string) $item['unit_price'], (int) $item['qty'], (int) $item['pax']));
        }

        $discount = Decimal::round2($sale->multipliedBy((string) $discountPct)->dividedBy(100, 6, RoundingMode::HALF_UP));
        $net = $sale->minus($discount);
        $tax = Decimal::round2($net->multipliedBy((string) $taxPct)->dividedBy(100, 6, RoundingMode::HALF_UP));
        $profit = $net->minus($cost);

        return [
            'cost_total' => (string) Decimal::round2($cost),
            'sale_total' => (string) Decimal::round2($sale),
            'discount_total' => (string) $discount,
            'net_total' => (string) Decimal::round2($net),
            'tax_total' => (string) $tax,
            'grand_total' => (string) Decimal::round2($net->plus($tax)),
            'profit_total' => (string) Decimal::round2($profit),
            'margin_pct' => $net->isPositive() ? (string) $profit->multipliedBy(100)->dividedBy($net, 2, RoundingMode::HALF_UP) : '0.00',
        ];
    }
}
