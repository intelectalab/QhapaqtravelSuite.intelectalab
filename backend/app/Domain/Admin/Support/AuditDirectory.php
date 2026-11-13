<?php

declare(strict_types=1);

namespace App\Domain\Admin\Support;

use App\Domain\Iam\Models\User;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Http\CursorPage;
use App\Domain\Shared\Tenancy\TenantContext;
use Illuminate\Database\Query\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class AuditDirectory
{
    public const PERIODS = [1, 7, 30, 90, 0];

    public const ROLE_ENTITIES = ['Permiso', 'Rol'];

    private const ACTORS = ['system' => 'Sistema', 'platform_user' => 'Plataforma', 'api_client' => 'Integración por API'];

    public function __construct(private readonly TenantContext $context) {}

    public function page(Request $request, User $viewer): array
    {
        $filters = $this->filters($request, $viewer);
        $base = $this->filtered($filters);
        $meta = ['days' => $filters['days'], 'filters' => array_filter($filters, fn (mixed $value): bool => $value !== null && $value !== [])];

        if (CursorPage::isFirst($request)) {
            $meta += $this->aggregates($base, $filters['days']);
        }

        return CursorPage::respond($request, $base->select($this->columns()), ['occurred_at' => 'a.occurred_at', 'code' => 'a.code', 'entity' => 'a.entity', 'action' => 'a.action'], '-occurred_at,-code', $this->row(...), $meta);
    }

    public function filtered(array $filters): Builder
    {
        $since = $filters['days'] > 0 ? Carbon::now($this->context->timezone())->startOfDay()->subDays($filters['days'] - 1) : null;

        return $this->query()
            ->when($since, fn (Builder $q) => $q->where('a.occurred_at', '>=', $since))
            ->when($filters['entity'] !== [], fn (Builder $q) => $q->whereIn('a.entity', $filters['entity']))
            ->when($filters['action'], fn (Builder $q, string $action) => $q->where('a.action', $action))
            ->when($filters['critical'] !== null, fn (Builder $q) => $q->where('a.is_critical', $filters['critical']))
            ->when($filters['user'], fn (Builder $q, string $user) => $q->where(fn (Builder $w) => Str::isUuid($user) ? $w->where('a.actor_id', $user) : $w->where('u.code', $user)));
    }

    public function filters(Request $request, User $viewer): array
    {
        $raw = CursorPage::filters($request);
        $days = (int) ($raw['days'] ?? $request->query('days', '30'));
        $entity = array_values(array_filter(array_map('trim', explode(',', (string) ($raw['entity'] ?? $request->query('entity', '')))), fn (string $value): bool => $value !== ''));

        if (! $viewer->can('admin.audit.view')) {
            $entity = $entity === [] ? self::ROLE_ENTITIES : array_values(array_intersect($entity, self::ROLE_ENTITIES));
            $entity = $entity === [] ? ['—'] : $entity;
        }

        return [
            'days' => in_array($days, self::PERIODS, true) ? $days : 30,
            'entity' => $entity,
            'action' => $raw['action'] ?? null,
            'critical' => isset($raw['critical']) ? filter_var($raw['critical'], FILTER_VALIDATE_BOOLEAN) : null,
            'user' => $raw['user'] ?? $raw['actor'] ?? null,
        ];
    }

    public function find(string $id): array
    {
        $event = $this->query()->where(fn (Builder $q) => Str::isUuid($id) ? $q->where('a.id', $id) : (ctype_digit($id) ? $q->where('a.code', (int) $id) : $q->whereRaw('false')))->first([...$this->columns(), 'a.diff', 'a.evidence', 'a.user_agent']);

        if ($event === null) {
            throw ApiException::notFound('El evento no existe.');
        }

        $related = $this->query()
            ->where('a.id', '<>', $event->id)
            ->where(fn (Builder $query) => $query->where('a.correlation_id', $event->correlation_id)->orWhere(fn (Builder $same) => $same->where('a.entity', $event->entity)->where('a.entity_id', $event->entity_id)))
            ->orderByDesc('a.occurred_at')
            ->limit(12)
            ->get($this->columns())
            ->map($this->row(...));

        return [
            ...$this->row($event),
            'diff' => $event->diff ? json_decode((string) $event->diff, true) : null,
            'evidence' => $event->evidence ? json_decode((string) $event->evidence, true) : null,
            'user_agent' => $event->user_agent,
            'related' => $related->values(),
        ];
    }

    public function recent(array $entities, int $limit = 8): array
    {
        return $this->query()->whereIn('a.entity', $entities)->orderByDesc('a.occurred_at')->limit($limit)->get($this->columns())->map($this->row(...))->values()->all();
    }

    public function columns(): array
    {
        return ['a.id', 'a.code', 'a.occurred_at', 'a.entity', 'a.entity_id', 'a.action', 'a.before_value', 'a.after_value', 'a.is_critical', 'a.actor_type', 'a.actor_id', 'a.actor_role', 'a.ip', 'a.correlation_id', 'u.name as actor_name', 'u.code as actor_code'];
    }

    public function row(object $row): array
    {
        return [
            'id' => $row->id,
            'code' => (int) $row->code,
            'actor_type' => $row->actor_type,
            'actor_id' => $row->actor_id,
            'actor_role' => $row->actor_role,
            'entity' => $row->entity,
            'entity_id' => $row->entity_id,
            'action' => $row->action,
            'is_critical' => (bool) $row->is_critical,
            'before_value' => $row->before_value,
            'after_value' => $row->after_value,
            'ip' => $row->ip,
            'correlation_id' => $row->correlation_id,
            'occurred_at' => $row->occurred_at,
            'at' => $row->occurred_at,
            'before' => $row->before_value,
            'after' => $row->after_value,
            'critical' => (bool) $row->is_critical,
            'actor' => $row->actor_name ?? (self::ACTORS[$row->actor_type] ?? 'Sistema'),
            'actor_code' => $row->actor_code,
            'role' => $row->actor_role,
            'correlation' => $row->correlation_id,
        ];
    }

    private function aggregates(Builder $base, int $days): array
    {
        $today = Carbon::now($this->context->timezone())->startOfDay();
        $total = (clone $base)->count();
        $daily = DB::table('audit_events')
            ->where('occurred_at', '>=', $today->copy()->subDays(29))
            ->selectRaw("to_char(occurred_at at time zone ?, 'YYYY-MM-DD') as day, count(*) as total", [$this->context->timezone()])
            ->groupBy('day')
            ->pluck('total', 'day');
        $top = fn (string $column, int $limit) => (clone $base)->selectRaw("{$column} as label, count(*) as total")->groupByRaw($column)->orderByDesc('total')->limit($limit)->get()->map(fn (object $row): array => ['label' => (string) $row->label, 'total' => (int) $row->total])->values()->all();

        return [
            'total' => $total,
            'kpis' => [
                'total' => $total,
                'critical' => (clone $base)->where('a.is_critical', true)->count(),
                'actors' => (clone $base)->distinct()->count('a.actor_id'),
                'today' => DB::table('audit_events')->where('occurred_at', '>=', $today)->count(),
                'denied' => (clone $base)->where('a.action', 'like', '%denegad%')->count(),
            ],
            'top_entities' => $top('a.entity', 6),
            'by_action' => $top('a.action', 8),
            'by_actor' => $top('coalesce(u.name, a.actor_type)', 8),
            'critical_by_action' => (clone $base)->where('a.is_critical', true)->selectRaw('a.action as label, count(*) as total')->groupBy('a.action')->orderByDesc('total')->limit(8)->get()->map(fn (object $row): array => ['label' => (string) $row->label, 'total' => (int) $row->total])->values()->all(),
            'daily' => collect(range(29, 0))->map(function (int $back) use ($daily, $today): array {
                $day = $today->copy()->subDays($back)->toDateString();

                return ['date' => $day, 'total' => (int) ($daily[$day] ?? 0)];
            })->values()->all(),
        ];
    }

    private function query(): Builder
    {
        return DB::table('audit_events as a')->leftJoin('iam_users as u', 'u.id', '=', 'a.actor_id');
    }
}
