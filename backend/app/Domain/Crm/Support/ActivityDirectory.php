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

    public function __construct(private readonly TenantContext $context)
    {
    }

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
            'owner' => ['name' => $row->owner_name, 'color' => $row->owner_color],
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
