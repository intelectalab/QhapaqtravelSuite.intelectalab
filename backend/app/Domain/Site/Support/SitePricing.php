<?php

declare(strict_types=1);

namespace App\Domain\Site\Support;

use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use stdClass;

final class SitePricing
{
    private const WEB_CHANNELS = ['E-commerce'];

    private const PUBLIC_CHANNELS = ['Directo', 'Todos'];

    private const RETAIL_TYPES = ['Venta', 'Retail', 'Promocional', 'Especial', 'VIP'];

    private ?Collection $seasons = null;

    private array $rates = [];

    public function load(array $productIds): void
    {
        $missing = array_values(array_diff($productIds, array_keys($this->rates)));

        if ($missing === []) {
            return;
        }

        $rows = DB::table('catalog_rates')->whereIn('product_id', $missing)->where('status', 'vigente')
            ->whereIn('channel', [...self::WEB_CHANNELS, ...self::PUBLIC_CHANNELS])
            ->whereIn('rate_type', self::RETAIL_TYPES)
            ->whereIn('segment', ['Adulto', 'Pasajero', 'Niño'])
            ->get(['id', 'product_id', 'segment', 'channel', 'currency', 'price_basis', 'price', 'valid_from', 'valid_to', 'season_id']);

        foreach ($missing as $id) {
            $this->rates[$id] = $rows->where('product_id', $id)->values();
        }
    }

    public function seasonFor(string $date): ?stdClass
    {
        return $this->seasons()
            ->filter(fn (stdClass $season): bool => $season->date_from <= $date && $season->date_to >= $date)
            ->sortBy([['priority', 'asc'], ['span', 'asc']])
            ->first();
    }

    public function seasons(): Collection
    {
        return $this->seasons ??= DB::table('catalog_seasons')->whereNull('deleted_at')->where('status', 'activa')
            ->get(['id', 'name', 'type', 'date_from', 'date_to', 'priority', 'factor'])
            ->map(function (stdClass $season): stdClass {
                $season->span = (strtotime($season->date_to) - strtotime($season->date_from)) / 86400;
                $season->factor = (float) $season->factor;

                return $season;
            });
    }

    public function quote(string $productId, string $date): ?array
    {
        $this->load([$productId]);
        $rates = $this->rates[$productId]->filter(fn (stdClass $rate): bool => $rate->valid_from <= $date && $rate->valid_to >= $date);
        $adult = $this->pick($rates, ['Adulto', 'Pasajero'], self::WEB_CHANNELS) ?? $this->pick($rates, ['Adulto', 'Pasajero'], self::PUBLIC_CHANNELS);

        if ($adult === null) {
            return null;
        }

        $season = $this->seasonFor($date);
        $child = $this->pick($rates, ['Niño'], [$adult->channel]) ?? $this->pick($rates, ['Niño'], self::PUBLIC_CHANNELS);
        $direct = in_array($adult->channel, self::WEB_CHANNELS, true) ? $this->pick($rates, ['Adulto', 'Pasajero'], self::PUBLIC_CHANNELS) : null;
        $adultPrice = $this->apply($adult, $season);
        $listPrice = $direct && $direct->currency === $adult->currency ? $this->apply($direct, $season) : null;

        return [
            'rate_id' => $adult->id,
            'currency' => $adult->currency,
            'basis' => $adult->price_basis,
            'adult' => $adultPrice,
            'child' => $child && $child->currency === $adult->currency ? $this->apply($child, $season) : $adultPrice,
            'list' => $listPrice !== null && $listPrice > $adultPrice ? $listPrice : null,
            'web_rate' => in_array($adult->channel, self::WEB_CHANNELS, true),
            'season' => $season ? ['name' => $season->name, 'type' => $season->type, 'factor' => $season->factor, 'level' => $this->level($season)] : null,
        ];
    }

    public function level(stdClass $season): string
    {
        return match (true) {
            in_array($season->type, ['Fecha especial', 'Feriado'], true) => 'especial',
            $season->factor > 1.05 || $season->type === 'Alta' => 'alta',
            $season->factor < 0.95 || $season->type === 'Baja' => 'baja',
            default => 'media',
        };
    }

    private function pick(Collection $rates, array $segments, array $channels): ?stdClass
    {
        return $rates->filter(fn (stdClass $rate): bool => in_array($rate->segment, $segments, true) && in_array($rate->channel, $channels, true))
            ->sortBy(fn (stdClass $rate): float => (float) $rate->price)
            ->first();
    }

    private function apply(stdClass $rate, ?stdClass $season): float
    {
        $base = $rate->season_id ? ($this->seasons()->firstWhere('id', $rate->season_id)->factor ?? 1.0) : 1.0;
        $factor = $season ? $season->factor / ($base ?: 1.0) : 1.0;

        return round(round((float) $rate->price * $factor * 10) / 10, 2);
    }
}
