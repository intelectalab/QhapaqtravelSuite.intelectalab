<?php

declare(strict_types=1);

namespace App\Domain\Reports\Support;

use App\Domain\Crm\Support\Portfolio;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Tenancy\TenantContext;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

final class KpiReport
{
    public const SOLD = ['confirmada', 'en_operacion', 'completada', 'pendiente_pago', 'pendiente_proveedor', 'parcial', 'incidencia', 'reprogramada', 'pendiente_disponibilidad'];

    private const MONTHS = 6;

    public function __construct(private readonly TenantContext $context) {}

    public function build(User $viewer): array
    {
        $now = Carbon::now($this->context->timezone());
        $start = $now->copy()->startOfMonth()->subMonths(self::MONTHS - 1);
        $months = $this->months($viewer, $start);
        $current = $months->last();
        $previous = $months->slice(-2, 1)->first();
        $leads = $this->leads($viewer, $start);
        $quotes = $this->quotes($viewer, $start);
        $collection = $this->collection($viewer, $now);

        return [
            'today' => $now->toDateString(),
            'scope' => Portfolio::ownOnly($viewer) ? 'own' : 'tenant',
            'kpis' => [
                'sales' => $current['sales'],
                'sales_previous' => $previous['sales'] ?? 0,
                'sales_period' => $months->sum('sales'),
                'margin_pct' => $months->sum('sales') > 0 ? round(($months->sum('sales') - $months->sum('cost')) / $months->sum('sales') * 100, 1) : null,
                'reservations' => $months->sum('reservations'),
                'ticket' => $months->sum('reservations') > 0 ? round($months->sum('sales') / $months->sum('reservations'), 2) : null,
                'lead_conversion' => $leads['rate'],
                'quote_win_rate' => $quotes['win_rate'],
                'receivable_open' => $collection['open'],
                'receivable_overdue' => $collection['overdue'],
                'collected_period' => $collection['collected'],
                'collection_rate' => $collection['rate'],
            ],
            'months' => $months->values(),
            'leads' => $leads,
            'quotes' => $quotes,
            'collection' => $collection,
            'channels' => $this->breakdown($viewer, $start, 'r.channel'),
            'advisors' => Portfolio::ownOnly($viewer) ? [] : $this->advisors($start),
        ];
    }

    private function reservations(User $viewer): Builder
    {
        return Portfolio::scope(DB::table('booking_reservations as r')->whereNull('r.deleted_at'), $viewer, 'r.owner_id');
    }

    private function months(User $viewer, Carbon $start): Collection
    {
        $timezone = $this->context->timezone();
        $month = "to_char(r.created_at at time zone '{$timezone}', 'YYYY-MM')";
        $sold = $this->reservations($viewer)->whereIn('r.status', self::SOLD)->where('r.created_at', '>=', $start->copy()->utc());
        $sales = (clone $sold)->selectRaw("{$month} as month, sum(r.total_amount * r.fx_rate) as sales, count(*) as total")->groupBy('month')->get()->keyBy('month');
        $costs = (clone $sold)->join('booking_reservation_services as s', 's.reservation_id', '=', 'r.id')->where('s.status', '<>', 'cancelado')
            ->selectRaw("{$month} as month, sum(s.cost_amount * coalesce(s.fx_rate, 1)) as cost")->groupBy('month')->pluck('cost', 'month');
        $leads = Portfolio::scope(DB::table('crm_leads as r')->whereNull('r.deleted_at'), $viewer, 'r.owner_id')->where('r.created_at', '>=', $start->copy()->utc())
            ->selectRaw("{$month} as month, count(*) as total")->groupBy('month')->pluck('total', 'month');
        $quotes = Portfolio::scope(DB::table('quote_quotes as r')->whereNull('r.deleted_at'), $viewer, 'r.owner_id')->where('r.created_at', '>=', $start->copy()->utc())
            ->selectRaw("{$month} as month, count(*) as total")->groupBy('month')->pluck('total', 'month');

        return collect(range(0, self::MONTHS - 1))->map(function (int $offset) use ($start, $sales, $costs, $leads, $quotes): array {
            $date = $start->copy()->addMonths($offset);
            $key = $date->format('Y-m');
            $amount = round((float) ($sales[$key]->sales ?? 0), 2);
            $cost = round((float) ($costs[$key] ?? 0), 2);

            return [
                'key' => $key,
                'label' => ucfirst(rtrim($date->locale('es')->isoFormat('MMM'), '.')),
                'sales' => $amount,
                'cost' => $cost,
                'margin_pct' => $amount > 0 && $cost > 0 ? round(($amount - $cost) / $amount * 100, 1) : null,
                'reservations' => (int) ($sales[$key]->total ?? 0),
                'leads' => (int) ($leads[$key] ?? 0),
                'quotes' => (int) ($quotes[$key] ?? 0),
            ];
        });
    }

    private function leads(User $viewer, Carbon $start): array
    {
        $rows = Portfolio::scope(DB::table('crm_leads')->whereNull('deleted_at'), $viewer, 'owner_id')->where('created_at', '>=', $start->copy()->utc())->pluck('status');
        $valid = $rows->reject(fn (string $status): bool => $status === 'duplicado');
        $converted = $valid->filter(fn (string $status): bool => $status === 'convertido')->count();

        return [
            'total' => $rows->count(),
            'converted' => $converted,
            'rate' => $valid->isEmpty() ? null : round($converted / $valid->count() * 100, 1),
            'by_status' => $rows->countBy()->map(fn (int $count, string $status): array => ['status' => $status, 'count' => $count])->sortByDesc('count')->values()->all(),
        ];
    }

