<?php

declare(strict_types=1);

namespace App\Domain\Admin\Support;

use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Tenancy\TenantContext;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

final class AuditDirectory
{
    private const LIMIT = 1500;

    private const ACTORS = ['system' => 'Sistema', 'platform_user' => 'Plataforma', 'api_client' => 'Integración por API'];

    public function __construct(private readonly TenantContext $context) {}

    public function list(int $days): array
    {
        $today = Carbon::now($this->context->timezone())->startOfDay();
        $since = $days > 0 ? $today->copy()->subDays($days - 1) : null;
        $base = $this->query()->when($since, fn (Builder $query) => $query->where('a.occurred_at', '>=', $since));
        $total = (clone $base)->count();
        $rows = (clone $base)->orderByDesc('a.occurred_at')->orderByDesc('a.code')->limit(self::LIMIT)->get($this->columns())->map($this->row(...));
        $daily = DB::table('audit_events')
            ->where('occurred_at', '>=', $today->copy()->subDays(29))
            ->selectRaw("to_char(occurred_at at time zone ?, 'YYYY-MM-DD') as day, count(*) as total", [$this->context->timezone()])
            ->groupBy('day')
            ->pluck('total', 'day');

        return [
            'days' => $days,
            'total' => $total,
            'truncated' => $total > self::LIMIT,
            'events' => $rows->values(),
            'kpis' => [
                'total' => $total,
                'critical' => (clone $base)->where('a.is_critical', true)->count(),
                'actors' => (clone $base)->distinct()->count('a.actor_id'),
                'today' => DB::table('audit_events')->where('occurred_at', '>=', $today)->count(),
                'denied' => (clone $base)->where('a.action', 'like', '%denegad%')->count(),
            ],
            'top_entities' => (clone $base)->selectRaw('a.entity as label, count(*) as total')->groupBy('a.entity')->orderByDesc('total')->limit(6)->get()->map(fn (object $row): array => ['label' => $row->label, 'total' => (int) $row->total])->values(),
            'daily' => collect(range(29, 0))->map(function (int $back) use ($daily, $today): array {
                $day = $today->copy()->subDays($back)->toDateString();

                return ['date' => $day, 'total' => (int) ($daily[$day] ?? 0)];
            })->values(),
        ];
    }

    public function find(string $code): array
    {
        if (! ctype_digit($code)) {
            throw ApiException::notFound('El evento no existe.');
        }

        $event = $this->query()->where('a.code', (int) $code)->first([...$this->columns(), 'a.diff', 'a.evidence', 'a.user_agent']);

        if ($event === null) {
            throw ApiException::notFound('El evento no existe.');
        }

        $related = $this->query()
            ->where('a.code', '<>', (int) $code)
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

    private function query(): Builder
    {
        return DB::table('audit_events as a')->leftJoin('iam_users as u', 'u.id', '=', 'a.actor_id');
    }

    private function columns(): array
    {
        return ['a.code', 'a.occurred_at', 'a.entity', 'a.entity_id', 'a.action', 'a.before_value', 'a.after_value', 'a.is_critical', 'a.actor_type', 'a.actor_role', 'a.ip', 'a.correlation_id', 'u.name as actor_name', 'u.code as actor_code'];
    }

    private function row(object $row): array
    {
        return [
            'code' => (string) $row->code,
            'at' => $row->occurred_at,
            'entity' => $row->entity,
            'entity_id' => $row->entity_id,
            'action' => $row->action,
            'before' => $row->before_value,
            'after' => $row->after_value,
            'critical' => (bool) $row->is_critical,
            'actor' => $row->actor_name ?? (self::ACTORS[$row->actor_type] ?? 'Sistema'),
            'actor_code' => $row->actor_code,
            'role' => $row->actor_role,
            'ip' => $row->ip,
            'correlation' => $row->correlation_id,
        ];
    }
}
