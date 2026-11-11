<?php

declare(strict_types=1);

namespace App\Domain\Platform\Support;

use App\Domain\Shared\Http\CursorPage;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Database\Query\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class PlatformAudit
{
    public const GROUPS = [
        'Tenant' => 'agencias',
        'Suscripción' => 'facturacion',
        'Factura plataforma' => 'facturacion',
        'Cupón' => 'facturacion',
        'Política de cobranza' => 'facturacion',
        'Plan' => 'catalogo',
        'Plan × regla' => 'catalogo',
        'Feature flag' => 'catalogo',
        'Job' => 'tareas',
        'Integración' => 'tareas',
        'Sesión de plataforma' => 'sesiones',
        'Acceso' => 'sesiones',
        'Solicitud comercial' => 'agencias',
        'Configuración de plataforma' => 'configuracion',
        'Personalización de plataforma' => 'configuracion',
    ];

    private const CONNECTION = 'pgsql_platform';

    private const COLUMNS = ['a.id', 'a.code', 'a.actor_type', 'a.actor_id', 'a.actor_role', 'a.entity', 'a.entity_id', 'a.action', 'a.is_critical', 'a.before_value', 'a.after_value', 'a.diff', 'a.ip', 'a.user_agent', 'a.correlation_id', 'a.evidence', 'a.occurred_at', 'u.name as actor', 'u.email as actor_email'];

    private ?array $lookups = null;

    public function recent(int $limit = 500): Collection
    {
        return $this->base()->orderByDesc('a.occurred_at')->limit($limit)->get(self::COLUMNS)
            ->map(fn (object $event) => $this->summary($event));
    }

    public function entries(array $entities, int $limit = 8): array
    {
        return $this->base()->whereIn('a.entity', $entities)->orderByDesc('a.occurred_at')->limit($limit)
            ->get(['a.code', 'a.occurred_at', 'a.entity', 'a.entity_id', 'a.action', 'a.before_value', 'a.after_value', 'a.is_critical', 'a.actor_type', 'a.ip', 'u.name as actor'])
            ->map(fn (object $event): array => [
                'code' => (int) $event->code,
                'at' => Carbon::parse($event->occurred_at)->toIso8601String(),
                'entity' => $event->entity,
                'entity_id' => $event->entity_id,
                'action' => $event->action,
                'before' => $event->before_value,
                'after' => $event->after_value,
                'critical' => (bool) $event->is_critical,
                'actor' => $event->actor ?? ($event->actor_type === 'system' ? 'Sistema' : 'Plataforma'),
                'actor_code' => null,
                'role' => 'Super Admin',
                'ip' => $event->ip,
            ])->values()->all();
    }

    public function page(Request $request): array
    {
        $filters = CursorPage::filters($request);
        $query = $this->base()
            ->when($filters['tenant'] ?? null, fn (Builder $q, string $code) => $q->where(fn (Builder $w) => $w->whereIn('a.entity_id', $this->subjectsOf($code))->orWhere('a.entity_id', 'like', '%@'.addcslashes($code, '%_\\'))))
            ->when($filters['entity'] ?? null, fn (Builder $q, string $entity) => $q->whereIn('a.entity', explode(',', $entity)))
            ->when($filters['action'] ?? null, fn (Builder $q, string $action) => $q->where('a.action', $action))
            ->when(isset($filters['critical']), fn (Builder $q) => $q->where('a.is_critical', filter_var($filters['critical'], FILTER_VALIDATE_BOOLEAN)))
            ->when((int) ($filters['days'] ?? 0) > 0, fn (Builder $q) => $q->where('a.occurred_at', '>=', now()->subDays((int) $filters['days'])))
            ->select(self::COLUMNS);
        $kpis = CursorPage::isFirst($request) ? [
            'total' => (clone $query)->count(),
            'critical' => (clone $query)->where('a.is_critical', true)->count(),
            'denied' => (clone $query)->where('a.action', 'like', '%denegad%')->count(),
        ] : null;

        return CursorPage::respond($request, $query, ['occurred_at' => 'a.occurred_at', 'code' => 'a.code', 'entity' => 'a.entity', 'action' => 'a.action'], '-occurred_at', fn (object $event) => $this->full($event), $kpis === null ? [] : ['kpis' => $kpis]);
    }

    public function find(string $id): ?array
    {
        $event = Str::isUuid($id) ? $this->base()->where('a.id', $id)->first(self::COLUMNS) : null;

        if ($event === null) {
            return null;
        }

        $related = $this->base()->where('a.id', '<>', $event->id)
            ->where(fn (Builder $q) => $q->where(fn (Builder $w) => $w->where('a.entity', $event->entity)->where('a.entity_id', $event->entity_id))
                ->when($event->correlation_id, fn (Builder $w) => $w->orWhere('a.correlation_id', $event->correlation_id)))
            ->orderByDesc('a.occurred_at')->limit(10)->get(self::COLUMNS)
            ->map(fn (object $item) => [...$this->summary($item), 'same_request' => $event->correlation_id !== null && $item->correlation_id === $event->correlation_id]);

        return [...$this->full($event), 'actor_email' => $event->actor_email, 'related' => $related->values()];
    }

    private function base(): Builder
    {
        return $this->db()->table('audit_events as a')->leftJoin('platform_users as u', 'u.id', '=', 'a.actor_id')->whereNull('a.tenant_id');
    }

    private function summary(object $event): array
    {
        return [
            'id' => $event->id,
            'code' => (int) $event->code,
            'at' => Carbon::parse($event->occurred_at)->toIso8601String(),
            'actor' => $event->actor ?? ($event->actor_type === 'system' ? 'Sistema' : null),
            'actor_type' => $event->actor_type,
            'entity' => $event->entity,
            'group' => self::GROUPS[$event->entity] ?? 'otros',
            'entity_id' => $event->entity_id,
            'subject' => $this->subject($event),
            'tenant' => $this->tenantOf($event),
            'action' => $event->action,
            'critical' => (bool) $event->is_critical,
            'before' => $event->before_value,
            'after' => $event->after_value,
            'ip' => $event->ip,
            'correlation_id' => $event->correlation_id,
        ];
    }

    private function full(object $event): array
    {
        return [
            ...$this->summary($event),
            'actor_id' => $event->actor_id,
            'actor_role' => $event->actor_role,
            'is_critical' => (bool) $event->is_critical,
            'before_value' => $event->before_value,
            'after_value' => $event->after_value,
            'diff' => $event->diff ? json_decode((string) $event->diff, true) : null,
            'user_agent' => $event->user_agent,
            'evidence' => $event->evidence ? json_decode((string) $event->evidence, true) : null,
            'occurred_at' => Carbon::parse($event->occurred_at)->toIso8601String(),
        ];
    }

    private function subject(object $event): string
    {
        $lookups = $this->lookups();

        if ($event->entity === 'Tenant') {
            return $lookups['tenants'][$event->entity_id]['name'] ?? $event->entity_id;
        }

        if (str_contains((string) $event->entity_id, '@')) {
            [$key, $target] = explode('@', (string) $event->entity_id, 2);
            $label = $event->entity === 'Feature flag' ? ($lookups['features'][$key] ?? $key) : $key;

            return $label.' · '.($lookups['tenants'][$target]['name'] ?? ucfirst($target));
        }

        return (string) $event->entity_id;
    }

    private function tenantOf(object $event): ?array
    {
        $lookups = $this->lookups();
        $id = (string) $event->entity_id;
        $code = match (true) {
            $event->entity === 'Tenant' => $id,
            str_contains($id, '@') => explode('@', $id, 2)[1],
            default => $lookups['documents'][$id] ?? null,
        };

        return $code !== null && isset($lookups['tenants'][$code]) ? ['code' => $code, 'name' => $lookups['tenants'][$code]['name']] : null;
    }

    private function subjectsOf(string $code): array
    {
        return [$code, ...array_keys(array_filter($this->lookups()['documents'], fn (string $tenant) => $tenant === $code))];
    }

    private function lookups(): array
    {
        if ($this->lookups !== null) {
            return $this->lookups;
        }

        $db = $this->db();
        $tenants = $db->table('tenants')->get(['id', 'code', 'commercial_name']);
        $codes = $tenants->pluck('code', 'id');
        $documents = $db->table('platform_invoices')->get(['series', 'number', 'tenant_id'])
            ->mapWithKeys(fn (object $invoice) => [PlatformSequence::format(trim((string) $invoice->series), (int) $invoice->number) => $codes[$invoice->tenant_id] ?? null])
            ->merge($db->table('subscriptions')->get(['code', 'tenant_id'])->mapWithKeys(fn (object $subscription) => [$subscription->code => $codes[$subscription->tenant_id] ?? null]))
            ->filter();

        return $this->lookups = [
            'tenants' => $tenants->mapWithKeys(fn (object $tenant) => [$tenant->code => ['name' => $tenant->commercial_name]])->all(),
            'features' => $db->table('features')->pluck('label', 'key')->all(),
            'documents' => $documents->all(),
        ];
    }

    private function db(): ConnectionInterface
    {
        return DB::connection(self::CONNECTION);
    }
}
