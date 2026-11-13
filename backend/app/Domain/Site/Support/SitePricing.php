<?php

declare(strict_types=1);

namespace App\Domain\Site\Support;

use App\Domain\Admin\Support\PriceRounding;
use App\Domain\Booking\Rules\RuleResolver;
use App\Domain\Catalog\Support\RateResolver;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use stdClass;

final class SitePricing
{
    private const WEB_CHANNELS = ['E-commerce'];

    private const PUBLIC_CHANNELS = ['Directo', 'Todos'];

    private const RETAIL_TYPES = ['Venta', 'Retail', 'Promocional', 'Especial', 'VIP'];

    private ?Collection $seasons = null;

    private ?bool $seasonsOn = null;

    public function __construct(private readonly RuleResolver $rules) {}

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
        if (! ($this->seasonsOn ??= $this->rules->on('R-SEASON'))) {
            return null;
        }

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
                $season->exact = (string) $season->factor;
                $season->factor = (float) $season->factor;

                return $season;
            });
    }

    public function quote(string $productId, string $date): ?array
    {
        $this->load([$productId]);
        $rates = $this->rates[$productId]->filter(fn (stdClass $rate): bool => $rate->valid_from <= $date && $rate->valid_to >= $date);
        $season = $this->seasonFor($date);
        $seasonId = $season?->id === null ? null : (string) $season->id;
        $adult = RateResolver::pick($rates, $date, ['Adulto', 'Pasajero'], self::WEB_CHANNELS[0], $seasonId);

        if (! $adult instanceof stdClass) {
            return null;
        }

        $child = RateResolver::pick($rates, $date, ['Niño'], (string) $adult->channel, $seasonId);
        $direct = in_array($adult->channel, self::WEB_CHANNELS, true) ? RateResolver::pick($rates, $date, ['Adulto', 'Pasajero'], RateResolver::FALLBACK_CHANNEL, $seasonId) : null;
        $child = $child instanceof stdClass ? $child : null;
        $direct = $direct instanceof stdClass ? $direct : null;
        $adultPrice = $this->apply($adult, $season);
        $seasonDiscount = $season !== null && $season->factor < 1 ? (int) round((1 - $season->factor) * 100) : null;
        $listPrice = max(
            $direct && $direct->currency === $adult->currency ? $this->apply($direct, $season) : 0.0,
            $seasonDiscount !== null ? $this->apply($direct && $direct->currency === $adult->currency ? $direct : $adult, null) : 0.0,
        ) ?: null;

        return [
            'rate_id' => $adult->id,
            'currency' => $adult->currency,
            'basis' => $adult->price_basis,
            'adult' => $adultPrice,
            'child' => $child && $child->currency === $adult->currency ? $this->apply($child, $season) : $adultPrice,
            'list' => $listPrice !== null && $listPrice > $adultPrice ? $listPrice : null,
            'web_rate' => in_array($adult->channel, self::WEB_CHANNELS, true),
            'season' => $season ? ['name' => $season->name, 'type' => $season->type, 'factor' => $season->factor, 'level' => $this->level($season), 'discount_pct' => $seasonDiscount] : null,
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

    private function apply(stdClass $rate, ?stdClass $season): float
    {
        $price = RateResolver::seasonal($rate, $season?->exact === null ? null : (string) $season->exact);

        return app(PriceRounding::class)->apply($price)->toFloat();
    }
}
