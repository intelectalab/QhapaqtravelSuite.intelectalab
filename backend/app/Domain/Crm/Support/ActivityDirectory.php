<?php

declare(strict_types=1);

namespace App\Domain\Crm\Support;

use App\Domain\Iam\Models\User;
use App\Domain\Shared\Tenancy\TenantContext;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

final class ActivityDirectory
{
    public const RELATIONS = [
        'lead' => ['table' => 'crm_leads', 'name' => 'full_name', 'path' => '/crm/leads/'],
        'opportunity' => ['table' => 'crm_opportunities', 'name' => 'title', 'path' => '/crm/oportunidades/'],
        'client' => ['table' => 'crm_clients', 'name' => 'name', 'path' => '/crm/clientes/'],
        'quote' => ['table' => 'quote_quotes', 'name' => 'title', 'path' => '/cotizaciones/'],
        'reservation' => ['table' => 'booking_reservations', 'name' => 'title', 'path' => '/reservas/'],
    ];

    public const OWNED = ['lead', 'opportunity', 'client', 'quote'];

    private const OPEN_QUOTES = ['borrador', 'enviada', 'vista', 'negociacion', 'aprobada'];

    public function __construct(private readonly TenantContext $context, private readonly RecordHistory $history) {}

    public function agenda(User $viewer): array
    {
        $rows = $this->scoped($viewer)->join('iam_users as u', 'u.id', '=', 'a.owner_id')
            ->select(['a.*', 'u.name as owner_name', 'u.avatar_color as owner_color'])
            ->orderBy('a.due_at')->get();
        $related = $this->relatedLabels($rows);
        $now = Carbon::now($this->timezone());
        $items = $rows->map(fn (object $row) => $this->summary($row, $related, $now));

        return [
            'items' => $items->values(),
            'kpis' => [
                'overdue' => $items->where('bucket', 'overdue')->count(),
                'today' => $items->where('bucket', 'today')->count(),
                'week' => $items->where('bucket', 'week')->count(),
                'done_week' => $items->filter(fn (array $item) => $item['status'] === 'completada' && $item['completed_at'] && Carbon::parse($item['completed_at'])->gte($now->copy()->subDays(7)))->count(),
            ],
            'now' => $now->toIso8601String(),
        ];
    }

    public function related(User $viewer, array $relations): Collection
    {
        $relations = array_filter(array_map(fn (array $ids) => array_values(array_filter($ids)), $relations));

        if ($relations === []) {
            return collect();
        }

        $rows = $this->scoped($viewer)->join('iam_users as u', 'u.id', '=', 'a.owner_id')
            ->where(function (Builder $where) use ($relations): void {
                foreach ($relations as $type => $ids) {
                    $where->orWhere(fn (Builder $one) => $one->where('a.related_type', $type)->whereIn('a.related_id', $ids));
                }
            })
            ->select(['a.*', 'u.name as owner_name', 'u.avatar_color as owner_color'])
            ->orderByRaw("case when a.status = 'completada' then 1 else 0 end")->orderBy('a.due_at')->get();
        $related = $this->relatedLabels($rows);
        $now = Carbon::now($this->timezone());

        return $rows->map(fn (object $row) => [...$this->summary($row, $related, $now), 'merged' => $row->merged_from_lead_id !== null])->values();
    }

