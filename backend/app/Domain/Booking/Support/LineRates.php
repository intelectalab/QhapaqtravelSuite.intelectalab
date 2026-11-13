<?php

declare(strict_types=1);

namespace App\Domain\Booking\Support;

use App\Domain\Booking\Data\ProductData;
use App\Domain\Booking\Rules\RuleResolver;
use App\Domain\Catalog\Support\RateResolver;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Money\Decimal;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

final class LineRates
{
    private const COLUMNS = ['r.id', 'r.ref', 'r.product_id', 'r.rate_type', 'r.segment', 'r.channel', 'r.currency', 'r.price', 'r.cost', 'r.valid_from', 'r.valid_to', 'r.status', 'r.season_id'];

    private array $seasons = [];

    public function __construct(private readonly TenantBookingEngine $engines, private readonly RuleResolver $rules) {}

    public function catalog(iterable $productIds): Collection
    {
        $ids = collect($productIds)->filter()->unique()->values();

        if ($ids->isEmpty()) {
            return collect();
        }

        return self::query()->whereIn('r.product_id', $ids)
            ->orderByRaw("case when r.rate_type = 'Venta' then 0 else 1 end")->orderBy('r.valid_from')->orderBy('r.price')
            ->get(self::COLUMNS)->groupBy('product_id');
    }

    public function find(string $rateId, string $productId): object
    {
        if (preg_match('/^[0-9a-f-]{36}$/i', $rateId) !== 1) {
            throw ApiException::unprocessable('PRD-BR-005', 'La tarifa elegida no existe.');
        }

        return self::query()->where('r.id', $rateId)->where('r.product_id', $productId)->first(self::COLUMNS)
            ?? throw ApiException::unprocessable('PRD-BR-005', 'La tarifa elegida no es de este producto.');
    }

    public static function valid(object $rate, string $date): bool
    {
        return $rate->status === 'vigente' && (string) $rate->valid_from <= $date && (string) $rate->valid_to >= $date;
    }

    public static function channelFor(?string $segment): string
    {
        return match (mb_strtolower(trim((string) $segment))) {
            'corporativo', 'grupos' => 'Corporativo',
            'b2b', 'agencia aliada' => 'B2B',
            default => 'Directo',
        };
    }

    public function pick(Collection $rates, string $date, string $segment, string $channel): ?object
    {
        $valid = $rates->filter(fn (object $rate): bool => self::valid($rate, $date) && RateResolver::isSale($rate))->values();
        $wanted = $segment === 'Adulto' && ! $valid->contains('segment', 'Adulto') ? 'Pasajero' : $segment;
        $season = $this->seasonIdFor($date);
        $others = array_values(array_diff(['Adulto', 'Pasajero', 'Grupo', 'Infante'], [$wanted]));

        $rate = RateResolver::pick($valid, $date, [$wanted], $channel, $season)
            ?? ($segment === 'Niño' ? null : RateResolver::pick($valid, $date, $others, $channel, $season))
            ?? $valid->first();

        return is_object($rate) ? $rate : null;
    }

    public function price(string $productId, object $rate, string $segment, string $date, string $currency, iterable $companions = []): ?array
    {
        $base = $this->engines->product($productId, $date);
        $rows = [];

        foreach ([$rate, ...collect($companions)->all()] as $row) {
            $rows[] = ['segment' => $row->segment, 'channel' => $row->channel, 'currency' => trim((string) $row->currency), 'price' => (string) $row->price, 'cost' => (string) $row->cost, 'status' => 'vigente', 'rate_type' => $row->rate_type ?? null, 'season_id' => $row->season_id ?? null];
        }
        $product = new ProductData(
            id: $base->id,
            code: $base->code,
            maxPax: $base->maxPax,
            ranges: $base->ranges,
            departures: $base->departures,
            hasAvailabilityConfig: $base->hasAvailabilityConfig,
            operatingWeekdays: $base->operatingWeekdays,
            cutoffHours: $base->cutoffHours,
            advanceMinDays: $base->advanceMinDays,
            paxRules: $base->paxRules,
            ruleOverrides: $base->ruleOverrides,
            ruleParams: $base->ruleParams,
            rates: $rows,
        );
        $engine = $this->engines->engine();
        $result = $engine->segmentPrice($product, $segment, $date, $currency, (string) $rate->channel)
            ?? ($segment === (string) $rate->segment ? null : $engine->segmentPrice($product, (string) $rate->segment, $date, $currency, (string) $rate->channel));

        return $result === null ? null : [
            'price' => (string) Decimal::round2($result['price']->getAmount()),
            'cost' => (string) Decimal::round2($result['cost']->getAmount()),
        ];
    }

    public function activeSeason(string $date): ?object
    {
        if (! array_key_exists($date, $this->seasons)) {
            $this->seasons[$date] = $this->rules->on('R-SEASON')
                ? DB::table('catalog_seasons')->whereNull('deleted_at')->where('status', 'activa')
                    ->where('date_from', '<=', $date)->where('date_to', '>=', $date)->orderBy('priority')->first(['id', 'factor'])
                : null;
        }

        return $this->seasons[$date];
    }

    public function seasonIdFor(string $date): ?string
    {
        $season = $this->activeSeason($date);

        return $season === null ? null : (string) $season->id;
    }

    public function seasonFactor(string $date): ?string
    {
        $season = $this->activeSeason($date);

        return $season === null ? null : (string) $season->factor;
    }

    private static function query(): Builder
    {
        return DB::table('catalog_rates as r');
    }

    public static function snapshot(object $rate, array $priced): array
    {
        return [
            'id' => $rate->id,
            'ref' => $rate->ref,
            'type' => $rate->rate_type,
            'segment' => $rate->segment,
            'channel' => $rate->channel,
            'currency' => trim((string) $rate->currency),
            'price' => (string) $rate->price,
            'cost' => (string) $rate->cost,
            'valid_from' => (string) $rate->valid_from,
            'valid_to' => (string) $rate->valid_to,
            'suggested_price' => $priced['price'],
            'suggested_cost' => $priced['cost'],
        ];
    }

    public static function option(object $rate, bool $seeCost): array
    {
        return [
            'id' => $rate->id,
            'ref' => $rate->ref,
            'type' => $rate->rate_type,
            'segment' => $rate->segment,
            'channel' => $rate->channel,
            'currency' => trim((string) $rate->currency),
            'price' => (string) $rate->price,
            'cost' => $seeCost ? (string) $rate->cost : null,
            'valid_from' => (string) $rate->valid_from,
            'valid_to' => (string) $rate->valid_to,
            'active' => $rate->status === 'vigente',
        ];
    }
}
