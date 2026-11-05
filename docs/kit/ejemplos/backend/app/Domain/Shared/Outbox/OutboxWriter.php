<?php

declare(strict_types=1);

namespace App\Domain\Shared\Outbox;

use App\Domain\Shared\Tenancy\TenantContext;
use App\Http\Middleware\AssignCorrelationId;
use Illuminate\Support\Facades\DB;

/**
 * Outbox transaccional (`sys_outbox`, spec 00 §3.9; CONVENCIONES §4).
 *
 * Se inserta en la MISMA transacción que el cambio de negocio. Un worker (job `DispatchOutbox`, cola
 * `integrations`, cada minuto o al recibir el evento de commit) lee `status = 'pending' and available_at <= now()`
 * con `FOR UPDATE SKIP LOCKED`, publica (webhook, OSE, pasarela, listener externo) y marca `dispatched`;
 * si falla incrementa `attempts` y reprograma `available_at` con backoff (2^attempts min, máx. 5 intentos → `failed`).
 *
 * Úsese cuando el efecto EXTERNO debe garantizarse (webhooks a clientes, emisión fiscal, sincronización con
 * proveedores). Para efectos internos (notificaciones, recálculos) basta un evento de Laravel con listener
 * `ShouldQueue` + `afterCommit`.
 */
final class OutboxWriter
{
    public function __construct(private readonly TenantContext $context)
    {
    }

    /** @param array<string, mixed> $payload */
    public function add(string $aggregateType, string $aggregateId, string $event, array $payload): void
    {
        DB::table('sys_outbox')->insert([
            'tenant_id' => $this->context->id(),
            'aggregate_type' => $aggregateType,   // varchar(40): 'booking_reservation', 'quote_quote'…
            'aggregate_id' => $aggregateId,
            'event' => $event,                    // varchar(80): 'ReservationConfirmed'…
            'payload' => json_encode($payload + ['correlation_id' => AssignCorrelationId::current()], JSON_UNESCAPED_UNICODE),
            'status' => 'pending',
            'attempts' => 0,
            'available_at' => now(),
        ]);
    }
}
