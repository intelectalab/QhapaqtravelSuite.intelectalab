<?php

declare(strict_types=1);

namespace App\Domain\Reports\Builders;

use App\Domain\Crm\Support\Portfolio;
use App\Domain\Iam\Models\User;
use App\Domain\Reports\Support\ReportFilters;
use App\Domain\Reports\Support\ReportShape as S;
use Illuminate\Support\Facades\DB;

final class ClientsReport extends ReportBuilder
{
    public function build(User $viewer, ReportFilters $filters): array
    {
        $clients = $filters->ownerSede(Portfolio::clients(DB::table('crm_clients as c')->whereNull('c.deleted_at'), $viewer, 'c'), 'c.owner_id')
            ->leftJoin('iam_users as u', 'u.id', '=', 'c.owner_id')
            ->get(['c.id', 'c.code', 'c.name', 'c.kind', 'c.country', 'c.segment_code', 'c.nps_last', 'u.name as owner']);
        $sales = $this->reservations($viewer, $filters)->whereIn('r.client_id', $clients->pluck('id'))->selectRaw("r.client_id, count(*) as total, sum({$this->sales()}) as sales")->groupBy('r.client_id')->get()->keyBy('client_id');
        $quotes = $filters->between(DB::table('quote_quotes as q')->whereNull('q.deleted_at')->whereIn('q.client_id', $clients->pluck('id')), 'q.created_at')->selectRaw('q.client_id, count(*) as total')->groupBy('q.client_id')->pluck('total', 'client_id');
        $segments = S::labels(['segment', 'client_segment']);
        $buying = $clients->filter(fn (object $row): bool => isset($sales[$row->id]));
        $total = (float) $sales->sum('sales');
        $scored = $clients->whereNotNull('nps_last');
        $promoters = $scored->filter(fn (object $row): bool => (int) $row->nps_last >= 9)->count();
        $detractors = $scored->filter(fn (object $row): bool => (int) $row->nps_last <= 6)->count();
        $foreign = $clients->filter(fn (object $row): bool => $row->country !== null && $row->country !== 'Perú')->count();
        $rows = $clients->map(fn (object $row): array => [
            'id' => $row->id,
            'name' => $row->name,
            'segment' => $segments[$row->segment_code] ?? ($row->segment_code ?: '—'),
            'country' => $row->country,
            'quotes' => (int) ($quotes[$row->id] ?? 0),
            'reservations' => (int) ($sales[$row->id]->total ?? 0),
            'sales' => round((float) ($sales[$row->id]->sales ?? 0), 2),
            'nps' => $row->nps_last === null ? null : (int) $row->nps_last,
            'owner' => $row->owner,
        ])->sortByDesc('sales')->values();

        return [
            'kpis' => [
                S::kpi('clients', 'Clientes', $clients->count(), 'number', $clients->where('kind', 'empresa')->count().' empresas · '.$clients->where('kind', 'persona')->count().' personas'),
                S::kpi('buying', 'Con reservas', $buying->count(), 'number', S::rate($buying->count(), $clients->count()) !== null ? S::rate($buying->count(), $clients->count()).' % de la cartera' : null),
                S::kpi('average', 'Venta por cliente', $buying->isEmpty() ? null : $total / $buying->count(), 'money'),
                S::kpi('nps', 'NPS', $scored->isEmpty() ? null : (int) round(($promoters - $detractors) / $scored->count() * 100), 'number', "{$scored->count()} respuestas"),
                S::kpi('foreign', 'Extranjeros', $foreign, 'number', S::rate($foreign, $clients->count()) !== null ? S::rate($foreign, $clients->count()).' %' : null),
            ],
            'charts' => [
                S::chart('segments', 'Clientes por segmento', 'donut', $rows->countBy('segment')->map(fn (int $count, string $segment): array => S::point($segment, $count))->all()),
                S::chart('top', 'Clientes con más ventas', 'hbar', $rows->where('sales', '>', 0)->take(8)->map(fn (array $row): array => S::point($row['name'], $row['sales']))->values()->all(), 'money'),
                S::chart('countries', 'País de origen', 'hbar', $rows->countBy(fn (array $row): string => (string) ($row['country'] ?: 'Sin país'))->sortDesc()->take(8)->map(fn (int $count, string $country): array => S::point($country, $count))->all()),
            ],
            'table' => S::table([
                S::column('name', 'Cliente'),
                S::column('segment', 'Segmento', 'text', ['filter' => true]),
                S::column('country', 'País'),
                S::column('quotes', 'Cotiz.', 'number'),
                S::column('reservations', 'Reservas', 'number'),
                S::column('sales', 'Ventas', 'money'),
                S::column('nps', 'NPS', 'number'),
                S::column('owner', 'Responsable'),
            ], $rows->all(), null, '/crm/clientes/{id}'),
        ];
    }
}
