<?php

declare(strict_types=1);

namespace App\Domain\Reports\Support\Dashboards;

use App\Domain\Iam\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

final class FinancePanel
{
    private const AGING = ['Por vencer', '1 a 30 días', '31 a 60 días', '61 a 90 días', 'Más de 90 días'];

    public function __construct(private readonly PanelData $data) {}

    public function build(User $viewer): array
    {
        $today = $this->data->today();
        $start = $this->data->monthStart();
        $months = $this->data->months($viewer);
        $receivables = $this->data->receivables($viewer);
        $overdue = $receivables->filter(fn (object $row): bool => $this->data->overdue($row));
        $cash = DB::table('fin_payments')->where('kind', 'cobro')->whereIn('status', ['aplicado', 'confirmado'])->whereBetween('paid_on', [$start->toDateString(), $start->copy()->endOfMonth()->toDateString()])->get(['method', 'amount', 'fx_rate']);
        $toValidate = $this->toValidate();
        $payables = $this->payables($this->data->now()->addDays(7)->toDateString(), $today);

        return [
            'today' => $today,
            'month' => $this->data->monthLabel(),
            'kpis' => [
                'cash' => ['amount' => round($cash->sum(fn (object $row): float => $this->data->pen((float) $row->amount, $row->fx_rate)), 2), 'count' => $cash->count()],
                'receivable' => ['open' => round($receivables->sum(fn (object $row): float => $this->data->balance($row)), 2), 'overdue' => round($overdue->sum(fn (object $row): float => $this->data->balance($row)), 2), 'overdue_count' => $overdue->count()],
                'to_validate' => ['count' => $toValidate->count(), 'amount' => round($toValidate->sum('amount_pen'), 2)],
                'payables' => ['amount' => round($payables->sum('balance_pen'), 2), 'count' => $payables->count()],
                'margin' => $this->data->salesKpis($months)['margin'],
            ],
            'margins' => $this->margins(),
            'aging' => $this->aging($receivables),
            'overdue' => $overdue->take(5)->map(fn ($row): array => ['code' => $row->code, 'client' => $row->client, 'due' => $row->due_date, 'balance' => round((float) $row->amount - (float) $row->paid_amount, 2), 'currency' => $row->currency])->values(),
            'to_validate' => $toValidate->take(6)->values(),
            'payables' => $payables->take(6)->values(),
            'commissions' => $this->commissions(),
            'months' => $months,
            'methods' => $cash->groupBy('method')->map(fn (Collection $group, string $method): array => ['label' => $method, 'sales' => round($group->sum(fn (object $row): float => $this->data->pen((float) $row->amount, $row->fx_rate)), 2), 'count' => $group->count()])->sortByDesc('sales')->values(),
        ];
    }

    private function toValidate(): Collection
    {
        return DB::table('fin_payments as p')->leftJoin('booking_reservations as r', 'r.id', '=', 'p.reservation_id')->leftJoin('iam_users as u', 'u.id', '=', 'p.registered_by')
            ->where('p.kind', 'cobro')->where('p.status', 'pendiente')->orderBy('p.paid_on')
            ->get(['p.code', 'p.method', 'p.amount', 'p.currency', 'p.fx_rate', 'p.paid_on', 'p.source', 'r.code as reservation', 'u.name as by'])
            ->map(fn (object $row): array => [
                'code' => $row->code,
                'method' => $row->method,
                'reservation' => $row->reservation,
                'date' => $row->paid_on,
                'by' => $row->by,
                'amount' => round((float) $row->amount, 2),
                'currency' => $row->currency,
                'amount_pen' => $this->data->pen((float) $row->amount, $row->fx_rate),
            ]);
    }

    private function payables(string $limit, string $today): Collection
    {
        return DB::table('fin_payables as f')->leftJoin('catalog_providers as p', 'p.id', '=', 'f.provider_id')->whereNull('f.deleted_at')
            ->whereNotIn('f.status', ['pagada', 'cancelada', 'anulada'])->where('f.due_date', '<=', $limit)->orderBy('f.due_date')
            ->get(['f.code', 'f.amount', 'f.paid_amount', 'f.currency', 'f.fx_rate', 'f.due_date', 'f.supplier_doc_number', 'p.name as provider'])
            ->map(fn (object $row): array => [
                'code' => $row->code,
                'provider' => $row->provider,
                'due' => $row->due_date,
                'overdue' => (string) $row->due_date < $today,
                'document' => $row->supplier_doc_number,
                'balance' => round((float) $row->amount - (float) $row->paid_amount, 2),
                'currency' => $row->currency,
                'balance_pen' => $this->data->pen((float) $row->amount - (float) $row->paid_amount, $row->fx_rate),
            ]);
    }

    private function margins(): array
    {
        $rows = DB::table('booking_reservations')->whereNull('deleted_at')->whereNotIn('status', ['cancelada', 'borrador'])->get(['id', 'code', 'title', 'currency']);
        $totals = DB::table('booking_reservation_services')->whereIn('reservation_id', $rows->pluck('id'))->where('status', '<>', 'cancelado')
            ->selectRaw('reservation_id, sum(price_amount) as sale, sum(cost_amount) as cost')->groupBy('reservation_id')->get()->keyBy('reservation_id');

        return $rows->map(function (object $row) use ($totals): array {
            $sale = (float) ($totals[$row->id]->sale ?? 0);
            $cost = (float) ($totals[$row->id]->cost ?? 0);

            return ['code' => $row->code, 'title' => $row->title, 'currency' => $row->currency, 'sale' => round($sale, 2), 'cost' => round($cost, 2), 'pct' => $sale > 0 ? round(($sale - $cost) / $sale * 100, 1) : null];
        })->filter(fn (array $row): bool => $row['pct'] !== null)->sortBy('pct')->take(8)->values()->all();
    }

    private function aging(Collection $receivables): array
    {
        $today = Carbon::parse($this->data->today());
        $grouped = $receivables->groupBy(function (object $row) use ($today): string {
            $late = (int) Carbon::parse($row->due_date)->diffInDays($today, false);

            return match (true) {
                $late <= 0 => self::AGING[0],
                $late <= 30 => self::AGING[1],
                $late <= 60 => self::AGING[2],
                $late <= 90 => self::AGING[3],
                default => self::AGING[4],
            };
        });

        return collect(self::AGING)->map(fn (string $label): array => [
            'label' => $label,
            'amount' => round($grouped->get($label, collect())->sum(fn (object $row): float => $this->data->balance($row)), 2),
            'count' => $grouped->get($label, collect())->count(),
        ])->all();
    }

    private function commissions(): array
    {
        return DB::table('fin_commissions as c')->leftJoin('iam_users as u', 'u.id', '=', 'c.beneficiary_user_id')->leftJoin('channel_b2b_agencies as a', 'a.id', '=', 'c.beneficiary_agency_id')
            ->leftJoin('booking_reservations as r', 'r.id', '=', 'c.reservation_id')->whereNull('c.deleted_at')->where('c.status', 'calculada')->orderBy('c.created_at')->limit(6)
            ->get(['c.code', 'c.kind', 'c.pct', 'c.base_amount', 'c.amount', 'c.currency', 'u.name as user', 'a.legal_name as agency', 'r.code as reservation'])
            ->map(fn (object $row): array => ['code' => $row->code, 'beneficiary' => $row->user ?? $row->agency, 'kind' => $row->kind, 'reservation' => $row->reservation, 'pct' => round((float) $row->pct, 1), 'base' => round((float) $row->base_amount, 2), 'amount' => round((float) $row->amount, 2), 'currency' => $row->currency])->all();
    }
}
