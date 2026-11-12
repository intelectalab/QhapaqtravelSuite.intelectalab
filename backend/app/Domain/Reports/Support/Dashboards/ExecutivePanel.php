<?php

declare(strict_types=1);

namespace App\Domain\Reports\Support\Dashboards;

use App\Domain\Iam\Models\User;
use App\Domain\Reports\Support\KpiReport;
use Illuminate\Support\Facades\DB;

final class ExecutivePanel
{
    private const FUNNEL = [
        'leads' => 'Leads recibidos',
        'qualified' => 'Calificados',
        'quoted' => 'Con cotización',
        'approved' => 'Aprobadas',
        'booked' => 'Convertidas en reserva',
    ];

    public function __construct(private readonly PanelData $data) {}

    public function build(User $viewer): array
    {
        $today = $this->data->today();
        $months = $this->data->months($viewer);
        $active = $this->data->reservations($viewer)->whereIn('r.status', PanelData::ACTIVE);
        $receivables = $this->data->receivables($viewer);
        $overdue = $receivables->filter(fn (object $row): bool => $this->data->overdue($row));
        $pipeline = $this->data->openOpportunities(null);
        $incidents = $this->data->openIncidents();

        return [
            'today' => $today,
            'month' => $this->data->monthLabel(),
            'kpis' => [
                ...$this->data->salesKpis($months),
                'pipeline' => ['amount' => round($pipeline->sum('amount_pen'), 2), 'count' => $pipeline->count()],
                'active' => [
                    'reservations' => (clone $active)->count(),
                    'passengers' => (int) DB::table('booking_passengers')->whereIn('reservation_id', (clone $active)->select('r.id'))->count(),
                ],
                'receivable' => [
                    'open' => round($receivables->sum(fn (object $row): float => $this->data->balance($row)), 2),
                    'overdue' => round($overdue->sum(fn (object $row): float => $this->data->balance($row)), 2),
                    'overdue_count' => $overdue->count(),
                ],
            ],
            'critical' => $this->data->critical($incidents),
            'months' => $months,
            'funnel' => $this->funnel($viewer),
            'services' => $this->data->services($today, $this->data->now()->addDays(6)->toDateString())->take(9)->map(fn (object $row): array => $this->data->serviceRow($row))->values(),
            'departures' => $this->data->departures(),
            'activities' => $this->data->activities(null, 6),
            'quotes' => $this->data->quotesFollowUp($viewer),
            'incidents' => $incidents->take(6)->values(),
            'channels' => $this->data->channels($viewer),
        ];
    }

    private function funnel(User $viewer): array
    {
        $start = $this->data->monthStart()->utc();
        $leads = DB::table('crm_leads')->whereNull('deleted_at')->where('status', '<>', 'duplicado')->where('created_at', '>=', $start)->pluck('status');
        $quotes = DB::table('quote_quotes')->whereNull('deleted_at')->where('status', '<>', 'borrador')->where('created_at', '>=', $start)->pluck('status');
        $booked = $this->data->reservations($viewer)->whereIn('r.status', KpiReport::SOLD)->whereNotNull('r.quote_id')->where('r.created_at', '>=', $start)->get(['r.total_amount', 'r.fx_rate']);
        $won = DB::table('crm_opportunities')->whereNull('deleted_at')->where('stage', 'ganada')->where('closed_at', '>=', $start)
            ->selectRaw('avg(extract(epoch from (closed_at - created_at)) / 86400) as days')->value('days');

        $counts = [
            'leads' => $leads->count(),
            'qualified' => $leads->filter(fn (string $status): bool => in_array($status, ['calificado', 'convertido'], true))->count(),
            'quoted' => $quotes->count(),
            'approved' => $quotes->filter(fn (string $status): bool => in_array($status, ['aprobada', 'convertida'], true))->count(),
            'booked' => $booked->count(),
        ];
        $sales = $booked->sum(fn (object $row): float => $this->data->pen((float) $row->total_amount, $row->fx_rate));

        return [
            'steps' => collect(self::FUNNEL)->map(fn (string $label, string $key): array => ['key' => $key, 'label' => $label, 'count' => $counts[$key]])->values(),
            'conversion' => $counts['leads'] > 0 ? round($counts['booked'] / $counts['leads'] * 100, 1) : null,
            'ticket' => $counts['booked'] > 0 ? round($sales / $counts['booked'], 2) : null,
            'cycle_days' => $won === null ? null : (int) round((float) $won),
        ];
    }
}
