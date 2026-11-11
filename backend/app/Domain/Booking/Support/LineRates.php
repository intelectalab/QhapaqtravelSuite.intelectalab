<?php

declare(strict_types=1);

namespace App\Domain\Booking\Support;

use App\Domain\Booking\Data\ProductData;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Money\Decimal;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

final class LineRates
{
    private const COLUMNS = ['id', 'ref', 'product_id', 'rate_type', 'segment', 'channel', 'currency', 'price', 'cost', 'valid_from', 'valid_to', 'status', 'season_id'];

    public function __construct(private readonly TenantBookingEngine $engines) {}

    public function catalog(iterable $productIds): Collection
    {
        $ids = collect($productIds)->filter()->unique()->values();

        if ($ids->isEmpty()) {
            return collect();
        }

        return DB::table('catalog_rates')->whereIn('product_id', $ids)
            ->orderByRaw("case when rate_type = 'Venta' then 0 else 1 end")->orderBy('valid_from')->orderBy('price')
            ->get(self::COLUMNS)->groupBy('product_id');
    }

    public function find(string $rateId, string $productId): object
    {
        if (preg_match('/^[0-9a-f-]{36}$/i', $rateId) !== 1) {
            throw ApiException::unprocessable('PRD-BR-005', 'La tarifa elegida no existe.');
        }

        return DB::table('catalog_rates')->where('id', $rateId)->where('product_id', $productId)->first(self::COLUMNS)
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
        $valid = $rates->filter(fn (object $rate): bool => self::valid($rate, $date))->values();
        $wanted = $segment === 'Adulto' && ! $valid->contains('segment', 'Adulto') ? 'Pasajero' : $segment;
        $bySegment = $valid->where('segment', $wanted);

        return $bySegment->firstWhere('channel', $channel)
            ?? $bySegment->firstWhere('channel', 'Directo')
            ?? $valid->first(fn (object $rate): bool => $rate->channel === $channel && $rate->segment !== 'Niño')
            ?? $valid->first(fn (object $rate): bool => $rate->channel === 'Directo' && $rate->segment !== 'Niño')
            ?? $valid->first();
    }

    public function price(string $productId, object $rate, string $segment, string $date, string $currency, iterable $companions = []): ?array
    {
        $base = $this->engines->product($productId, $date);
        $rows = [];

        foreach ([$rate, ...collect($companions)->all()] as $row) {
            $rows[] = ['segment' => $row->segment, 'channel' => $row->channel, 'currency' => trim((string) $row->currency), 'price' => (string) $row->price, 'cost' => (string) $row->cost, 'status' => 'vigente'];
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

    public function seasonFactor(string $date): ?string
    {
        $factor = DB::table('catalog_seasons')->whereNull('deleted_at')->where('status', 'activa')
            ->where('date_from', '<=', $date)->where('date_to', '>=', $date)->orderBy('priority')->value('factor');

        return $factor === null ? null : (string) $factor;
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
