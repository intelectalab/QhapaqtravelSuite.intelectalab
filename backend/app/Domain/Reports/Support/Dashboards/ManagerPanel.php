<?php

declare(strict_types=1);

namespace App\Domain\Reports\Support\Dashboards;

use App\Domain\Crm\Support\Portfolio;
use App\Domain\Crm\Support\SalesTargetDirectory;
use App\Domain\Crm\Support\TargetPeriod;
use App\Domain\Iam\Models\User;
use App\Domain\Inbox\Support\ApprovalInbox;
use App\Domain\Reports\Support\KpiReport;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

final class ManagerPanel
{
    public function __construct(private readonly PanelData $data, private readonly SalesTargetDirectory $targets) {}

    public function build(User $viewer): array
    {
        return [
            'approvals' => $this->approvals(),
            'quote_approvals' => $viewer->can('quotes.approve_internal') ? $this->quoteApprovals($viewer) : [],
            'targets' => $this->targets(),
            'team' => [
                'overdue_activities' => DB::table('crm_activities')->where('status', '<>', 'completada')->where('due_at', '<', $this->data->now()->utc())->count(),
                'uncontacted' => DB::table('crm_leads')->whereNull('deleted_at')->where('status', 'nuevo')->whereNotNull('owner_id')->count(),
                'unassigned' => DB::table('crm_leads')->whereNull('deleted_at')->whereNull('owner_id')->whereNotIn('status', ['descartado', 'convertido', 'duplicado'])->count(),
            ],
            'advisors' => Portfolio::ownOnly($viewer) ? [] : $this->advisors(),
        ];
    }

    private function quoteApprovals(User $viewer): array
    {
        return app(ApprovalInbox::class)->items($viewer)
            ->filter(fn (array $item): bool => $item['type'] === 'quote' && $item['status'] === 'pendiente' && $item['can_decide'])
            ->take(5)->values()->all();
    }

    private function approvals(): array
    {
        $rows = DB::table('collab_approval_requests as a')->leftJoin('iam_users as u', 'u.id', '=', 'a.requester_id')->where('a.status', 'pendiente')
            ->orderByRaw('a.due_at asc nulls last')->orderBy('a.created_at')
            ->get(['a.code', 'a.request_type', 'a.title', 'a.subject_code', 'a.amount', 'a.currency', 'a.due_at', 'a.current_level', 'a.total_levels', 'u.name as requester']);

        return [
            'by_type' => $rows->countBy('request_type')->map(fn (int $count, string $type): array => ['type' => $type, 'label' => ApprovalInbox::TYPES[$type] ?? $type, 'count' => $count])->sortByDesc('count')->values(),
            'items' => $rows->take(6)->map(fn (object $row): array => [
                'code' => $row->code,
                'type' => ApprovalInbox::TYPES[$row->request_type] ?? $row->request_type,
                'title' => $row->title,
                'subject' => $row->subject_code,
                'amount' => $row->amount === null ? null : round((float) $row->amount, 2),
                'currency' => $row->currency,
                'due_at' => $row->due_at,
                'level' => "{$row->current_level}/{$row->total_levels}",
                'requester' => $row->requester,
            ])->values(),
        ];
    }

    private function targets(): ?array
    {
        $period = $this->data->now()->format('Y-m');
        $rows = DB::table('crm_sales_targets')->where('scope_type', 'asesor')->where('period_key', $period)->where('status', 'vigente')->get();
        if ($rows->isEmpty()) {
            return null;
        }

        $today = $this->data->now();
        $progress = $rows->map(fn (object $row): array => $this->targets->progress($row, $today));

        return [
            'period' => TargetPeriod::label($period),
            'count' => $rows->count(),
            'goal_sales' => round((float) $rows->sum('goal_sales_pen'), 2),
            'sales' => round((float) $progress->sum('sales'), 2),
            'goal_margin' => round((float) $rows->sum('goal_margin_pen'), 2),
            'margin' => round((float) $progress->sum('margin'), 2),
        ];
    }

    private function advisors(): Collection
    {
        $users = DB::table('iam_users as u')->join('model_has_roles as m', 'm.model_id', '=', 'u.id')->join('roles as r', 'r.id', '=', 'm.role_id')
            ->whereNull('u.deleted_at')->where('u.status', 'activo')->whereIn('r.name', ['sales', 'manager'])
            ->orderBy('u.name')->get(['u.id', 'u.name'])->unique('id');
        $ids = $users->pluck('id');
        $opportunities = DB::table('crm_opportunities')->whereNull('deleted_at')->whereIn('owner_id', $ids)->get(['owner_id', 'stage', 'amount', 'currency']);
        $quotes = DB::table('quote_quotes as q')->leftJoin('quote_versions as v', 'v.id', '=', 'q.current_version_id')->whereNull('q.deleted_at')->whereIn('q.owner_id', $ids)->get(['q.owner_id', 'q.status', 'v.margin_pct']);
        $leads = DB::table('crm_leads')->whereNull('deleted_at')->whereIn('owner_id', $ids)->whereIn('status', ['nuevo', 'contactado', 'calificado'])->selectRaw('owner_id, count(*) as total')->groupBy('owner_id')->pluck('total', 'owner_id');
        $overdue = DB::table('crm_activities')->whereIn('owner_id', $ids)->where('status', '<>', 'completada')->where('due_at', '<', $this->data->now()->utc())->selectRaw('owner_id, count(*) as total')->groupBy('owner_id')->pluck('total', 'owner_id');
        $sold = DB::table('booking_reservations')->whereNull('deleted_at')->whereIn('owner_id', $ids)->whereIn('status', KpiReport::SOLD)->where('created_at', '>=', $this->data->monthStart()->utc())
            ->selectRaw('owner_id, sum(total_amount * fx_rate) as sales')->groupBy('owner_id')->pluck('sales', 'owner_id');

        return $users->map(function (object $user) use ($opportunities, $quotes, $leads, $overdue, $sold): array {
            $mine = $opportunities->where('owner_id', $user->id);
            $open = $mine->whereNotIn('stage', PanelData::CLOSED_STAGES);
            $won = $mine->where('stage', 'ganada')->count();
            $decided = $won + $mine->where('stage', 'perdida')->count();
            $margins = $quotes->where('owner_id', $user->id)->where('status', '<>', 'borrador')->whereNotNull('margin_pct');

            return [
                'name' => $user->name,
                'leads' => (int) ($leads[$user->id] ?? 0),
                'pipeline' => round($open->sum(fn (object $row): float => $this->data->opportunityPen($row)), 2),
                'open' => $open->count(),
                'quotes' => $quotes->where('owner_id', $user->id)->whereIn('status', PanelData::OPEN_QUOTES)->count(),
                'sold' => round((float) ($sold[$user->id] ?? 0), 2),
                'conversion' => $decided > 0 ? round($won / $decided * 100, 1) : null,
                'margin' => $margins->isEmpty() ? null : round((float) $margins->avg('margin_pct'), 1),
                'overdue' => (int) ($overdue[$user->id] ?? 0),
            ];
        })->sortByDesc('sold')->values();
    }
}
