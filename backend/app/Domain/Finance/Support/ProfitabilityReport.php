<?php

declare(strict_types=1);

namespace App\Domain\Finance\Support;

use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Money\Decimal;
use Brick\Math\RoundingMode;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

final class ProfitabilityReport
{
    private const KINDS = ['alojamiento' => 'Alojamiento', 'tour' => 'Tours y excursiones', 'traslado' => 'Traslados', 'tren_entrada' => 'Trenes y entradas', 'libre' => 'Otros servicios'];

    public const LIGHTS = ['r' => 'bad', 'a' => 'warn', 'g' => 'ok'];

    public function __construct(private readonly Consolidation $money) {}

    public function reservations(?string $light = null, ?string $channel = null): array
    {
        return $this->overview()['rows']
            ->when($light !== null, fn (Collection $rows) => $rows->where('band', self::LIGHTS[$light]))
            ->when($channel !== null, fn (Collection $rows) => $rows->filter(fn (array $row): bool => strcasecmp((string) $row['channel'], (string) $channel) === 0))
            ->values()->all();
    }

    public function costImpact(string $reservationCode, string $amount, string $currency, ?string $fxRate = null): array
    {
        $overview = $this->overview();
        $row = $overview['rows']->firstWhere('code', $reservationCode)
            ?? throw ApiException::unprocessable('FIN-BR-23', 'El costo se registra sobre una reserva vigente (no borrador ni cancelada).');
        $extra = $this->money->penExact($amount, $currency, $fxRate ?? $this->money->fxFor($currency));
        $income = Decimal::of($row['income_pen']);
        $cost = Decimal::of($row['cost_pen'])->plus($extra);
        $margin = $income->minus($cost);
        $pct = $income->isPositive() ? (float) (string) $margin->multipliedBy(100)->dividedBy($income, 1, RoundingMode::HALF_UP) : 0.0;

        return [
            'reservation' => ['code' => $row['code'], 'title' => $row['title']],
            'amount_pen' => (string) $extra,
            'before' => ['cost_pen' => (string) Decimal::money($row['cost_pen']), 'margin_pen' => (string) Decimal::money($row['margin_pen']), 'margin_pct' => $row['margin_pct'], 'band' => $row['band']],
            'after' => ['cost_pen' => (string) Decimal::round2($cost), 'margin_pen' => (string) Decimal::round2($margin), 'margin_pct' => $pct, 'band' => $pct >= $overview['target'] ? 'ok' : ($pct >= $overview['floor'] ? 'warn' : 'bad')],
            'target' => $overview['target'],
            'floor' => $overview['floor'],
        ];
    }

