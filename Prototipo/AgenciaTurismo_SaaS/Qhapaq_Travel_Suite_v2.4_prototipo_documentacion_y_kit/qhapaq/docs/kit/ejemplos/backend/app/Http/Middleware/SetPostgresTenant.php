<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Domain\Shared\Tenancy\TenantContext;
use App\Domain\Shared\Tenancy\TenantDatabase;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\Response;
use Throwable;

/**
 * Segunda barrera de aislamiento: fija `app.tenant_id` en PostgreSQL para que las políticas RLS
 * `tenant_isolation` (database/90_rls.sql) filtren TODA consulta de la solicitud.
 *
 * Patrón: una transacción por solicitud (database/README.md §5).
 *   BEGIN → select app_set_tenant(:tenant) → controlador → COMMIT (o ROLLBACK si hay excepción/5xx).
 *
 * Consecuencias que el programador debe conocer:
 *  - Las Actions usan `DB::transaction(...)` dentro de esta transacción → Laravel crea SAVEPOINTs; el valor
 *    de SET LOCAL se mantiene. Si una Action necesita su propia transacción con reintentos (deadlocks), debe
 *    volver a llamar TenantDatabase::apply() dentro del callback (lo hace TenantDatabase::run()).
 *  - Los listeners/jobs `afterCommit` se despachan después del COMMIT de esta transacción.
 *  - Las respuestas 4xx de negocio también hacen ROLLBACK (no quedan escrituras parciales); la auditoría de
 *    `acceso_denegado` se escribe en transacción propia (AuditLogger::logOutsideTransaction).
 *  - Respuestas en streaming / descargas largas: excluir la ruta de este middleware y abrir la transacción en la Action.
 */
final class SetPostgresTenant
{
    public function __construct(
        private readonly TenantContext $context,
        private readonly TenantDatabase $database,
    ) {
    }

    public function handle(Request $request, Closure $next): Response
    {
        $tenantId = $this->context->id();

        if ($tenantId === null) {
            return $next($request); // rutas de plataforma o públicas sin tenant: RLS devuelve cero filas
        }

        $db = DB::connection();
        $db->beginTransaction();

        try {
            $this->database->apply($db, $tenantId);

            $response = $next($request);

            // El exception handler ya convirtió las excepciones en respuesta: decidir por el código HTTP.
            if ($response->getStatusCode() >= 400) {
                $db->rollBack();
            } else {
                $db->commit();
            }

            return $response;
        } catch (Throwable $e) {
            if ($db->transactionLevel() > 0) {
                $db->rollBack();
            }
            throw $e;
        }
    }
}
