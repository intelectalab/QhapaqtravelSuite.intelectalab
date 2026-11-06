<?php

declare(strict_types=1);

namespace App\Domain\Quotes\Support;

final class QuotePricing
{
    public const MAX_DISCOUNT = 10.0;

    public static function totals(array $items, float $discountPct, float $taxPct): array
    {
        $cost = 0.0;
        $sale = 0.0;

        foreach ($items as $item) {
            $units = (float) $item['qty'] * (float) $item['pax'];
            $cost += round((float) $item['unit_cost'] * $units, 2);
            $sale += round((float) $item['unit_price'] * $units, 2);
        }

        $discount = round($sale * $discountPct / 100, 2);
        $net = round($sale - $discount, 2);
        $tax = round($net * $taxPct / 100, 2);
        $profit = round($net - $cost, 2);

        return [
            'cost_total' => round($cost, 2),
            'sale_total' => round($sale, 2),
            'discount_total' => $discount,
            'net_total' => $net,
            'tax_total' => $tax,
            'grand_total' => round($net + $tax, 2),
            'profit_total' => $profit,
            'margin_pct' => $net > 0 ? round($profit / $net * 100, 2) : 0.0,
        ];
    }
}
