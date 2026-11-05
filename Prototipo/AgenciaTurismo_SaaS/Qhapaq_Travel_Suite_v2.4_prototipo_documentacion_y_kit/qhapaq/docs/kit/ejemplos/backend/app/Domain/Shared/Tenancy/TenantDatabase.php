<?php

declare(strict_types=1);

namespace App\Domain\Shared\Tenancy;

use Closure;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Support\Facades\DB;

/**
 * Único punto que fija `app.tenant_id` en PostgreSQL.
 *
 * Usa la función del esquema `app_set_tenant(uuid)` (database/00_extensions_and_functions.sql), que hace
 * `set_config('app.tenant_id', …, true)` = SET LOCAL: el valor vive solo hasta el fin de la transacción.
 * Por eso SIEMPRE se ejecuta dentro de una transacción (compatible con PgBouncer en modo transacción y Octane).
 * Nunca usar `SET app.tenant_id` sin LOCAL: quedaría pegado a la conexión y la siguiente solicitud lo heredaría.
 *
 * Lo usan: middleware SetPostgresTenant, middleware de job RestoreTenantContext, seeders y la helper
 * `withinTenant()` de las plantillas Pest.
 */
final class TenantDatabase
{
    public function __construct(private readonly TenantContext $context)
    {
    }

    /**
     * Ejecuta $fn dentro de una transacción con el tenant fijado en Laravel y en PostgreSQL.
     *
     * @template T
     *
     * @param  Closure(): T  $fn
     * @return T
     */
    public function run(string $tenantId, Closure $fn, int $attempts = 1, ?string $connection = null): mixed
    {
        $db = DB::connection($connection);

        return $db->transaction(function (ConnectionInterface $tx) use ($tenantId, $fn) {
            $this->apply($tx, $tenantId);
            $this->context->set($tenantId);

            return $fn();
        }, $attempts);
    }

    /**
     * Fija app.tenant_id en la transacción YA abierta. Llamar justo después de BEGIN, antes de cualquier consulta.
     * Si DB::transaction reintenta (deadlock, attempts > 1), el callback vuelve a llamarlo: SET LOCAL se pierde con el rollback.
     */
    public function apply(ConnectionInterface $tx, string $tenantId): void
    {
        $tx->select('select app_set_tenant(?::uuid)', [$tenantId]);
    }
}
