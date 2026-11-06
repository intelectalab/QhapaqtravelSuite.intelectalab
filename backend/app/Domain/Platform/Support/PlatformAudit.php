<?php

declare(strict_types=1);

namespace App\Domain\Platform\Support;

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
