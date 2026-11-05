<?php

declare(strict_types=1);

namespace App\Domain\Shared\Tenancy\Jobs;

use App\Domain\Shared\Tenancy\TenantContext;
use App\Domain\Shared\Tenancy\TenantDatabase;
use Closure;
use Illuminate\Support\Facades\Log;
use RuntimeException;

/**
 * Middleware de job: restablece el tenant serializado antes de ejecutar handle().
 * Nombre exigido por la plantilla kit-ia/tests/pest/Feature/Tenancy/TenantIsolationTest.php.
 *
 * - Lee `$job->tenantId` (trait TenantAware) o el tenant pasado al constructor (listeners). Si falta → el job falla (nunca corre "sin tenant":
 *   RLS devolvería cero filas y el job terminaría en silencio sin hacer nada).
 * - Ejecuta el job dentro de TenantDatabase::run(): transacción + `select app_set_tenant(...)`.
 *   Si el job hace llamadas HTTP lentas (integraciones), mejor: leer datos → cerrar transacción →
 *   llamar al adaptador → abrir otra transacción con TenantDatabase::run() para guardar el resultado.
 * - Agrega `tenant_id` al contexto de logs (Log::withContext) para observabilidad.
 * - Limpia el contexto al terminar (los workers de Horizon son procesos largos).
 */
final class RestoreTenantContext
{
    /**
     * @param  string|null  $tenantId  explícito para listeners en cola: Laravel ejecuta el middleware sobre
     *                                 CallQueuedListener (no sobre el listener), así que el tenant se pasa al construirlo.
     */
    public function __construct(private readonly ?string $tenantId = null)
    {
    }

    public function handle(object $job, Closure $next): mixed
    {
        $tenantId = $this->tenantId ?? (property_exists($job, 'tenantId') ? $job->tenantId : null);

        if (! is_string($tenantId) || $tenantId === '') {
            throw new RuntimeException('Job sin tenant serializado: '.$job::class.' (usar TenantAware::captureTenant()).');
        }

        $context = app(TenantContext::class);
        Log::withContext(['tenant_id' => $tenantId, 'job' => $job::class]);

        try {
            return app(TenantDatabase::class)->run($tenantId, fn () => $next($job));
        } finally {
            $context->clear();
        }
    }
}
