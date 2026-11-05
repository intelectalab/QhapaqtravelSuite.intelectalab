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

final class HomeDashboard
{
    private const COUNTED = ['confirmada', 'en_operacion', 'completada', 'pendiente_pago', 'pendiente_proveedor', 'parcial', 'incidencia', 'reprogramada'];

    private const ACTIVE = ['confirmada', 'en_operacion', 'pendiente_pago', 'pendiente_proveedor', 'parcial', 'incidencia', 'reprogramada'];

    private const OPEN_QUOTES = ['enviada', 'vista', 'negociacion'];

    private const MONTHS = 6;

    public function __construct(private readonly TenantContext $context)
    {
    }

    public function build(User $viewer): array
    {
        $today = $this->now()->toDateString();
        $months = $this->months($viewer);
        $current = $months->last();
        $previous = $months->slice(-2, 1)->first();
        $receivables = $this->receivables($viewer);
        $active = $this->reservations($viewer)->whereIn('r.status', self::ACTIVE);

        return [
            'today' => $today,
            'kpis' => [
                'sales' => $current['sales'],
                'sales_previous' => $previous['sales'] ?? 0,
                'previous_month' => $previous['label'] ?? null,
                'margin' => $current['margin'],
                'margin_previous' => $previous['margin'] ?? null,
                'receivable' => $receivables['open'],
                'overdue' => $receivables['overdue'],
                'active_reservations' => (clone $active)->count(),
                'passengers' => (int) DB::table('booking_passengers')->whereIn('reservation_id', (clone $active)->select('r.id'))->count(),
            ],
            'months' => $months->values(),
            'attention' => $this->attention($viewer, $today, $receivables),
            'departures' => $this->departures($viewer, $today),
        ];
    }

    private function now(): Carbon
    {
        return Carbon::now($this->context->tenant()->timezone ?: 'America/Lima');
    }

    private function reservations(User $viewer): Builder
    {
        return Portfolio::scope(DB::table('booking_reservations as r')->whereNull('r.deleted_at'), $viewer, 'r.owner_id');
    }

    private function months(User $viewer): Collection
    {
        $timezone = $this->context->tenant()->timezone ?: 'America/Lima';
        $start = $this->now()->startOfMonth()->subMonths(self::MONTHS - 1);

        $sales = $this->reservations($viewer)->whereIn('r.status', self::COUNTED)->where('r.created_at', '>=', $start->copy()->utc())
            ->selectRaw("to_char(r.created_at at time zone ?, 'YYYY-MM') as month, sum(r.total_amount * r.fx_rate) as sales", [$timezone])
            ->groupBy('month')->pluck('sales', 'month');

        $costs = $this->reservations($viewer)->whereIn('r.status', self::COUNTED)->where('r.created_at', '>=', $start->copy()->utc())
            ->join('booking_reservation_services as s', 's.reservation_id', '=', 'r.id')->where('s.status', '<>', 'cancelado')
            ->selectRaw("to_char(r.created_at at time zone ?, 'YYYY-MM') as month, sum(s.cost_amount * coalesce(s.fx_rate, 1)) as cost", [$timezone])
            ->groupBy('month')->pluck('cost', 'month');

        return collect(range(0, self::MONTHS - 1))->map(function (int $offset) use ($start, $sales, $costs): array {
            $month = $start->copy()->addMonths($offset);
            $key = $month->format('Y-m');
            $amount = (int) round((float) ($sales[$key] ?? 0));
            $cost = (int) round((float) ($costs[$key] ?? 0));

            return [
                'key' => $key,
                'label' => ucfirst(rtrim($month->locale('es')->isoFormat('MMM'), '.')),
                'sales' => $amount,
                'cost' => $cost,
                'margin' => $amount > 0 && $cost > 0 ? round(($amount - $cost) / $amount * 100, 1) : null,
            ];
        });
    }

