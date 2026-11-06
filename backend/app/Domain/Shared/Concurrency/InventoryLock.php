<?php

declare(strict_types=1);

namespace App\Domain\Shared\Concurrency;

use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Tenancy\TenantContext;
use Closure;
use Illuminate\Contracts\Cache\LockTimeoutException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

final class InventoryLock
{
    public function __construct(private readonly TenantContext $context) {}

    public function withLocks(string $resource, array $ids, Closure $fn, int $ttlSeconds = 30, int $waitSeconds = 5): mixed
    {
        $ids = array_values(array_unique($ids));
        sort($ids, SORT_STRING);

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
