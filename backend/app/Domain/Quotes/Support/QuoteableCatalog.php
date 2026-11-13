<?php

declare(strict_types=1);

namespace App\Domain\Quotes\Support;

use App\Domain\Booking\Support\LineRates;
use App\Domain\Crm\Support\Portfolio;
use App\Domain\Iam\Models\User;
use App\Domain\Quotes\Actions\QuoteBuilder;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Money\Decimal;
use Brick\Math\BigDecimal;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class QuoteableCatalog
{
    public function __construct(private readonly LineRates $lineRates, private readonly QuoteBuilder $builder) {}

    public function picker(string $date, string $currency, User $viewer): array
    {
        $products = DB::table('catalog_products')->whereNull('deleted_at')->orderBy('name')->get(['id', 'code', 'name', 'status', 'is_quoteable', 'duration_value', 'duration_unit']);
        $catalog = $this->lineRates->catalog($products->pluck('id'));
        $seeCost = QuoteBuilder::seesCost($viewer);
        $fx = null;

        $items = $products->map(function (object $product) use ($catalog, $date, $currency, $seeCost, &$fx): array {
            $valid = collect($catalog->get($product->id, []))->filter(fn (object $rate): bool => LineRates::valid($rate, $date))->values();
            $from = $valid->filter(fn (object $rate): bool => $rate->rate_type === 'Venta' && $rate->segment !== 'Niño')
                ->map(function (object $rate) use ($currency, &$fx): BigDecimal {
                    $rateCurrency = trim((string) $rate->currency);
                    $fx ??= $rateCurrency === $currency ? null : $this->builder->fx('USD');

                    return Decimal::round2(Decimal::convert((string) $rate->price, $rateCurrency, $currency, $fx ?? '1'));
                })
                ->sort(fn (BigDecimal $a, BigDecimal $b): int => $a->compareTo($b))->first();

            return [
                'id' => $product->id,
                'code' => $product->code,
                'name' => $product->name,
                'status' => $product->status,
                'duration' => rtrim(rtrim((string) $product->duration_value, '0'), '.').' '.$product->duration_unit,
                'blocked_reason' => $this->blockedReason($product, $valid),
                'from' => $from === null ? null : ['amount' => Decimal::toApi($from), 'currency' => $currency],
                'rates' => $valid->map(fn (object $rate): array => LineRates::option($rate, $seeCost))->all(),
            ];
        });

        return [
            'date' => $date,
            'currency' => $currency,
            'products' => $items->values()->all(),
            'quoteable' => $items->whereNull('blocked_reason')->count(),
        ];
    }

    public function suggestion(object $product, array $data, User $viewer): array
    {
        $date = (string) $data['date'];
        $currency = (string) $data['currency'];
        $rates = collect($this->lineRates->catalog([$product->id])->get($product->id, []));
        $blocked = $this->blockedReason($product, $rates->filter(fn (object $rate): bool => LineRates::valid($rate, $date)));

        if ($product->status !== 'ACTIVE' || ! $product->is_quoteable) {
            throw ApiException::unprocessable('QTE-BR-05', (string) $blocked, ['product' => [(string) $blocked]]);
        }

        $client = $this->client($data['client_id'] ?? null, $viewer);
        $channel = LineRates::channelFor($client?->segment_code);

        if (! empty($data['rate_id'])) {
            $rate = $this->lineRates->find((string) $data['rate_id'], (string) $product->id);

            if (! LineRates::valid($rate, $date)) {
                throw ApiException::unprocessable('PRD-BR-005', "La tarifa {$rate->ref} no está vigente en esa fecha. Elige otra tarifa.", ['rate_id' => ["La tarifa {$rate->ref} no está vigente en esa fecha."]]);
            }
        } else {
            $rate = $this->lineRates->pick($rates, $date, 'Adulto', $channel);
        }

        $seeCost = QuoteBuilder::seesCost($viewer);
        $segment = $rate !== null && $rate->segment === 'Niño' ? 'Niño' : 'Adulto';
        $companions = $rate === null ? [] : $rates->filter(fn (object $other): bool => $other->id !== $rate->id && $other->segment === 'Niño' && LineRates::valid($other, $date) && in_array($other->channel, [$rate->channel, 'Directo'], true));
        $priced = $rate === null ? null : $this->lineRates->price((string) $product->id, $rate, $segment, $date, $currency, $companions);

        return [
            'product' => ['id' => $product->id, 'code' => $product->code, 'name' => $product->name],
            'date' => $date,
            'currency' => $currency,
            'channel' => $channel,
            'client' => $client === null ? null : ['code' => $client->code, 'name' => $client->name],
            'segment' => $segment,
            'rate' => $rate === null ? null : LineRates::option($rate, $seeCost),
            'unit_price' => $priced['price'] ?? null,
            'unit_cost' => $seeCost ? ($priced['cost'] ?? null) : null,
            'season_factor' => $this->lineRates->seasonFactor($date),
            'manual' => $priced === null,
            'message' => $priced === null ? 'No hay tarifa vigente para esa fecha: ingresa el precio manualmente.' : null,
            'rates' => $rates->map(fn (object $row): array => [
                ...LineRates::option($row, $seeCost),
                'selectable' => LineRates::valid($row, $date),
                'disabled_reason' => LineRates::valid($row, $date) ? null : 'No vigente (PRD-BR-005)',
            ])->values()->all(),
        ];
    }

    private function blockedReason(object $product, Collection $validRates): ?string
    {
        return match (true) {
            $product->status !== 'ACTIVE' => "{$product->name} no está activo para cotizar (PRD-BR-002).",
            ! $product->is_quoteable => "{$product->name} no está habilitado para cotizaciones (PRD-BR-002).",
            $validRates->isEmpty() => "{$product->name} no tiene tarifas vigentes en esa fecha (PRD-BR-005).",
            default => null,
        };
    }

    private function client(?string $reference, User $viewer): ?object
    {
        if ($reference === null || $reference === '') {
            return null;
        }

        return Portfolio::clients(DB::table('crm_clients')->whereNull('deleted_at'), $viewer)->where(Str::isUuid($reference) ? 'id' : 'code', $reference)->first(['id', 'code', 'name', 'segment_code'])
            ?? throw ApiException::unprocessable('VALIDATION_ERROR', 'El cliente no existe o no está en tu cartera.', ['client_id' => ['El cliente no existe o no está en tu cartera.']]);
    }
}
