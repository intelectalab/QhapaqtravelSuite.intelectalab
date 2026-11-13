<?php

declare(strict_types=1);

namespace App\Domain\Showcase\Support;

use App\Domain\Shared\Money\Decimal;
use App\Domain\Showcase\Actions\ManageGateways;
use App\Domain\Showcase\Contracts\GatewayCredentialVault;
use Brick\Math\RoundingMode;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

final class GatewayDirectory
{
    public function __construct(private readonly GatewayCredentialVault $vault) {}

    public function accounts(bool $canManage): array
    {
        $stats = DB::table('fin_payment_fees')->groupBy('gateway_account_id', 'currency')
            ->selectRaw('gateway_account_id, currency, count(*) as n, sum(gross) as gross, sum(fee + fee_tax + fx_spread) as cost, sum(net) as net')->get()->groupBy('gateway_account_id');
        $rows = DB::table('fin_gateway_accounts')->orderByRaw("case status when 'activa' then 0 when 'pendiente' then 1 when 'pausada' then 2 else 3 end")->orderBy('label')->get();

        return [
            'can_manage' => $canManage,
            'providers' => array_map(fn (string $value, string $label) => ['value' => $value, 'label' => $label], array_keys(ManageGateways::PROVIDERS), array_values(ManageGateways::PROVIDERS)),
            'igv_pct' => GatewayFees::IGV_PCT,
            'items' => $rows->map(fn (object $row) => [
                'id' => $row->id,
                'provider' => $row->provider,
                'provider_label' => ManageGateways::PROVIDERS[$row->provider] ?? $row->provider,
                'label' => $row->label,
                'account_ref' => $row->account_ref,
                'status' => $row->status,
                'mode' => $row->mode,
                'currency' => $row->currency,
                'fee_currency' => $row->fee_currency,
                'fee_pct' => (string) $row->fee_pct,
                'fee_fixed' => Decimal::toApi(Decimal::money($row->fee_fixed)),
                'fx_spread_pct' => (string) $row->fx_spread_pct,
                'tax_on_fee' => (bool) $row->tax_on_fee,
                'settle_days' => (int) $row->settle_days,
                'pass_fee_to_customer' => (bool) $row->pass_fee_to_customer,
                'has_credentials' => $row->credentials_ref !== null,
                'credentials_in_vault' => $row->credentials_ref !== null && $this->vault->has((string) $row->credentials_ref),
                'addon_required' => $row->addon_required,
                'totals' => $this->totals($stats->get($row->id)),
            ])->values()->all(),
        ];
    }

    private function totals(mixed $groups): array
    {
        $totals = [];

        foreach ($groups ?? [] as $s) {
            $totals[] = ['currency' => $s->currency, 'count' => (int) $s->n, 'gross' => Decimal::toApi(Decimal::money($s->gross)), 'cost' => Decimal::toApi(Decimal::money($s->cost)), 'net' => Decimal::toApi(Decimal::money($s->net))];
        }

        return $totals;
    }

    public function fees(array $filters): array
    {
        $query = DB::table('fin_payment_fees as f')->join('fin_gateway_accounts as g', 'g.id', '=', 'f.gateway_account_id')
            ->join('fin_payments as p', 'p.id', '=', 'f.payment_id')
            ->leftJoin('booking_reservations as r', 'r.id', '=', 'p.reservation_id')
            ->when($filters['from'] ?? null, fn (Builder $q, string $from) => $q->where('p.paid_on', '>=', $from))
            ->when($filters['to'] ?? null, fn (Builder $q, string $to) => $q->where('p.paid_on', '<=', $to))
            ->when($filters['gateway'] ?? null, fn (Builder $q, string $gateway) => $q->where('f.gateway_account_id', $gateway))
            ->orderByDesc('p.paid_on')->orderByDesc('f.created_at');
        $rows = $query->get(['f.*', 'g.label as gateway_label', 'g.provider', 'p.code as payment_code', 'p.paid_on', 'r.code as reservation_code']);
        $totals = $rows->groupBy('currency')->map(fn ($items, $currency) => [
            'currency' => $currency,
            'count' => $items->count(),
            'gross' => Decimal::toApi($items->reduce(fn ($s, $r) => $s->plus(Decimal::money($r->gross)), Decimal::money(0))),
            'fee' => Decimal::toApi($items->reduce(fn ($s, $r) => $s->plus(Decimal::money($r->fee)), Decimal::money(0))),
            'fee_tax' => Decimal::toApi($items->reduce(fn ($s, $r) => $s->plus(Decimal::money($r->fee_tax)), Decimal::money(0))),
            'fx_spread' => Decimal::toApi($items->reduce(fn ($s, $r) => $s->plus(Decimal::money($r->fx_spread)), Decimal::money(0))),
            'net' => Decimal::toApi($items->reduce(fn ($s, $r) => $s->plus(Decimal::money($r->net)), Decimal::money(0))),
        ])->values()->all();

        return [
            'items' => $rows->map(fn (object $row) => [
                'id' => $row->id,
                'gateway' => ['id' => $row->gateway_account_id, 'label' => $row->gateway_label, 'provider' => $row->provider],
                'payment' => $row->payment_code,
                'reservation' => $row->reservation_code,
                'paid_on' => (string) $row->paid_on,
                'currency' => $row->currency,
                'gross' => Decimal::toApi(Decimal::money($row->gross)),
                'fee' => Decimal::toApi(Decimal::money($row->fee)),
                'fee_tax' => Decimal::toApi(Decimal::money($row->fee_tax)),
                'fx_spread' => Decimal::toApi(Decimal::money($row->fx_spread)),
                'net' => Decimal::toApi(Decimal::money($row->net)),
                'effective_pct' => Decimal::money($row->gross)->isPositive() ? (string) Decimal::money($row->gross)->minus(Decimal::money($row->net))->multipliedBy(100)->dividedBy(Decimal::money($row->gross), 2, RoundingMode::HALF_UP) : '0.00',
                'status' => $row->status,
                'external_ref' => $row->external_ref,
                'settled_on' => $row->settled_on,
                'passed_to_customer' => (bool) $row->passed_to_customer,
                'created_at' => Carbon::parse($row->created_at)->toIso8601String(),
            ])->values()->all(),
            'totals' => $totals,
            'kpis' => collect(['estimado', 'liquidado', 'ajustado'])->mapWithKeys(fn (string $s) => [$s => $rows->where('status', $s)->count()])->all(),
        ];
    }
}
