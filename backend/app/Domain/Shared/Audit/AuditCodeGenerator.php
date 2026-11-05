<?php

declare(strict_types=1);

namespace App\Domain\Shared\Audit;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Redis;

final class AuditCodeGenerator
{
    public function next(?string $tenantId, ?string $connection = null): int
    {
        $key = 't:'.($tenantId ?? 'platform').':seq:audit';
        $redis = Redis::connection();

        if (! $redis->exists($key)) {
            $max = (int) DB::connection($connection)->table('audit_events')
                ->when($tenantId === null, fn ($q) => $q->whereNull('tenant_id'), fn ($q) => $q->where('tenant_id', $tenantId))
                ->max('code');
            $redis->setnx($key, (string) $max);
        }

        return (int) $redis->incr($key);
    }
}
