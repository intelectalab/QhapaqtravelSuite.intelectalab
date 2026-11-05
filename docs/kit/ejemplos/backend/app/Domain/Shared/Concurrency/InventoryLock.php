<?php

declare(strict_types=1);

namespace App\Domain\Shared\Concurrency;

use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Tenancy\TenantContext;
use Closure;
use Illuminate\Contracts\Cache\Lock;
use Illuminate\Contracts\Cache\LockTimeoutException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * Bloqueo de inventario en dos niveles al CONSUMIR cupos (salidas, holds, rangos, cupos de proveedor):
 *
 *   1. Lock distribuido Redis (`Cache::lock`) por recurso, adquirido en ORDEN ASCENDENTE de id
 *      (spec 04 §4.3 paso 6, spec 16 §8.4): dos procesos que piden los mismos recursos los toman en el
 *      mismo orden ⇒ no hay interbloqueo. Evita que N workers lleguen a la vez a PostgreSQL.
 *   2. Dentro de la transacción: `SELECT … FOR UPDATE … ORDER BY id` de las filas. Es la garantía real
 *      (el lock Redis puede expirar); el CHECK `sold <= capacity` de catalog_product_departures es la última red.
 *
 * Ejemplo (consumir cupos de salidas; tabla real `catalog_product_departures`, alias C-21 de `catalog_departures`):
 *
 *   $inventory->withLocks('departure', $departureIds, function () use ($departureIds, $pax) {
 *       $rows = $inventory->lockRows('catalog_product_departures', $departureIds);
 *       foreach ($rows as $d) {
 *           if ($d->capacity - $d->sold < $pax) throw ApiException::conflict('RT-4', '…');
 *       }
 *       DB::table('catalog_product_departures')->whereIn('id', $departureIds)
 *           ->update(['sold' => DB::raw('sold + '.(int) $pax)]);
 *   });
 *
 * Debe llamarse DENTRO de la transacción de la solicitud (SetPostgresTenant) o de TenantDatabase::run().
 */
final class InventoryLock
{
    public function __construct(private readonly TenantContext $context)
    {
    }

    /**
     * @template T
     *
     * @param  list<string>  $ids
     * @param  Closure(): T  $fn
     * @return T
     */
    public function withLocks(string $resource, array $ids, Closure $fn, int $ttlSeconds = 30, int $waitSeconds = 5): mixed
    {
        $ids = array_values(array_unique($ids));
        sort($ids, SORT_STRING); // orden fijo ⇒ sin deadlocks

        /** @var list<Lock> $held */
        $held = [];

        try {
            foreach ($ids as $id) {
                $lock = Cache::lock($this->context->key($resource, $id), $ttlSeconds);
                $lock->block($waitSeconds);
                $held[] = $lock;
            }

            return $fn();
        } catch (LockTimeoutException) {
            throw ApiException::conflict('INVENTORY_BUSY', 'Otro usuario está reservando los mismos cupos. Intente nuevamente.');
        } finally {
            foreach (array_reverse($held) as $lock) {
                $lock->release();
            }
        }
    }

    /**
     * SELECT … FOR UPDATE de las filas en orden de id. RLS ya restringe al tenant; el filtro explícito
     * por tenant_id es defensa adicional para cuando se use la conexión de plataforma por error.
     *
     * @param  list<string>  $ids
     * @return array<string, object> filas indexadas por id
     */
    public function lockRows(string $table, array $ids): array
    {
        if ($ids === []) {
            return [];
        }

        return DB::table($table)
            ->where('tenant_id', $this->context->idOrFail())
            ->whereIn('id', $ids)
            ->orderBy('id')
            ->lockForUpdate()
            ->get()
            ->keyBy('id')
            ->all();
    }
}
