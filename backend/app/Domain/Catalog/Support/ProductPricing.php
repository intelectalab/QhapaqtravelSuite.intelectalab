<?php

declare(strict_types=1);

namespace App\Domain\Catalog\Support;

use App\Domain\Booking\Support\LineRates;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Money\Decimal;
use Brick\Math\BigDecimal;
use Brick\Math\RoundingMode;
use Illuminate\Support\Facades\DB;

final class ProductPricing
{
    public function __construct(private readonly LineRates $rates) {}

    public function priceQuote(object $product, array $data, User $viewer): array
    {
        $date = (string) ($data['date'] ?? CatalogAccess::today());
        $pax = (int) ($data['pax'] ?? 1);
        $rate = $this->sellableRate((string) $product->id, (string) $data['rate_id'], $date, $viewer);
        $groups = DB::table('catalog_product_config_groups')->where('product_id', $product->id)->orderBy('sort_order')->get(['id', 'name']);
        $options = DB::table('catalog_product_config_options')->whereIn('group_id', $groups->pluck('id'))->orderBy('sort_order')->get(['id', 'group_id', 'label', 'price_delta'])->groupBy('group_id');
        $chosen = [];
        $deltas = BigDecimal::zero()->toScale(2);

        foreach ((array) ($data['selections'] ?? []) as $groupKey => $optionKey) {
            $group = $groups->first(fn (object $row) => $row->id === (string) $groupKey || mb_strtolower($row->name) === mb_strtolower(trim((string) $groupKey)))
                ?? throw ApiException::unprocessable('CAT-BR-30', "El producto no tiene la opción «{$groupKey}».", ['selections' => ["El producto no tiene la opción «{$groupKey}»."]]);
            $option = collect($options->get($group->id, []))->first(fn (object $row) => $row->id === (string) $optionKey || mb_strtolower($row->label) === mb_strtolower(trim((string) $optionKey)))
                ?? throw ApiException::unprocessable('CAT-BR-30', "«{$optionKey}» no es una elección válida de {$group->name}.", ['selections' => ["«{$optionKey}» no es una elección válida de {$group->name}."]]);
            $deltas = $deltas->plus(Decimal::money((string) $option->price_delta));
            $chosen[] = ['group' => $group->name, 'option' => $option->label, 'delta' => Decimal::toApi((string) $option->price_delta)];
        }

        $base = Decimal::money((string) $rate->price);
        $unit = Decimal::round2($base->plus($deltas));

        return [
            'product' => ['id' => $product->id, 'code' => $product->code, 'name' => $product->name],
            'rate' => ['id' => $rate->id, 'ref' => $rate->ref, 'type' => $rate->rate_type, 'segment' => $rate->segment, 'channel' => $rate->channel],
            'date' => $date,
            'pax' => $pax,
            'channel' => $data['channel'] ?? $rate->channel,
            'currency' => trim((string) $rate->currency),
            'base_price' => Decimal::toApi($base),
            'selections' => $chosen,
            'options_delta' => Decimal::toApi($deltas),
            'unit_price' => Decimal::toApi($unit),
            'total' => Decimal::toApi(Decimal::round2($unit->multipliedBy($pax))),
        ];
    }

    public function profitability(object $product, array $data): array
    {
        $today = CatalogAccess::today();
        $rows = DB::table('catalog_rates')->where('product_id', $product->id)->orderByDesc('status')->orderBy('rate_type')->orderBy('ref')
            ->get(['id', 'ref', 'rate_type', 'segment', 'channel', 'currency', 'cost', 'price', 'status', 'valid_from', 'valid_to']);
        $current = $rows->filter(fn (object $rate) => RateDirectory::state($rate, $today) === 'vigente');
        $rate = isset($data['rate_id'])
            ? ($rows->firstWhere('id', (string) $data['rate_id']) ?? throw ApiException::unprocessable('PRD-BR-005', 'La tarifa elegida no es de este producto.', ['rate_id' => ['La tarifa elegida no es de este producto.']]))
            : ($current->firstWhere('rate_type', 'Venta') ?? $current->first());

        return [
            'product' => ['id' => $product->id, 'code' => $product->code, 'name' => $product->name],
            'breakdown' => $rate === null ? null : $this->breakdown($rate, (int) ($data['pax'] ?? 1), (string) ($data['other_cost'] ?? '0'), (string) ($data['commission_pct'] ?? '0'), $today),
            'rates' => $rows->map(fn (object $row) => [
                'id' => $row->id,
                'ref' => $row->ref,
                'type' => $row->rate_type,
                'segment' => $row->segment,
                'channel' => $row->channel,
                'currency' => trim((string) $row->currency),
                'cost' => Decimal::toApi((string) $row->cost),
                'price' => Decimal::toApi((string) $row->price),
                'margin' => Decimal::toApi(Decimal::money((string) $row->price)->minus(Decimal::money((string) $row->cost))),
                'margin_pct' => CatalogAccess::marginPct($row->price, $row->cost),
                'state' => RateDirectory::state($row, $today),
                'valid_from' => $row->valid_from,
                'valid_to' => $row->valid_to,
            ])->values(),
            'formula' => 'Utilidad = venta − costo proveedor − otros costos − comisión, por pasajero × pasajeros (CAT-BR-41).',
        ];
    }

    private function breakdown(object $rate, int $pax, string $otherCost, string $commissionPct, string $today): array
    {
        $sale = Decimal::money((string) $rate->price)->multipliedBy($pax);
        $cost = Decimal::money((string) $rate->cost)->multipliedBy($pax);
        $other = Decimal::money($otherCost)->multipliedBy($pax);
        $commission = Decimal::round2($sale->multipliedBy(BigDecimal::of($commissionPct))->dividedBy(100, 6, RoundingMode::HALF_UP));
        $profit = $sale->minus($cost)->minus($other)->minus($commission);

        return [
            'rate' => ['id' => $rate->id, 'ref' => $rate->ref, 'type' => $rate->rate_type, 'segment' => $rate->segment, 'channel' => $rate->channel, 'state' => RateDirectory::state($rate, $today)],
            'currency' => trim((string) $rate->currency),
            'pax' => $pax,
            'commission_pct' => (string) BigDecimal::of($commissionPct)->strippedOfTrailingZeros(),
            'sale' => Decimal::toApi($sale),
            'provider_cost' => Decimal::toApi($cost),
            'other_costs' => Decimal::toApi($other),
            'commission' => Decimal::toApi($commission),
            'profit' => Decimal::toApi($profit),
            'margin_pct' => $sale->isZero() ? null : $profit->multipliedBy(100)->dividedBy($sale, 1, RoundingMode::HALF_UP)->toFloat(),
        ];
    }

    private function sellableRate(string $productId, string $rateId, string $date, User $viewer): object
    {
        $rate = $this->rates->find($rateId, $productId);

        if (! CatalogAccess::seesNetRates($viewer) && RateDirectory::isNet((string) $rate->rate_type, (string) $rate->channel)) {
            throw ApiException::unprocessable('PRD-BR-005', 'La tarifa elegida no está disponible para tu rol.', ['rate_id' => ['La tarifa elegida no está disponible para tu rol.']]);
        }

        if (! LineRates::valid($rate, $date)) {
            throw ApiException::unprocessable('PRD-BR-005', 'La tarifa no está vigente en esa fecha.', ['rate_id' => ['La tarifa no está vigente en esa fecha.']]);
        }

        return $rate;
    }
}