    private function receivables(User $viewer): array
    {
        $rows = Portfolio::scope(
            DB::table('fin_receivables as f')->join('crm_clients as c', 'c.id', '=', 'f.client_id')->whereNull('f.deleted_at')->whereNotIn('f.status', ['pagada', 'cancelada']),
            $viewer,
            'c.owner_id',
        )->get(['f.amount', 'f.paid_amount', 'f.fx_rate', 'f.status', 'c.name']);

        $pen = fn (object $row) => ((float) $row->amount - (float) $row->paid_amount) * (float) ($row->fx_rate ?: 1);
        $overdue = $rows->where('status', 'vencida');

        return [
            'open' => (int) round($rows->sum($pen)),
            'overdue' => (int) round($overdue->sum($pen)),
            'overdue_count' => $overdue->count(),
            'overdue_clients' => $overdue->pluck('name')->unique()->values()->all(),
        ];
    }

    private function attention(User $viewer, string $today, array $receivables): array
    {
        $items = [];

        $incident = $this->reservations($viewer)->join('ops_incidents as i', 'i.reservation_id', '=', 'r.id')
            ->where('i.severity', 'critica')->whereNotIn('i.status', ['resuelta', 'cerrada'])
            ->orderByDesc('i.created_at')->first(['i.code', 'i.title', 'i.type', 'r.code as reservation']);
        if ($incident) {
            $items[] = ['kind' => 'incident', 'title' => $incident->title, 'detail' => "Reserva {$incident->reservation} · {$incident->type}", 'action' => 'Gestionar', 'href' => "/operaciones/incidencias/{$incident->code}"];
        }

        if ($receivables['overdue_count'] > 0) {
            $items[] = [
                'kind' => 'collection',
                'title' => $receivables['overdue_count'] === 1 ? '1 cobro vencido' : "{$receivables['overdue_count']} cobros vencidos",
                'amount' => $receivables['overdue'],
                'detail' => implode(' y ', $receivables['overdue_clients']),
                'action' => 'Ver cobros',
                'href' => '/finanzas/cobros',
            ];
        }

        $quote = Portfolio::scope(DB::table('quote_quotes as q')->join('crm_clients as c', 'c.id', '=', 'q.client_id'), $viewer, 'q.owner_id')
            ->whereNull('q.deleted_at')->whereIn('q.status', self::OPEN_QUOTES)->where('q.valid_until', '>=', $today)
            ->orderBy('q.valid_until')->first(['q.code', 'q.title', 'q.valid_until', 'c.name']);
        if ($quote) {
            $days = (int) Carbon::parse($today)->diffInDays(Carbon::parse($quote->valid_until));
            $items[] = [
                'kind' => 'quote',
                'title' => $days === 0 ? "La cotización de {$quote->name} vence hoy" : "La cotización de {$quote->name} vence en {$days} ".($days === 1 ? 'día' : 'días'),
                'detail' => str_replace(' — ', ' · ', $quote->title),
                'action' => 'Abrir',
                'href' => "/cotizaciones/{$quote->code}",
            ];
        }

        return $items;
    }

    private function departures(User $viewer, string $today): Collection
    {
        $rows = $this->reservations($viewer)->whereIn('r.status', self::ACTIVE)->where('r.travel_from', '>', $today)
            ->orderBy('r.travel_from')->limit(3)->get(['r.id', 'r.code', 'r.title', 'r.travel_from', 'r.status']);
        $passengers = DB::table('booking_passengers')->whereIn('reservation_id', $rows->pluck('id'))->selectRaw('reservation_id, count(*) as total')->groupBy('reservation_id')->pluck('total', 'reservation_id');

        return $rows->map(fn (object $row) => [
            'code' => $row->code,
            'title' => $row->title,
            'date' => $row->travel_from,
            'status' => $row->status,
            'passengers' => (int) ($passengers[$row->id] ?? 0),
        ]);
    }
}