    public function overview(): array
    {
        $reservations = DB::table('booking_reservations as b')
            ->join('crm_clients as c', 'c.id', '=', 'b.client_id')
            ->leftJoin('iam_users as u', 'u.id', '=', 'b.owner_id')
            ->whereNull('b.deleted_at')
            ->whereNotIn('b.status', ['borrador', 'cancelada'])
            ->get(['b.id', 'b.code', 'b.title', 'b.status', 'b.channel', 'b.travel_from', 'b.currency', 'b.fx_rate', 'b.total_amount', 'c.name as client_name', 'u.name as owner_name'])
            ->keyBy('id');
        $ids = $reservations->keys()->all();

        $services = DB::table('booking_reservation_services as s')
            ->leftJoin('catalog_products as p', 'p.id', '=', 's.product_id')
            ->whereIn('s.reservation_id', $ids)
            ->whereNotIn('s.status', ['cancelado', 'cancelada', 'rechazado'])
            ->get(['s.reservation_id', 's.currency', 's.fx_rate', 's.price_amount', 's.cost_amount', 's.service_kind', 'p.name as product_name']);
        $extraCosts = DB::table('fin_payables')->whereIn('reservation_id', $ids)->where('kind', 'costo_adicional')->whereNotNull('approved_at')->where('status', '<>', 'cancelada')->whereNull('deleted_at')
            ->get(['reservation_id', 'amount', 'currency', 'fx_rate'])->groupBy('reservation_id');
        $commissions = DB::table('fin_commissions')->whereIn('reservation_id', $ids)->whereNull('deleted_at')
            ->get(['reservation_id', 'amount', 'currency', 'fx_rate'])->groupBy('reservation_id');
        $servicesBy = $services->groupBy('reservation_id');
        $settled = DB::table('fin_settlements')->whereIn('reservation_id', $ids)->pluck('closed_at', 'reservation_id');
        ['target' => $target, 'floor' => $floor] = TreasurySettings::margins();

        $rows = $reservations->map(function (object $reservation) use ($servicesBy, $extraCosts, $commissions, $settled, $target, $floor): array {
            $income = $this->money->pen((string) NetSales::of($reservation->total_amount, $reservation->currency), $reservation->currency, $reservation->fx_rate);
            $serviceCost = ($servicesBy->get($reservation->id) ?? collect())->sum(fn (object $row): float => $this->money->pen($row->cost_amount, $row->currency, $row->fx_rate ?? $reservation->fx_rate));
            $extra = ($extraCosts->get($reservation->id) ?? collect())->sum(fn (object $row): float => $this->money->pen($row->amount, $row->currency, $row->fx_rate));
            $commission = ($commissions->get($reservation->id) ?? collect())->sum(fn (object $row): float => $this->money->pen($row->amount, $row->currency, $row->fx_rate));
            $cost = round($serviceCost + $extra, 2);
            $margin = round($income - $cost, 2);
            $pct = $income > 0 ? round($margin / $income * 100, 1) : 0.0;

            return [
                'code' => $reservation->code,
                'title' => $reservation->title,
                'client' => $reservation->client_name,
                'owner' => $reservation->owner_name ?? 'Sin asesor',
                'channel' => $reservation->channel,
                'status' => $reservation->status,
                'travel_from' => $reservation->travel_from,
                'currency' => $reservation->currency,
                'income_pen' => $income,
                'cost_pen' => $cost,
                'extra_cost_pen' => round($extra, 2),
                'commissions_pen' => round($commission, 2),
                'margin_pen' => $margin,
                'net_pen' => round($margin - $commission, 2),
                'margin_pct' => $pct,
                'band' => $pct >= $target ? 'ok' : ($pct >= $floor ? 'warn' : 'bad'),
                'settled_at' => $settled->get($reservation->id),
            ];
        })->sortByDesc('income_pen')->values();

        $income = $rows->sum('income_pen');
        $cost = $rows->sum('cost_pen');
        $commission = $rows->sum('commissions_pen');

        return [
            'rows' => $rows,
            'kpis' => [
                'income_pen' => round($income, 2),
                'cost_pen' => round($cost, 2),
                'commissions_pen' => round($commission, 2),
                'margin_pen' => round($income - $cost, 2),
                'net_pen' => round($income - $cost - $commission, 2),
                'margin_pct' => $income > 0 ? round(($income - $cost) / $income * 100, 1) : 0.0,
                'below_floor' => $rows->where('band', 'bad')->count(),
                'settled' => $rows->whereNotNull('settled_at')->count(),
            ],
            'by_product' => $this->byProduct($services, $reservations),
            'by_owner' => $this->group($rows, 'owner'),
            'by_channel' => $this->group($rows, 'channel'),
            'monthly' => $this->monthly($rows),
            'target' => $target,
            'floor' => $floor,
        ];
    }

    private function byProduct(Collection $services, Collection $reservations): Collection
    {
        return $services->groupBy(fn (object $row): string => $row->product_name ?? (self::KINDS[$row->service_kind] ?? 'Otros servicios'))
            ->map(function (Collection $items, string $name) use ($reservations): array {
                $fx = fn (object $row): mixed => $row->fx_rate ?? $reservations->get($row->reservation_id)?->fx_rate;
                $price = $items->sum(fn (object $row): float => $this->money->pen((string) NetSales::of($row->price_amount, $row->currency), $row->currency, $fx($row)));
                $cost = $items->sum(fn (object $row): float => $this->money->pen($row->cost_amount, $row->currency, $fx($row)));

                return ['name' => $name, 'income_pen' => round($price, 2), 'margin_pen' => round($price - $cost, 2), 'margin_pct' => $price > 0 ? round(($price - $cost) / $price * 100, 1) : 0.0, 'count' => $items->count()];
            })->sortByDesc('margin_pen')->values();
    }

    private function group(Collection $rows, string $key): Collection
    {
        return $rows->groupBy($key)->map(function (Collection $items, string $name): array {
            $income = $items->sum('income_pen');
            $margin = $items->sum('margin_pen');

            return ['name' => $name, 'income_pen' => round($income, 2), 'margin_pen' => round($margin, 2), 'margin_pct' => $income > 0 ? round($margin / $income * 100, 1) : 0.0, 'count' => $items->count()];
        })->sortByDesc('margin_pen')->values();
    }

    private function monthly(Collection $rows): Collection
    {
        return $rows->groupBy(fn (array $row): string => substr($row['travel_from'], 0, 7))
            ->map(fn (Collection $items, string $month): array => [
                'month' => $month,
                'label' => Carbon::parse($month.'-01')->locale('es')->isoFormat('MMM YY'),
                'income_pen' => round($items->sum('income_pen'), 2),
                'cost_pen' => round($items->sum('cost_pen'), 2),
                'margin_pen' => round($items->sum('margin_pen'), 2),
                'margin_pct' => $items->sum('income_pen') > 0 ? round($items->sum('margin_pen') / $items->sum('income_pen') * 100, 1) : 0.0,
            ])->sortKeys()->values();
    }
}
