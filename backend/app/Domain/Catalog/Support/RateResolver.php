<?php

declare(strict_types=1);

namespace App\Domain\Catalog\Support;

use Brick\Math\BigDecimal;

final class RateResolver
{
    public const NON_SALE_TYPES = ['Proveedor', 'Costo'];

    public const PUBLIC_TYPES = ['Venta', 'Retail', 'Promocional'];

    public const ALL_CHANNELS = 'Todos';

    public const FALLBACK_CHANNEL = 'Directo';

    public static function pick(iterable $rates, ?string $date, array $segments, string $channel, ?string $seasonId = null): array|object|null
    {
        $best = null;
        $bestKey = null;

        foreach ($rates as $rate) {
            $key = self::rank($rate, $date, $segments, $channel, $seasonId);

            if ($key !== null && ($bestKey === null || $key < $bestKey)) {
                $best = $rate;
                $bestKey = $key;
            }
        }

        return $best;
    }

    public static function channelRank(string $rateChannel, string $channel): ?int
    {
        return match (true) {
            $rateChannel === $channel => 0,
            $rateChannel === self::ALL_CHANNELS => 1,
            $rateChannel === self::FALLBACK_CHANNEL => 2,
            default => null,
        };
    }

    public static function isSale(array|object $rate): bool
    {
        $type = self::field($rate, 'rate_type');

        return $type === null || ! in_array((string) $type, self::NON_SALE_TYPES, true);
    }

    public static function base(array|object $rate, string $field = 'price'): BigDecimal
    {
        return BigDecimal::of((string) self::field($rate, $field));
    }

    public static function seasonal(array|object $rate, ?string $dateFactor, string $field = 'price'): BigDecimal
    {
        $base = self::base($rate, $field);

        return $dateFactor === null ? $base : $base->multipliedBy($dateFactor);
    }

    private static function rank(array|object $rate, ?string $date, array $segments, string $channel, ?string $seasonId): ?array
    {
        $status = self::field($rate, 'status');

        if (($status !== null && $status !== 'vigente') || ! self::isSale($rate)) {
            return null;
        }

        $from = self::field($rate, 'valid_from');
        $to = self::field($rate, 'valid_to');

        if ($date !== null && (($from !== null && (string) $from > $date) || ($to !== null && (string) $to < $date))) {
            return null;
        }

        $segment = array_search((string) self::field($rate, 'segment'), $segments, true);
        $channelRank = self::channelRank((string) self::field($rate, 'channel'), $channel);

        if ($segment === false || $channelRank === null) {
            return null;
        }

        $season = $seasonId !== null && (string) self::field($rate, 'season_id') === $seasonId ? 0 : 1;
        $rateType = self::field($rate, 'rate_type');
        $type = $rateType === null || in_array((string) $rateType, self::PUBLIC_TYPES, true) ? 0 : 1;

        return [$channelRank, $segment, $season, $type, (float) self::field($rate, 'price')];
    }

    private static function field(array|object $rate, string $key): mixed
    {
        return is_array($rate) ? ($rate[$key] ?? null) : ($rate->{$key} ?? null);
    }
}
