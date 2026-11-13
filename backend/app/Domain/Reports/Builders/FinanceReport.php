<?php

declare(strict_types=1);

namespace App\Domain\Reports\Builders;

use App\Domain\Crm\Support\Portfolio;
use App\Domain\Iam\Models\User;
use App\Domain\Reports\Support\ReportFilters;
use App\Domain\Reports\Support\ReportShape as S;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

final class FinanceReport extends ReportBuilder
{
    private const PAYABLE = ['abierta' => 'Abierta', 'aprobada' => 'Aprobada', 'parcial' => 'Parcial', 'vencida' => 'Vencida'];

    private const RECEIVABLE = ['abierta' => 'Abierta', 'parcial' => 'Parcial', 'vencida' => 'Vencida'];

    public function build(User $viewer, ReportFilters $filters): array
    {
        $profit = $viewer->can('finance.profitability');
        $sold = $this->reservations($viewer, $filters)->leftJoin('crm_clients as c', 'c.id', '=', 'r.client_id')->orderByDesc('r.created_at')
            ->get(['r.id', 'r.code', 'r.created_at', DB::raw("{$this->sales()} as sales"), 'c.name as client']);
        $costs = DB::table('booking_reservation_services')->whereIn('reservation_id', $sold->pluck('id'))->where('status', '<>', 'cancelado')
            ->selectRaw('reservation_id, sum('.S::pen('cost_amount', 'fx_rate').') as cost')->groupBy('reservation_id')->pluck('cost', 'reservation_id');
        $receivables = DB::table('fin_receivables')->whereIn('reservation_id', $sold->pluck('id'))->whereNull('deleted_at')->where('status', '<>', 'cancelada')
            ->selectRaw('reservation_id, sum('.S::pen('amount', 'fx_rate').') as billed, sum('.S::pen('paid_amount', 'fx_rate').') as paid')->groupBy('reservation_id')->get()->keyBy('reservation_id');
        $sales = (float) $sold->sum('sales');
        $cost = (float) $costs->sum();
        $aging = $this->aging($viewer, $filters);
        $open = array_sum(array_column($aging, 'value'));
        $overdue = $open - ($aging[0]['value'] ?? 0);
        $months = $this->reservations($viewer, $filters)->selectRaw($filters->monthExpression('r.created_at')." as m, sum({$this->sales()}) as sales")->groupBy('m')->pluck('sales', 'm');
        $monthCosts = $this->reservations($viewer, $filters)->join('booking_reservation_services as s', 's.reservation_id', '=', 'r.id')->where('s.status', '<>', 'cancelado')
            ->selectRaw($filters->monthExpression('r.created_at').' as m, sum('.S::pen('s.cost_amount', 's.fx_rate').') as cost')->groupBy('m')->pluck('cost', 'm');
        $collected = $this->reservations($viewer, $filters)->join('fin_receivables as f', 'f.reservation_id', '=', 'r.id')->whereNull('f.deleted_at')
            ->selectRaw($filters->monthExpression('r.created_at').' as m, sum('.S::pen('f.paid_amount', 'f.fx_rate').') as paid')->groupBy('m')->pluck('paid', 'm');
        $series = collect($filters->months())->map(function (string $label, string $key) use ($months, $monthCosts, $collected, $profit): array {
            $amount = round((float) ($months[$key] ?? 0), 2);
            $second = round((float) ($profit ? ($monthCosts[$key] ?? 0) : ($collected[$key] ?? 0)), 2);

            return ['label' => $label, 'sales' => $amount, 'second' => $second, 'margin' => $profit && $amount > 0 ? round(($amount - $second) / $amount * 100, 1) : null];
        });
        $kpis = [S::kpi('sales', 'Ventas netas', round($sales, 2), 'money', "{$sold->count()} reservas")];

        if ($profit) {
            $kpis[] = S::kpi('cost', 'Costo', round($cost, 2), 'money');
            $kpis[] = S::kpi('profit', 'Utilidad', round($sales - $cost, 2), 'money');
            $kpis[] = S::kpi('margin', 'Margen', S::rate($sales - $cost, $sales), 'percent');
        } else {
            $billed = (float) $receivables->sum('billed');
            $kpis[] = S::kpi('billed', 'Facturable', round($billed, 2), 'money');
            $kpis[] = S::kpi('collected', 'Cobrado', round((float) $receivables->sum('paid'), 2), 'money', S::rate((float) $receivables->sum('paid'), $billed) !== null ? S::rate((float) $receivables->sum('paid'), $billed).' % de lo facturado' : null);
            $invoices = $this->invoices($viewer, $filters);
            $kpis[] = S::kpi('invoices', 'Comprobantes emitidos', (int) ($invoices->total ?? 0), 'number', ((int) ($invoices->observed ?? 0)).' '.((int) ($invoices->observed ?? 0) === 1 ? 'observado' : 'observados'));
        }

        $kpis[] = S::kpi('receivable', 'Cuentas por cobrar', round($open, 2), 'money', 'Vencido: S/ '.number_format($overdue, 2, '.', ' '));
        $charts = [
            S::chart('months', $profit ? 'Ventas y costo por mes' : 'Ventas y cobranza por mes', 'pair', $series->map(fn (array $row): array => ['label' => $row['label'], 'value' => $row['sales'], 'value2' => $row['second']])->values()->all(), 'money', ['labels' => ['Ventas', $profit ? 'Costo' : 'Cobrado']]),
            S::chart('aging', 'Antigüedad de cuentas por cobrar', 'bar', $aging, 'money'),
        ];

        if ($profit) {
            $charts[] = S::chart('margin', 'Margen por mes', 'line', $series->map(fn (array $row): array => S::point($row['label'], (float) ($row['margin'] ?? 0)))->values()->all(), 'percent');
        }

        if ($viewer->can('finance.payables')) {
            $payables = DB::table('fin_payables')->whereNull('deleted_at')->whereIn('status', array_keys(self::PAYABLE))->selectRaw('status, sum('.S::pen('amount - paid_amount', 'fx_rate').') as open, count(*) as total')->groupBy('status')->get()->keyBy('status');
            $charts[] = S::chart('payables', 'Cuentas por pagar por estado', 'bar', collect(self::PAYABLE)->map(fn (string $label, string $key): array => S::point($label, round((float) ($payables[$key]->open ?? 0), 2), ['count' => (int) ($payables[$key]->total ?? 0)]))->all(), 'money');
        }

        $columns = [S::column('code', 'Reserva'), S::column('client', 'Cliente'), S::column('sales', 'Venta', 'money')];
        $columns = $profit ? [...$columns, S::column('cost', 'Costo', 'money'), S::column('profit', 'Utilidad', 'money'), S::column('margin', 'Margen', 'percent', ['warn_below' => 15])] : [...$columns, S::column('billed', 'Facturado', 'money'), S::column('balance', 'Saldo', 'money')];
        $columns[] = S::column('collected', '% cobrado', 'percent');
        $rows = $sold->map(function (object $row) use ($costs, $receivables, $profit): array {
            $amount = round((float) $row->sales, 2);
            $billed = (float) ($receivables[$row->id]->billed ?? 0);
            $paid = (float) ($receivables[$row->id]->paid ?? 0);
            $base = ['code' => $row->code, 'client' => $row->client, 'sales' => $amount, 'collected' => S::rate($paid, $billed)];
            $spent = round((float) ($costs[$row->id] ?? 0), 2);

            return $profit ? [...$base, 'cost' => $spent, 'profit' => round($amount - $spent, 2), 'margin' => S::rate($amount - $spent, $amount)] : [...$base, 'billed' => round($billed, 2), 'balance' => round($billed - $paid, 2)];
        })->all();

        return [
            'variant' => $profit ? 'rentabilidad' : 'contable',
            'kpis' => $kpis,
            'charts' => $charts,
            'table' => $profit ? S::table($columns, $rows, null, '/reservas/{code}') : $this->receivablesTable($viewer, $filters),
        ];
    }

