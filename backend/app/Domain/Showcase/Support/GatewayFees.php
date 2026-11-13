<?php

declare(strict_types=1);

namespace App\Domain\Showcase\Support;

use App\Domain\Shared\Money\Decimal;
use Brick\Math\BigDecimal;
use Brick\Math\RoundingMode;

final class GatewayFees
{
    public const IGV_PCT = '18';

    public static function estimate(object $account, BigDecimal|string $gross, string $currency): array
    {
        $gross = Decimal::money($gross);
        $fee = $gross->multipliedBy(Decimal::of($account->fee_pct))->dividedBy(100, 2, RoundingMode::HALF_UP);

        if ($account->fee_currency === $currency) {
            $fee = $fee->plus(Decimal::money($account->fee_fixed));
        }

        $tax = $account->tax_on_fee ? $fee->multipliedBy(self::IGV_PCT)->dividedBy(100, 2, RoundingMode::HALF_UP) : BigDecimal::zero()->toScale(2);
        $spread = $currency !== $account->currency ? $gross->multipliedBy(Decimal::of($account->fx_spread_pct))->dividedBy(100, 2, RoundingMode::HALF_UP) : BigDecimal::zero()->toScale(2);

        return self::totals($gross, $fee, $tax, $spread);
    }

    public static function totals(BigDecimal $gross, BigDecimal $fee, BigDecimal $tax, BigDecimal $spread): array
    {
        return [
            'gross' => (string) $gross->toScale(2),
            'fee' => (string) $fee->toScale(2),
            'fee_tax' => (string) $tax->toScale(2),
            'fx_spread' => (string) $spread->toScale(2),
            'net' => (string) $gross->minus($fee)->minus($tax)->minus($spread)->toScale(2),
        ];
    }
}
