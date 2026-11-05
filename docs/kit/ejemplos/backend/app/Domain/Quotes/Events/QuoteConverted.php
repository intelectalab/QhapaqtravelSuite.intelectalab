<?php

declare(strict_types=1);

namespace App\Domain\Quotes\Events;

use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * Cotización convertida en reserva (spec 03 §4.1). Listeners: oportunidad ganada ya se aplica en la Action; aquí solo efectos asíncronos (métricas, embudo).
 *
 * - ShouldDispatchAfterCommit: el evento se despacha solo si la transacción confirma (SEC-BR-22: una
 *   notificación fallida no revierte el negocio, y un rollback no deja notificaciones fantasma).
 * - Lleva ids (no modelos) + tenant_id: los listeners en cola restablecen el tenant con TenantAware.
 * - El mismo hecho se escribe en sys_outbox (OutboxWriter) cuando debe llegar a un sistema externo (webhooks, fase 3).
 */
final class QuoteConverted implements ShouldDispatchAfterCommit
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