    public function find(User $viewer, string $code): ?array
    {
        $row = $this->scoped($viewer)
            ->join('iam_users as u', 'u.id', '=', 'a.owner_id')
            ->leftJoin('iam_users as c', 'c.id', '=', 'a.created_by')
            ->leftJoin('iam_users as d', 'd.id', '=', 'a.completed_by')
            ->where('a.code', $code)
            ->select(['a.*', 'u.name as owner_name', 'u.avatar_color as owner_color', 'c.name as creator_name', 'd.name as completer_name'])
            ->first();

        if ($row === null) {
            return null;
        }

        $now = Carbon::now($this->timezone());
        $previous = $row->previous_activity_id ? DB::table('crm_activities')->where('id', $row->previous_activity_id)->first(['code', 'subject']) : null;
        $next = DB::table('crm_activities')->where('previous_activity_id', $row->id)->first(['code', 'subject']);
        $merged = $row->merged_from_lead_id ? DB::table('crm_leads')->where('id', $row->merged_from_lead_id)->first(['code', 'full_name']) : null;

        return [
            ...$this->summary($row, $this->relatedLabels(collect([$row])), $now),
            'created_at' => Carbon::parse($row->created_at)->toIso8601String(),
            'created_by' => $row->creator_name,
            'completed_by' => $row->completer_name,
            'auto_closed' => (bool) $row->auto_closed,
            'previous' => $previous ? ['code' => $previous->code, 'subject' => $previous->subject] : null,
            'next' => $next ? ['code' => $next->code, 'subject' => $next->subject] : null,
            'merged_from' => $merged ? ['code' => $merged->code, 'name' => $merged->full_name] : null,
            'history' => $this->history->for([$row->code]),
        ];
    }

    public function scoped(User $viewer): Builder
    {
        return Portfolio::scope(DB::table('crm_activities as a'), $viewer, 'a.owner_id');
    }

    public function relatedOptions(User $viewer): array
    {
        $own = fn (Builder $query, string $column) => Portfolio::scope($query, $viewer, $column);

        return [
            'lead' => $own(DB::table('crm_leads')->whereNull('deleted_at')->whereIn('status', ['nuevo', 'contactado', 'calificado']), 'owner_id')->orderBy('full_name')->get(['code', 'full_name as name']),
            'opportunity' => $own(DB::table('crm_opportunities')->whereNull('deleted_at')->whereNotIn('stage', ['ganada', 'perdida']), 'owner_id')->orderBy('title')->get(['code', 'title as name']),
            'client' => $own(DB::table('crm_clients')->whereNull('deleted_at'), 'owner_id')->orderBy('name')->get(['code', 'name']),
            'quote' => $own(DB::table('quote_quotes')->whereNull('deleted_at')->whereIn('status', self::OPEN_QUOTES), 'owner_id')->orderBy('title')->get(['code', 'title as name']),
            'owners' => Portfolio::ownOnly($viewer) ? [] : (new Advisors)->all([...Advisors::ROLES, 'operations'])->values(),
        ];
    }

    private function relatedLabels(Collection $rows): array
    {
        $labels = [];
        foreach ($rows->whereNotNull('related_type')->groupBy('related_type') as $type => $group) {
            $config = self::RELATIONS[$type] ?? null;
            if ($config === null) {
                continue;
            }
            $labels[$type] = DB::table($config['table'])->whereIn('id', $group->pluck('related_id'))->get(['id', 'code', "{$config['name']} as name"])->keyBy('id');
        }

        return $labels;
    }

    private function summary(object $row, array $related, Carbon $now): array
    {
        $due = Carbon::parse($row->due_at)->setTimezone($this->timezone());
        $link = $row->related_type ? ($related[$row->related_type][$row->related_id] ?? null) : null;
        $bucket = match (true) {
            $row->status === 'completada' => 'done',
            $due->lt($now) => 'overdue',
            $due->isSameDay($now) => 'today',
            $due->lte($now->copy()->addDays(7)->endOfDay()) => 'week',
            default => 'later',
        };

        return [
            'code' => $row->code,
            'type' => $row->type,
            'subject' => $row->subject,
            'description' => $row->description,
            'status' => $row->status === 'completada' ? 'completada' : ($due->lt($now) ? 'vencida' : 'pendiente'),
            'bucket' => $bucket,
            'due_at' => $due->toIso8601String(),
            'result' => $row->result,
            'completed_at' => $row->completed_at ? Carbon::parse($row->completed_at)->toIso8601String() : null,
            'lock_version' => (int) $row->lock_version,
            'owner' => ['id' => $row->owner_id, 'name' => $row->owner_name, 'color' => $row->owner_color],
            'related' => $link ? [
                'type' => $row->related_type,
                'code' => $link->code,
                'name' => $link->name,
                'href' => self::RELATIONS[$row->related_type]['path'].$link->code,
            ] : null,
        ];
    }

    private function timezone(): string
    {
        return $this->context->tenant()->timezone ?: 'America/Lima';
    }
}