    private function invoices(User $viewer, ReportFilters $filters): ?object
    {
        $query = Portfolio::scope(DB::table('fin_invoices as i')->join('crm_clients as c', 'c.id', '=', 'i.client_id')->whereIn('i.doc_type', ['01', '03'])->where('i.status', '<>', 'pendiente_envio'), $viewer, 'c.owner_id')
            ->whereBetween('i.issue_date', [$filters->from->toDateString(), $filters->to->toDateString()]);
        $query = $filters->sedeId ? $query->join('booking_reservations as r', 'r.id', '=', 'i.reservation_id')->where('r.sede_id', $filters->sedeId) : $query;

        return $query->selectRaw("count(*) as total, count(*) filter (where i.status = 'observado') as observed")->first();
    }

    private function receivablesTable(User $viewer, ReportFilters $filters): array
    {
        $query = Portfolio::scope(DB::table('fin_receivables as f')->join('crm_clients as c', 'c.id', '=', 'f.client_id')->whereNull('f.deleted_at'), $viewer, 'c.owner_id')
            ->leftJoin('booking_reservations as r', 'r.id', '=', 'f.reservation_id')->whereNotIn('f.status', ['cancelada', 'pagada']);
        $query = $filters->sedeId ? $query->where('r.sede_id', $filters->sedeId) : $query;
        $rows = $query->orderBy('f.due_date')->limit(500)->get(['f.code', 'f.status', 'f.due_date', 'f.amount', 'f.paid_amount', 'f.fx_rate', 'c.name as client', 'r.code as reservation']);
        $today = Carbon::now($filters->timezone)->toDateString();

        return S::table([
            S::column('code', 'Documento'),
            S::column('client', 'Cliente'),
            S::column('reservation', 'Reserva'),
            S::column('due_date', 'Vence', 'date'),
            S::column('balance', 'Saldo S/', 'money'),
            S::column('status', 'Estado', 'status', ['filter' => true]),
        ], $rows->map(fn (object $row): array => [
            'code' => $row->code,
            'client' => $row->client,
            'reservation' => $row->reservation,
            'due_date' => $row->due_date,
            'balance' => round(((float) $row->amount - (float) $row->paid_amount) * (float) ($row->fx_rate ?: 1), 2),
            'status' => $row->status !== 'vencida' && $row->due_date < $today ? 'Vencida' : (self::RECEIVABLE[$row->status] ?? $row->status),
            'status_key' => $row->status !== 'vencida' && $row->due_date < $today ? 'vencida' : $row->status,
        ])->all(), ['balance' => round((float) $rows->sum(fn (object $row): float => ((float) $row->amount - (float) $row->paid_amount) * (float) ($row->fx_rate ?: 1)), 2)], '/finanzas/cobros/{code}');
    }

