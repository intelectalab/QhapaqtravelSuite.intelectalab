<?php

declare(strict_types=1);

namespace App\Domain\Site\Support;

use stdClass;

final class SitePromotions
{
    public const PERCENT_KINDS = ['Descuento %', 'Descuento por cantidad', 'Código promocional', 'Promoción por temporada', 'Promoción por canal', 'Promoción por fecha'];

    public const FIXED_KINDS = ['Descuento fijo'];

    public static function best(stdClass $product, int $seats, ?string $code, string $currency): ?array
    {
        $code = $code ? strtoupper(trim($code)) : null;

        $promotion = collect($product->promotions ?? [])
            ->filter(fn (array $p): bool => in_array($p['kind'], [...self::PERCENT_KINDS, ...self::FIXED_KINDS], true))
            ->filter(fn (array $p): bool => $p['code'] === null ? ($p['min_pax'] === null || $seats >= $p['min_pax']) : $p['code'] === $code)
            ->sortByDesc('value')
            ->first();

        if ($promotion === null) {
            return null;
        }

        return [
            'label' => (string) $promotion['name'],
            'percent' => in_array($promotion['kind'], self::PERCENT_KINDS, true),
            'value' => number_format((float) $promotion['value'], 2, '.', ''),
            'currency' => $currency,
            'code' => $promotion['code'],
        ];
    }
}
