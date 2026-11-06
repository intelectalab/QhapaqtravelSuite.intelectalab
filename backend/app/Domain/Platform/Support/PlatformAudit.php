<?php

declare(strict_types=1);

namespace App\Domain\Platform\Support;

use App\Domain\Shared\Http\CursorPage;
use Illuminate\Database\Query\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

final class PlatformAudit
{
    public const GROUPS = [
        'Tenant' => 'agencias',
        'Factura plataforma' => 'facturacion',
        'Cupón' => 'facturacion',
        'Política de cobranza' => 'facturacion',
        'Plan' => 'catalogo',
        'Feature flag' => 'catalogo',
        'Job' => 'tareas',
        'Sesión de plataforma' => 'sesiones',
        'Acceso' => 'sesiones',
        'Solicitud comercial' => 'agencias',
    ];

    private const CONNECTION = 'pgsql_platform';

    public function recent(int $limit = 500): Collection
    {
        $db = DB::connection(self::CONNECTION);
        $tenants = $db->table('tenants')->pluck('commercial_name', 'code');
        $features = $db->table('features')->pluck('label', 'key');

        return $db->table('audit_events as a')->leftJoin('platform_users as u', 'u.id', '=', 'a.actor_id')->whereNull('a.tenant_id')
            ->orderByDesc('a.occurred_at')->limit($limit)
            ->get(['a.id', 'a.code', 'a.actor_type', 'a.entity', 'a.entity_id', 'a.action', 'a.is_critical', 'a.before_value', 'a.after_value', 'a.ip', 'a.occurred_at', 'u.name as actor'])
            ->map(fn (object $event) => [
                'id' => $event->id,
                'code' => (int) $event->code,
                'at' => Carbon::parse($event->occurred_at)->toIso8601String(),
                'actor' => $event->actor ?? ($event->actor_type === 'system' ? 'Sistema' : null),
                'actor_type' => $event->actor_type,
                'entity' => $event->entity,
                'group' => self::GROUPS[$event->entity] ?? 'otros',
                'entity_id' => $event->entity_id,
                'subject' => $this->subject($event, $tenants, $features),
                'action' => $event->action,
                'critical' => (bool) $event->is_critical,
                'before' => $event->before_value,
                'after' => $event->after_value,
                'ip' => $event->ip,
            ]);
    }

    public function page(Request $request): array
    {
        $db = DB::connection(self::CONNECTION);
        $tenants = $db->table('tenants')->pluck('commercial_name', 'code');
        $features = $db->table('features')->pluck('label', 'key');
        $filters = CursorPage::filters($request);
        $query = $db->table('audit_events as a')->leftJoin('platform_users as u', 'u.id', '=', 'a.actor_id')->whereNull('a.tenant_id')
            ->when($filters['tenant'] ?? null, fn (Builder $q, string $code) => $q->where(fn (Builder $w) => $w->where('a.entity_id', $code)->orWhere('a.entity_id', 'like', '%@'.addcslashes($code, '%_\\'))))
            ->when($filters['entity'] ?? null, fn (Builder $q, string $entity) => $q->whereIn('a.entity', explode(',', $entity)))
            ->when($filters['action'] ?? null, fn (Builder $q, string $action) => $q->where('a.action', $action))
            ->when(isset($filters['critical']), fn (Builder $q) => $q->where('a.is_critical', filter_var($filters['critical'], FILTER_VALIDATE_BOOLEAN)))
            ->when((int) ($filters['days'] ?? 0) > 0, fn (Builder $q) => $q->where('a.occurred_at', '>=', now()->subDays((int) $filters['days'])))
            ->select(['a.id', 'a.code', 'a.actor_type', 'a.actor_id', 'a.actor_role', 'a.entity', 'a.entity_id', 'a.action', 'a.is_critical', 'a.before_value', 'a.after_value', 'a.diff', 'a.ip', 'a.user_agent', 'a.correlation_id', 'a.evidence', 'a.occurred_at', 'u.name as actor']);
        $kpis = CursorPage::isFirst($request) ? [
            'total' => (clone $query)->count(),
            'critical' => (clone $query)->where('a.is_critical', true)->count(),
            'denied' => (clone $query)->where('a.action', 'like', '%denegad%')->count(),
        ] : null;

        return CursorPage::respond($request, $query, ['occurred_at' => 'a.occurred_at', 'code' => 'a.code', 'entity' => 'a.entity', 'action' => 'a.action'], '-occurred_at', fn (object $event) => [
            'id' => $event->id,
            'code' => (int) $event->code,
            'actor_type' => $event->actor_type,
            'actor_id' => $event->actor_id,
            'actor_role' => $event->actor_role,
            'entity' => $event->entity,
            'entity_id' => $event->entity_id,
            'action' => $event->action,
            'is_critical' => (bool) $event->is_critical,
            'before_value' => $event->before_value,
            'after_value' => $event->after_value,
            'diff' => $event->diff ? json_decode((string) $event->diff, true) : null,
            'ip' => $event->ip,
            'user_agent' => $event->user_agent,
            'correlation_id' => $event->correlation_id,
            'evidence' => $event->evidence ? json_decode((string) $event->evidence, true) : null,
            'occurred_at' => Carbon::parse($event->occurred_at)->toIso8601String(),
            'at' => Carbon::parse($event->occurred_at)->toIso8601String(),
            'actor' => $event->actor ?? ($event->actor_type === 'system' ? 'Sistema' : null),
            'group' => self::GROUPS[$event->entity] ?? 'otros',
            'subject' => $this->subject($event, $tenants, $features),
            'critical' => (bool) $event->is_critical,
            'before' => $event->before_value,
            'after' => $event->after_value,
        ], $kpis === null ? [] : ['kpis' => $kpis]);
    }

    private function subject(object $event, Collection $tenants, Collection $features): string
    {
        if ($event->entity === 'Tenant') {
            return $tenants[$event->entity_id] ?? $event->entity_id;
        }

        if ($event->entity === 'Feature flag' && str_contains((string) $event->entity_id, '@')) {
            [$key, $target] = explode('@', (string) $event->entity_id, 2);

            return ($features[$key] ?? $key).' · '.($tenants[$target] ?? ucfirst($target));
        }

        return (string) $event->entity_id;
    }
}