    private function aging(User $viewer, ReportFilters $filters): array
    {
        $rows = Portfolio::scope(DB::table('fin_receivables as f')->join('crm_clients as c', 'c.id', '=', 'f.client_id')->whereNull('f.deleted_at'), $viewer, 'c.owner_id')
            ->leftJoin('booking_reservations as r', 'r.id', '=', 'f.reservation_id')->whereNotIn('f.status', ['cancelada', 'pagada']);
        $rows = $filters->sedeId ? $rows->where('r.sede_id', $filters->sedeId) : $rows;
        $today = Carbon::now($filters->timezone)->startOfDay();
        $buckets = ['Por vencer' => 0.0, '1 a 30 días' => 0.0, '31 a 60 días' => 0.0, 'Más de 60 días' => 0.0];

        foreach ($rows->get(['f.amount', 'f.paid_amount', 'f.fx_rate', 'f.due_date']) as $row) {
            $late = (int) Carbon::parse($row->due_date)->diffInDays($today, false);
            $key = match (true) {
                $late <= 0 => 'Por vencer',
                $late <= 30 => '1 a 30 días',
                $late <= 60 => '31 a 60 días',
                default => 'Más de 60 días',
            };
            $buckets[$key] += ((float) $row->amount - (float) $row->paid_amount) * (float) ($row->fx_rate ?: 1);
        }

        return array_map(fn (string $label, float $value): array => S::point($label, round($value, 2)), array_keys($buckets), $buckets);
    }
}
