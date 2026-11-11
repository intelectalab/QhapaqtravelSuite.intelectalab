<?php

declare(strict_types=1);

namespace App\Domain\Finance\Support;

use App\Domain\Shared\Money\Decimal;
use Brick\Math\BigDecimal;

final class NetSales
{
    public static function of(BigDecimal|string|float|int|null $amount, ?string $currency): BigDecimal
    {
        $value = Decimal::of((string) ($amount ?? 0));

        return $currency === 'PEN' ? Decimal::withoutIgv($value) : $value->toScale(2);
    }
}
