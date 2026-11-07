<?php

declare(strict_types=1);

namespace App\Domain\Admin\Support;

use App\Domain\Iam\Models\User;
use App\Domain\Shared\Tenancy\TenantContext;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

final class ApiDirectory
{
    public const SCOPES = [
        'catalog:read' => 'Leer el catálogo',
        'availability:read' => 'Consultar disponibilidad',
        'quotes:read' => 'Leer cotizaciones',
        'quotes:write' => 'Crear cotizaciones',
        'reservations:read' => 'Leer reservas',
        'reservations:write' => 'Crear reservas',
        'crm:write' => 'Registrar contactos',
        'payments:read' => 'Leer pagos',
        'invoices:read' => 'Leer comprobantes',
    ];

    public const EVENTS = [
        'reservation.confirmed' => 'Reserva confirmada',
        'reservation.cancelled' => 'Reserva cancelada',
        'payment.applied' => 'Pago aplicado',
        'invoice.issued' => 'Comprobante emitido',
        'lead.created' => 'Contacto nuevo',
        'quote.sent' => 'Cotización enviada',
        'quote.approved' => 'Cotización aprobada',
        'voucher.issued' => 'Voucher emitido',
        'incident.created' => 'Incidencia registrada',
        'incident.resolved' => 'Incidencia resuelta',
    ];

    public const API_VERSION = '2026-09-01';

    public function __construct(private readonly TenantContext $context, private readonly AuditDirectory $audit) {}

    public function overview(User $viewer): array
    {
        $limits = DB::connection('pgsql_platform')->table('plan_limits')->where('plan_id', $this->context->tenant()->plan_id)->whereIn('metric', ['api_keys', 'webhooks', 'api_calls_month', 'api_rate_per_min'])->pluck('value', 'metric');
        $keys = $this->keys();
        $deliveries = $this->deliveries()->get();
        $hooks = $this->webhooks($deliveries);
        $apps = DB::table('integration_oauth_apps as a')
            ->join('oauth_clients as c', 'c.id', '=', 'a.client_id')
            ->orderBy('c.name')
            ->get(['a.vendor', 'a.allowed_scopes', 'a.status', 'a.created_at', 'c.name', 'c.redirect_uris', 'c.updated_at'])
            ->map(fn (object $row): array => [
                'name' => $row->name,
                'vendor' => $row->vendor,
                'scopes' => PgArray::parse($row->allowed_scopes),
                'redirects' => (array) json_decode((string) $row->redirect_uris, true),
                'status' => $row->status,
                'created_at' => $row->created_at,
                'last_token_at' => $row->updated_at,
            ]);
        $calls = DB::connection('pgsql_platform')->table('usage_monthly')->where('tenant_id', $this->context->idOrFail())->where('metric', 'api_calls_month')->orderByDesc('month')->value('value');

        return [
            'keys' => $keys->values(),
            'webhooks' => $hooks->values(),
            'deliveries' => $deliveries->map(fn (object $row): array => [
                'code' => $row->code,
                'webhook' => $row->webhook,
                'url' => $row->url,
                'event' => $row->event_type,
                'entity' => $row->entity_code,
                'attempt' => (int) $row->attempt,
                'status' => $row->status,
                'http' => $row->http_status !== null ? (int) $row->http_status : null,
                'ms' => $row->duration_ms !== null ? (int) $row->duration_ms : null,
                'error' => $row->error,
                'next_retry_at' => $row->next_retry_at,
                'at' => $row->created_at,
            ])->values(),
            'apps' => $apps->values(),
            'limits' => [
                'api_keys' => isset($limits['api_keys']) ? (int) $limits['api_keys'] : null,
                'webhooks' => isset($limits['webhooks']) ? (int) $limits['webhooks'] : null,
                'calls_month' => isset($limits['api_calls_month']) ? (int) $limits['api_calls_month'] : null,
                'rate_per_min' => isset($limits['api_rate_per_min']) ? (int) $limits['api_rate_per_min'] : null,
            ],
            'calls_month' => (int) ($calls ?? 0),
            'scopes' => collect(self::SCOPES)->map(fn (string $label, string $value): array => ['value' => $value, 'label' => $label])->values(),
            'events' => collect(self::EVENTS)->map(fn (string $label, string $value): array => ['value' => $value, 'label' => $label])->values(),
            'history' => $this->audit->recent(['Clave de API', 'Webhook'], 8),
            'can_manage' => $viewer->can('admin.api.manage'),
        ];
    }

