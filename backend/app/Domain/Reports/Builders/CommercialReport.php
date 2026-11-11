<?php

declare(strict_types=1);

namespace App\Domain\Reports\Builders;

use App\Domain\Iam\Models\User;
use App\Domain\Reports\Support\ReportFilters;
use App\Domain\Reports\Support\ReportShape as S;
use Illuminate\Support\Facades\DB;

final class CommercialReport extends ReportBuilder
{
    private const OPEN = ['calificacion', 'descubrimiento', 'cotizacion', 'negociacion'];

    public function build(User $viewer, ReportFilters $filters): array
    {
        $own = $this->own($viewer);
        $leads = $this->owned('crm_leads', 'l', $viewer, $filters)->get(['l.status', 'l.source_code', 'l.owner_id', 'l.created_at']);
        $opps = $this->owned('crm_opportunities', 'o', $viewer, $filters)->get(['o.stage', 'o.amount', 'o.owner_id']);
        $quotes = $this->owned('quote_quotes', 'q', $viewer, $filters)->get(['q.status', 'q.owner_id']);
        $sold = $this->reservations($viewer, $filters)->get(['r.owner_id', DB::raw("{$this->sales()} as sales"), 'r.created_at']);
        $valid = $leads->where('status', '<>', 'duplicado');
        $converted = $valid->where('status', 'convertido');
        $won = $opps->where('stage', 'ganada');
        $decided = $opps->whereIn('stage', ['ganada', 'perdida']);
        $salesTotal = (float) $sold->sum('sales');
        $sources = S::labels(['source', 'lead_source']);
        $quoteMonths = $this->owned('quote_quotes', 'q', $viewer, $filters)->selectRaw($filters->monthExpression('q.created_at').' as m, count(*) as total')->groupBy('m')->pluck('total', 'm');
        $soldMonths = $this->reservations($viewer, $filters)->selectRaw($filters->monthExpression('r.created_at').' as m, count(*) as total')->groupBy('m')->pluck('total', 'm');
        $leadMonthsTz = $this->owned('crm_leads', 'l', $viewer, $filters)->selectRaw($filters->monthExpression('l.created_at').' as m, count(*) as total')->groupBy('m')->pluck('total', 'm');
        $users = DB::table('iam_users')->whereIn('id', $opps->pluck('owner_id')->merge($quotes->pluck('owner_id'))->merge($sold->pluck('owner_id'))->filter()->unique())->pluck('name', 'id');
        $rows = [];

        foreach ($users as $id => $name) {
            $mine = $opps->where('owner_id', $id);
            $mineDecided = $mine->whereIn('stage', ['ganada', 'perdida']);
            $mineQuotes = $quotes->where('owner_id', $id);
            $mineSold = $sold->where('owner_id', $id);
            $rows[] = [
                'seller' => $name,
                'opportunities' => $mine->count(),
                'pipeline' => round((float) $mine->whereIn('stage', self::OPEN)->sum('amount'), 2),
                'won' => round((float) $mine->where('stage', 'ganada')->sum('amount'), 2),
                'win_rate' => S::rate($mine->where('stage', 'ganada')->count(), $mineDecided->count()),
                'quotes' => $mineQuotes->count(),
                'approved' => $mineQuotes->whereIn('status', ['aprobada', 'convertida'])->count(),
                'reservations' => $mineSold->count(),
                'sales' => round((float) $mineSold->sum('sales'), 2),
            ];
        }

        usort($rows, fn (array $a, array $b): int => $b['sales'] <=> $a['sales']);
        $bySource = $valid->groupBy(fn (object $row): string => (string) ($row->source_code ?? 'sin_fuente'))->map(fn ($group, string $code): array => S::point($sources[$code] ?? ($code === 'sin_fuente' ? 'Sin fuente' : $code), (float) (S::rate($group->where('status', 'convertido')->count(), $group->count()) ?? 0), ['count' => $group->count()]))->sortByDesc('count');

        return [
            'kpis' => [
                S::kpi('leads', $own ? 'Mis leads' : 'Leads recibidos', $leads->count()),
                S::kpi('conversion', 'Conversión de leads', S::rate($converted->count(), $valid->count()), 'percent', "{$converted->count()} convertidos"),
                S::kpi('pipeline', 'Pipeline abierto', round((float) $opps->whereIn('stage', self::OPEN)->sum('amount'), 2), 'money', $opps->whereIn('stage', self::OPEN)->count().' oportunidades'),
                S::kpi('win_rate', 'Win rate', S::rate($won->count(), $decided->count()), 'percent', "{$won->count()} ganadas de {$decided->count()}"),
                S::kpi('ticket', $own ? 'Mis ventas' : 'Ticket promedio', $own ? $salesTotal : ($sold->count() > 0 ? $salesTotal / $sold->count() : null), 'money'),
            ],
            'charts' => [
                S::chart('months', 'Leads, cotizaciones y reservas por mes', 'lines', collect($filters->months())->map(fn (string $label, string $key): array => ['label' => $label, 'leads' => (int) ($leadMonthsTz[$key] ?? 0), 'quotes' => (int) ($quoteMonths[$key] ?? 0), 'reservations' => (int) ($soldMonths[$key] ?? 0)])->all(), 'number', ['keys' => ['leads' => 'Leads', 'quotes' => 'Cotizaciones', 'reservations' => 'Reservas']]),
                S::chart('funnel', 'Embudo comercial', 'funnel', [
                    S::point('Leads', $leads->count()),
                    S::point('Convertidos', $converted->count()),
                    S::point('Oportunidades', $opps->count()),
                    S::point('Cotizaciones', $quotes->count()),
                    S::point('Aprobadas', $quotes->whereIn('status', ['aprobada', 'convertida'])->count()),
                    S::point('Reservas', $sold->count()),
                ]),
                S::chart('sources', 'Conversión por fuente', 'hbar', $bySource->all(), 'percent'),
                ...($own ? [] : [S::chart('sellers', 'Ventas por vendedor', 'hbar', array_map(fn (array $row): array => S::point($row['seller'], $row['sales']), array_slice($rows, 0, 8)), 'money')]),
            ],
            'table' => S::table([
                S::column('seller', 'Vendedor'),
                S::column('opportunities', 'Oport.', 'number'),
                S::column('pipeline', 'Pipeline', 'money'),
                S::column('won', 'Ganado', 'money'),
                S::column('win_rate', 'Win rate', 'percent'),
                S::column('quotes', 'Cotiz.', 'number'),
                S::column('approved', 'Aprob.', 'number'),
                S::column('reservations', 'Reservas', 'number'),
                S::column('sales', 'Ventas', 'money'),
            ], $rows, [
                'seller' => 'Total',
                'opportunities' => array_sum(array_column($rows, 'opportunities')),
                'pipeline' => round(array_sum(array_column($rows, 'pipeline')), 2),
                'won' => round(array_sum(array_column($rows, 'won')), 2),
                'win_rate' => S::rate($won->count(), $decided->count()),
                'quotes' => array_sum(array_column($rows, 'quotes')),
                'approved' => array_sum(array_column($rows, 'approved')),
                'reservations' => array_sum(array_column($rows, 'reservations')),
                'sales' => round(array_sum(array_column($rows, 'sales')), 2),
            ]),
        ];
    }
}
