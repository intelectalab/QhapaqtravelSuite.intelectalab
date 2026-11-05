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

/**
 * Auditoría de acciones críticas en `audit_events` (spec 00 §3.6 y §9; PROC-063). Tabla particionada por mes,
 * append-only (trigger `app_forbid_update_delete` + REVOKE UPDATE/DELETE): solo INSERT.
 *
 *   $audit->log('Reserva', $reservation->code, 'crear_desde_cotizacion', before: 'COT-2026-00191 v2', after: 'confirmada · 243144.90');
 *
 * - Escritura SÍNCRONA dentro de la transacción de negocio: si la transacción falla, no hay evento.
 * - `acceso_denegado` y `login_fallido` van en transacción propia (logOutsideTransaction), porque la
 *   solicitud termina en 4xx y SetPostgresTenant hace ROLLBACK.
 * - `entity` = nombre en español del catálogo (“Cotización”, “Reserva”, “Acceso”…); `entity_id` = código legible o ruta.
 * - `is_critical` según la lista de spec 00 §9.
 * - Nunca guardar datos personales completos en before/after (documento, teléfono): usar códigos o máscaras.
 */
final class AuditLogger
{
    /** Spec 00 §9: acciones críticas (is_critical = true). Cada módulo agrega las suyas aquí. */
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

    /**
     * @param  array<string, mixed>|null  $diff
     * @param  array<string, mixed>|null  $evidence
     */
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

    /**
     * Para `acceso_denegado` y `login_fallido`: nueva conexión lógica fuera de la transacción de la solicitud.
     * Se usa la conexión `pgsql_audit` (misma BD y usuario qhapaq_app, otra conexión PDO) para que el ROLLBACK
     * de la solicitud no borre el evento. Supuesto: definir `pgsql_audit` en config/database.php.
     */
    public function logOutsideTransaction(string $entity, string $entityId, string $action, ?string $before = null, ?string $after = null): void
    {
        $tenantId = $this->context->id();

        if ($tenantId === null) {
            // Evento de plataforma (tenant_id NULL): con app_role la política tenant_isolation lo rechazaría
            // (NULL = NULL no es verdadero); se escribe con la conexión de plataforma (política platform_access).
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
            $actor === null => 'system',                                         // “Sistema” (jobs, scheduler)
            $actor instanceof \App\Domain\Platform\Models\PlatformUser => 'platform_user',
            $actor instanceof \App\Domain\Integrations\Models\ApiClient => 'api_client', // API key / OAuth (fase 3)
            default => 'user',
        };
    }

    private function actorRole(?Authenticatable $actor): ?string
    {
        if ($actor === null || ! method_exists($actor, 'getRoleNames')) {
            return null;
        }

        return mb_substr((string) $actor->getRoleNames()->first(), 0, 60) ?: null; // un rol por usuario (spec 00 §12-5)
    }
}
