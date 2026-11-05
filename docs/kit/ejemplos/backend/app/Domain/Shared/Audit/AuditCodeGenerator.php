<?php

declare(strict_types=1);

namespace App\Domain\Shared\Audit;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Redis;

/**
 * Genera `audit_events.code` (bigint NOT NULL, «secuencia global por tenant», spec 00 §3.6; visible como AUD-55121).
 *
 * SUPUESTO (el SQL no define secuencia ni default para `code`):
 *  - Contador atómico en Redis `t:{tenant}:seq:audit` (INCR). No toma locks en PostgreSQL, así que no serializa
 *    las transacciones del tenant (usar sys_sequences con FOR UPDATE bloquearía cada solicitud que audita hasta su COMMIT).
 *  - Si la clave no existe (Redis reiniciado), se inicializa con max(code) del tenant (SETNX) y luego INCR.
 *  - Puede tener huecos (rollback de la transacción): es un número de referencia visual, no fiscal.
 * Alternativa a decidir con arquitectura: una SEQUENCE global de PostgreSQL agregada a 10_fase0.sql.
 */
final class AuditCodeGenerator
{
    /** @param string|null $connection la misma conexión (y transacción con app.tenant_id) que hará el INSERT */
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