    public function keys(): Collection
    {
        return DB::table('integration_api_keys as k')
            ->leftJoin('iam_users as u', 'u.id', '=', 'k.created_by')
            ->leftJoin('iam_users as r', 'r.id', '=', 'k.revoked_by')
            ->orderByRaw("case k.status when 'active' then 0 else 1 end")
            ->orderByDesc('k.created_at')
            ->get(['k.code', 'k.name', 'k.environment', 'k.prefix', 'k.last4', 'k.scopes', 'k.ip_allowlist', 'k.expires_at', 'k.last_used_at', 'k.last_used_ip', 'k.status', 'k.revoked_at', 'k.revoke_reason', 'k.created_at', 'u.name as created_by', 'r.name as revoked_by'])
            ->map(fn (object $row): array => [
                'code' => $row->code,
                'name' => $row->name,
                'environment' => $row->environment,
                'masked' => $row->prefix.'••••'.$row->last4,
                'scopes' => PgArray::parse($row->scopes),
                'ips' => PgArray::parse($row->ip_allowlist),
                'expires_at' => $row->expires_at,
                'last_used_at' => $row->last_used_at,
                'last_used_ip' => $row->last_used_ip,
                'status' => $row->status === 'active' && $row->expires_at !== null && $row->expires_at < Carbon::today()->toDateString() ? 'expired' : $row->status,
                'revoked_at' => $row->revoked_at,
                'revoked_by' => $row->revoked_by,
                'revoke_reason' => $row->revoke_reason,
                'created_at' => $row->created_at,
                'created_by' => $row->created_by,
            ])
            ->values();
    }

    public function deliveries(): Builder
    {
        return DB::table('integration_webhook_deliveries as d')
            ->join('integration_webhooks as w', 'w.id', '=', 'd.webhook_id')
            ->orderByDesc('d.created_at')
            ->limit(300)
            ->select(['d.code', 'd.event_type', 'd.event_id', 'd.entity_code', 'd.attempt', 'd.status', 'd.http_status', 'd.duration_ms', 'd.error', 'd.next_retry_at', 'd.created_at', 'w.code as webhook', 'w.url']);
    }

    public function webhooks(?Collection $deliveries = null): Collection
    {
        $deliveries ??= $this->deliveries()->get();

        return DB::table('integration_webhooks')
            ->where('status', '<>', 'deleted')
            ->orderBy('code')
            ->get(['id', 'code', 'url', 'description', 'events', 'secret_prefix', 'api_version', 'status', 'consecutive_failures', 'disabled_reason', 'created_at', 'updated_at'])
            ->map(function (object $row) use ($deliveries): array {
                $mine = $deliveries->where('webhook', $row->code);
                $last = $mine->first();

                return [
                    'code' => $row->code,
                    'url' => $row->url,
                    'description' => $row->description,
                    'events' => PgArray::parse($row->events),
                    'secret' => $row->secret_prefix.'••••',
                    'api_version' => $row->api_version,
                    'status' => $row->status,
                    'failures' => (int) $row->consecutive_failures,
                    'disabled_reason' => $row->disabled_reason,
                    'delivered' => $mine->where('status', 'delivered')->count(),
                    'total' => $mine->count(),
                    'last_at' => $last?->created_at,
                    'last_status' => $last?->status,
                    'created_at' => $row->created_at,
                ];
            })
            ->values();
    }
}
