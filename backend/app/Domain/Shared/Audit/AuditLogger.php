<?php

declare(strict_types=1);

namespace App\Domain\Shared\Audit;

use App\Domain\Shared\Tenancy\TenantContext;
use App\Domain\Shared\Tenancy\TenantDatabase;
use App\Http\Middleware\AssignCorrelationId;
use Illuminate\Contracts\Auth\Authenticatable;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Request;

final class AuditLogger
{
    private const CRITICAL = [
        'login', 'asignar', 'aprobar', 'rechazar', 'cancelar', 'crear_desde_cotizacion', 'revertir', 'cambio_precio',
        'descuento_override', 'emitir', 'otorgar_permiso', 'revocar_permiso', 'suspender', 'reactivar', 'alta',
        'desactivar', 'resetear_mfa', 'exportar', 'acceso_denegado', 'cambio_plan', 'crear_rol', 'cambio_rol',
        'facturar', 'exportar_denegado',
    ];

    public function __construct(
        private readonly TenantContext $context,
        private readonly AuditCodeGenerator $codes,
    ) {
    }

    public function log(
        string $entity,
        string $entityId,
        string $action,
        ?string $before = null,
        ?string $after = null,
        ?array $diff = null,
        ?array $evidence = null,
        ?Authenticatable $actor = null,
        ?string $connection = null,
    ): void {
        $actor ??= Auth::user();
        $tenantId = $this->context->id();

        DB::connection($connection)->table('audit_events')->insert([
            'tenant_id' => $tenantId,
            'code' => $this->codes->next($tenantId, $connection),
            'actor_type' => $this->actorType($actor),
            'actor_id' => $actor?->getAuthIdentifier(),
            'actor_role' => $this->actorRole($actor),
            'entity' => mb_substr($entity, 0, 40),
            'entity_id' => mb_substr($entityId, 0, 80),
            'action' => mb_substr($action, 0, 40),
            'is_critical' => in_array($action, self::CRITICAL, true),
            'before_value' => $before,
            'after_value' => $after,
            'diff' => $diff === null ? null : json_encode($diff, JSON_UNESCAPED_UNICODE),
            'ip' => Request::ip(),
            'user_agent' => mb_substr((string) Request::userAgent(), 0, 250) ?: null,
            'correlation_id' => mb_substr(AssignCorrelationId::current(), 0, 40),
            'evidence' => $evidence === null ? null : json_encode($evidence, JSON_UNESCAPED_UNICODE),
            'occurred_at' => now(),
        ]);
    }

    public function logOutsideTransaction(string $entity, string $entityId, string $action, ?string $before = null, ?string $after = null): void
    {
        $tenantId = $this->context->id();

        if ($tenantId === null) {
            DB::connection('pgsql_platform')->transaction(
                fn () => $this->log($entity, $entityId, $action, $before, $after, connection: 'pgsql_platform'),
            );

            return;
        }

        app(TenantDatabase::class)->run(
            $tenantId,
            fn () => $this->log($entity, $entityId, $action, $before, $after, connection: 'pgsql_audit'),
            connection: 'pgsql_audit',
        );
    }

    private function actorType(?Authenticatable $actor): string
    {
        return match (true) {
            $actor === null => 'system',
            $actor instanceof \App\Domain\Platform\Models\PlatformUser => 'platform_user',
            $actor instanceof \App\Domain\Integrations\Models\ApiClient => 'api_client',
            default => 'user',
        };
    }

    private function actorRole(?Authenticatable $actor): ?string
    {
        if ($actor === null || ! method_exists($actor, 'getRoleNames')) {
            return null;
        }

        return mb_substr((string) $actor->getRoleNames()->first(), 0, 60) ?: null;
    }
}
