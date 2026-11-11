<?php

declare(strict_types=1);

namespace App\Domain\Reports\Support\Dashboards;

use App\Domain\Iam\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

final class SalesPanel
{
    public function __construct(private readonly PanelData $data) {}

    public function build(User $viewer): array
    {
        $me = (string) $viewer->getKey();
        $today = $this->data->today();
        $limit = $this->data->now()->addDays(7)->toDateString();
        $open = $this->data->openOpportunities($me);
        $closed = DB::table('crm_opportunities')->whereNull('deleted_at')->where('owner_id', $me)->whereIn('stage', PanelData::CLOSED_STAGES)->pluck('stage');
        $won = $closed->filter(fn (string $stage): bool => $stage === 'ganada')->count();
        $leads = DB::table('crm_leads')->whereNull('deleted_at')->where('owner_id', $me)->where('status', '<>', 'duplicado')->pluck('status');
        $quotes = DB::table('quote_quotes')->whereNull('deleted_at')->where('owner_id', $me)->whereIn('status', PanelData::OPEN_QUOTES)->get(['status', 'valid_until']);
        $expiring = $quotes->filter(fn (object $row): bool => $row->status !== 'borrador' && $row->valid_until !== null && (string) $row->valid_until <= $limit);
        $activities = $this->data->activities($me, 200);
        $endOfDay = $this->data->now()->endOfDay();
        $due = $activities->filter(fn (array $row): bool => $row['status'] === 'vencida' || ($row['due_at'] !== null && Carbon::parse($row['due_at'])->lte($endOfDay)));
        $commissions = $this->commissions($me);
        $stages = DB::table('crm_pipeline_stages')->where('is_closed', false)->orderBy('sort_order')->get(['code', 'name']);

        return [
            'today' => $today,
            'month' => $this->data->monthLabel(),
            'kpis' => [
                'pipeline' => ['amount' => round($open->sum('amount_pen'), 2), 'count' => $open->count(), 'weighted' => round($open->sum(fn (object $row): float => $row->amount_pen * (int) $row->probability / 100), 2)],
                'quotes' => ['open' => $quotes->count(), 'expiring' => $expiring->count()],
                'activities' => ['due' => $due->count(), 'pending' => $activities->count()],
                'conversion' => [
                    'opportunities' => $closed->isEmpty() ? null : round($won / $closed->count() * 100, 1),
                    'leads' => $leads->isEmpty() ? null : round($leads->filter(fn (string $status): bool => $status === 'convertido')->count() / $leads->count() * 100, 1),
                ],
                'commission' => $commissions,
            ],
            'stages' => $stages->map(fn (object $stage): array => [
                'code' => $stage->code,
                'name' => $stage->name,
                'count' => $open->where('stage', $stage->code)->count(),
                'amount' => round($open->where('stage', $stage->code)->sum('amount_pen'), 2),
            ])->values(),
            'closing' => $open->sortBy('expected_close_date')->take(4)->map(fn ($row): array => ['code' => $row->code, 'title' => $row->title, 'stage' => $row->stage, 'close' => $row->expected_close_date])->values(),
            'activities' => ['due' => $due->values(), 'next' => $activities->reject(fn (array $row): bool => $due->contains('code', $row['code']))->take(3)->values()],
            'expiring' => $this->data->quotesFollowUp($viewer, $me, 50)->filter(fn (array $row): bool => (string) $row['valid_until'] <= $limit)->values(),
            'leads' => $this->leads($me),
            'pool' => $this->pool(),
            'trips' => $this->trips($me),
            'can' => ['take' => $viewer->can('crm.leads.manage'), 'complete' => $viewer->can('crm.activities.manage'), 'quote' => $viewer->can('quotes.create')],
        ];
    }

    private function commissions(string $me): array
    {
        $month = $this->data->monthStart();
        $rows = DB::table('fin_commissions as c')->join('booking_reservations as r', 'r.id', '=', 'c.reservation_id')->whereNull('c.deleted_at')
            ->where('c.beneficiary_user_id', $me)->where('c.status', '<>', 'anulada')
            ->whereBetween('r.travel_from', [$month->toDateString(), $month->copy()->endOfMonth()->toDateString()])
            ->get(['c.amount', 'c.currency', 'c.fx_rate']);

        return [
            'amount' => round($rows->sum(fn (object $row): float => $this->data->pen((float) $row->amount, $row->fx_rate)), 2),
            'by_currency' => $rows->groupBy('currency')->map(fn ($group, string $currency): array => ['currency' => $currency, 'amount' => round((float) $group->sum('amount'), 2)])->values(),
        ];
    }

    private function leads(string $me): array
    {
        return DB::table('crm_leads')->whereNull('deleted_at')->where('owner_id', $me)->whereIn('status', ['nuevo', 'contactado', 'calificado'])
            ->orderByDesc('created_at')->limit(5)->get(['code', 'full_name', 'destination_label', 'pax', 'score', 'status'])
            ->map(fn (object $row): array => ['code' => $row->code, 'name' => $row->full_name, 'destination' => $row->destination_label, 'pax' => $row->pax === null ? null : (int) $row->pax, 'score' => $row->score === null ? null : (int) $row->score, 'status' => $row->status])->all();
    }

    private function pool(): array
    {
        return DB::table('crm_leads')->whereNull('deleted_at')->whereNull('owner_id')->whereIn('status', ['nuevo', 'contactado'])
            ->orderBy('created_at')->limit(5)->get(['code', 'full_name', 'source_code', 'destination_label', 'pax', 'lock_version'])
            ->map(fn (object $row): array => ['code' => $row->code, 'name' => $row->full_name, 'source' => $row->source_code, 'destination' => $row->destination_label, 'pax' => $row->pax === null ? null : (int) $row->pax, 'lock_version' => (int) $row->lock_version])->all();
    }

    private function trips(string $me): array
    {
        $rows = DB::table('booking_reservations')->whereNull('deleted_at')->where('owner_id', $me)->whereIn('status', PanelData::ACTIVE)
            ->where('travel_from', '>=', $this->data->today())->orderBy('travel_from')->limit(4)->get(['id', 'code', 'title', 'travel_from', 'status']);
        $passengers = $this->data->passengers($rows->pluck('id'));

        return $rows->map(fn (object $row): array => ['code' => $row->code, 'title' => $row->title, 'date' => $row->travel_from, 'status' => $row->status, 'passengers' => (int) ($passengers[$row->id] ?? 0)])->all();
    }
}