    private function quotes(User $viewer, Carbon $start): array
    {
        $rows = Portfolio::scope(DB::table('quote_quotes as q')->whereNull('q.deleted_at'), $viewer, 'q.owner_id')->where('q.created_at', '>=', $start->copy()->utc())
            ->leftJoin('quote_versions as v', 'v.id', '=', 'q.current_version_id')
            ->get(['q.status', 'v.grand_total', 'v.fx_rate', 'v.margin_pct']);
        $closed = $rows->whereIn('status', ['aprobada', 'convertida', 'rechazada', 'vencida', 'cancelada']);
        $won = $rows->whereIn('status', ['aprobada', 'convertida']);

        return [
            'total' => $rows->count(),
            'open' => $rows->whereIn('status', ['borrador', 'enviada', 'vista', 'negociacion'])->count(),
            'won' => $won->count(),
            'win_rate' => $closed->isEmpty() ? null : round($won->count() / $closed->count() * 100, 1),
            'pipeline_pen' => round($rows->whereIn('status', ['enviada', 'vista', 'negociacion'])->sum(fn (object $row): float => (float) $row->grand_total * (float) ($row->fx_rate ?: 1)), 2),
            'avg_margin' => $rows->whereNotNull('margin_pct')->isEmpty() ? null : round((float) $rows->whereNotNull('margin_pct')->avg('margin_pct'), 1),
            'by_status' => $rows->countBy('status')->map(fn (int $count, string $status): array => ['status' => $status, 'count' => $count])->sortByDesc('count')->values()->all(),
        ];
    }

    private function collection(User $viewer, Carbon $now): array
    {
        $rows = Portfolio::scope(DB::table('fin_receivables as f')->join('crm_clients as c', 'c.id', '=', 'f.client_id')->whereNull('f.deleted_at'), $viewer, 'c.owner_id')
            ->where('f.status', '<>', 'cancelada')
            ->get(['f.amount', 'f.paid_amount', 'f.fx_rate', 'f.status', 'f.due_date']);
        $pen = fn (object $row, float $value): float => $value * (float) ($row->fx_rate ?: 1);
        $open = $rows->whereNotIn('status', ['pagada']);
        $billed = $rows->sum(fn (object $row): float => $pen($row, (float) $row->amount));
        $paid = $rows->sum(fn (object $row): float => $pen($row, (float) $row->paid_amount));
        $today = $now->toDateString();
        $overdue = $open->filter(fn (object $row): bool => $row->status === 'vencida' || $row->due_date < $today);

        $bucket = function (object $row) use ($now): string {
            $late = (int) Carbon::parse($row->due_date)->diffInDays($now->copy()->startOfDay(), false);

            return match (true) {
                $late <= 0 => 'Por vencer',
                $late <= 30 => '1 a 30 días',
                $late <= 60 => '31 a 60 días',
                default => 'Más de 60 días',
            };
        };
        $grouped = $open->groupBy($bucket);
        $aging = collect(['Por vencer', '1 a 30 días', '31 a 60 días', 'Más de 60 días'])->map(fn (string $label): array => [
            'label' => $label,
            'amount' => round($grouped->get($label, collect())->sum(fn ($row): float => $pen($row, (float) $row->amount - (float) $row->paid_amount)), 2),
            'count' => $grouped->get($label, collect())->count(),
        ])->all();

        return [
            'open' => round($open->sum(fn (object $row): float => $pen($row, (float) $row->amount - (float) $row->paid_amount)), 2),
            'overdue' => round($overdue->sum(fn (object $row): float => $pen($row, (float) $row->amount - (float) $row->paid_amount)), 2),
            'overdue_count' => $overdue->count(),
            'collected' => round($paid, 2),
            'billed' => round($billed, 2),
            'rate' => $billed > 0 ? round($paid / $billed * 100, 1) : null,
            'aging' => $aging,
        ];
    }

    private function breakdown(User $viewer, Carbon $start, string $column): array
    {
        return $this->reservations($viewer)->whereIn('r.status', self::SOLD)->where('r.created_at', '>=', $start->copy()->utc())
            ->selectRaw("{$column} as label, sum(r.total_amount * r.fx_rate) as sales, count(*) as total")->groupBy('label')->orderByDesc('sales')->get()
            ->map(fn (object $row): array => ['label' => (string) $row->label, 'sales' => round((float) $row->sales, 2), 'count' => (int) $row->total])->all();
    }

    private function advisors(Carbon $start): array
    {
        return DB::table('booking_reservations as r')->join('iam_users as u', 'u.id', '=', 'r.owner_id')->whereNull('r.deleted_at')
            ->whereIn('r.status', self::SOLD)->where('r.created_at', '>=', $start->copy()->utc())
            ->selectRaw('u.name as label, sum(r.total_amount * r.fx_rate) as sales, count(*) as total')->groupBy('u.name')->orderByDesc('sales')->get()
            ->map(fn (object $row): array => ['label' => $row->label, 'sales' => round((float) $row->sales, 2), 'count' => (int) $row->total])->all();
    }
}
