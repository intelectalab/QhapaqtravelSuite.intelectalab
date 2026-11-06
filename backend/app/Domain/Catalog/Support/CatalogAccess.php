<?php

declare(strict_types=1);

namespace App\Domain\Catalog\Support;

use App\Domain\Iam\Models\User;
use Illuminate\Support\Carbon;

final class CatalogAccess
{
    public const CURRENCIES = ['PEN', 'USD'];

    public static function today(): string
    {
        return Carbon::now('America/Lima')->toDateString();
    }

    public static function daysUntil(string $date): int
    {
        return (int) Carbon::parse(self::today())->diffInDays(Carbon::parse($date), false);
    }

    public static function seesCost(User $user): bool
    {
        return $user->canAny(['catalog.products.view_profitability', 'catalog.products.manage_availability', 'catalog.providers.manage', 'catalog.products.update', 'catalog.products.manage_rates']);
    }

    public static function seesMargin(User $user): bool
    {
        return $user->can('catalog.products.view_profitability');
    }

    public static function seesNetRates(User $user): bool
    {
        return $user->canAny(['catalog.products.view_profitability', 'catalog.products.manage_rates', 'channels.b2b.manage']);
    }

    public static function marginPct(float|string|null $price, float|string|null $cost): ?float
    {
        $price = (float) $price;

        return $price > 0 && $cost !== null ? round(($price - (float) $cost) / $price * 100, 1) : null;
    }
}
