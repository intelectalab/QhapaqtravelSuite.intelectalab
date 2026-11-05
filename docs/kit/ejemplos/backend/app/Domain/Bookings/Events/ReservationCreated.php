<?php

declare(strict_types=1);

namespace App\Domain\Bookings\Events;

use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * Reserva creada (desde cotización, reserva directa o canal). Listeners: recálculo de KPIs, read models de reportes.
 *
 * - ShouldDispatchAfterCommit: el evento se despacha solo si la transacción confirma (SEC-BR-22: una
 *   notificación fallida no revierte el negocio, y un rollback no deja notificaciones fantasma).
 * - Lleva ids (no modelos) + tenant_id: los listeners en cola restablecen el tenant con TenantAware.
 * - El mismo hecho se escribe en sys_outbox (OutboxWriter) cuando debe llegar a un sistema externo (webhooks, fase 3).
 */
final class ReservationCreated implements ShouldDispatchAfterCommit
{
    use Dispatchable;
    use SerializesModels;

    public function __construct(
        public readonly string $tenantId,
        public readonly string $reservationId,
        public readonly string $reservationCode,
        public readonly ?string $quoteId = null,
        public readonly ?string $actorId = null,
    ) {
    }
}
