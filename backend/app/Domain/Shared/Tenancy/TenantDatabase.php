<?php

declare(strict_types=1);

namespace App\Domain\Shared\Tenancy;

use Closure;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Support\Facades\DB;

final class TenantDatabase
{
    public function __construct(private readonly TenantContext $context) {}

    public function run(string $tenantId, Closure $fn, int $attempts = 1, ?string $connection = null): mixed
    {
        $db = DB::connection($connection);

        return $db->transaction(function (ConnectionInterface $tx) use ($tenantId, $fn) {
            $this->apply($tx, $tenantId);
            $this->context->set($tenantId);

            return $fn();
        }, $attempts);
    }

    public function apply(ConnectionInterface $tx, string $tenantId): void
    {
        $tx->select('select app_set_tenant(?::uuid)', [$tenantId]);
    }
}
