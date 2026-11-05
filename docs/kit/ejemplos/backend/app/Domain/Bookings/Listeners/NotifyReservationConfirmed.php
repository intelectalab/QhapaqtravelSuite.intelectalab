<?php

declare(strict_types=1);

namespace App\Domain\Bookings\Listeners;

use App\Domain\Bookings\Events\ReservationConfirmed;
use App\Domain\Notifications\Notify;
use App\Domain\Shared\Jobs\RecordJobRun;
use App\Domain\Shared\Tenancy\Jobs\RestoreTenantContext;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Queue\InteractsWithQueue;

/**
 * Notificación `reserva.confirmada` (spec 04 §4.3 paso 19): Email → cliente, Push → dueño de la reserva.
 *
 * - En cola `notifications` (Horizon), después del COMMIT (el evento es ShouldDispatchAfterCommit).
 * - El tenant viaja en el evento; `middleware()` lo restablece con RestoreTenantContext.
 * - Reintentos con backoff; un fallo aquí NUNCA revierte la reserva (SEC-BR-22).
 * - `Notify` es el servicio transversal de spec 00 §8.1 (reglas `notif_event_rules`, plantillas
 *   `notif_templates`, envío por adaptador MessagingChannel/Mail). Se referencia, no se incluye en este ejemplo.
 */
final class NotifyReservationConfirmed implements ShouldQueue
{
    use InteractsWithQueue;

    public string $queue = 'notifications';

    public int $tries = 5;

    /** Segundos entre reintentos (exponencial). */
    public array $backoff = [10, 30, 90, 270];

    public function __construct(private readonly Notify $notify)
    {
    }

    /**
     * Laravel llama a middleware($event) al ENCOLAR y aplica el resultado a CallQueuedListener; por eso el tenant
     * se pasa explícitamente al construir los middleware (el listener encolado no es el `$job` que reciben).
     *
     * @return list<object>
     */
    public function middleware(ReservationConfirmed $event): array
    {
        return [
            new RecordJobRun(trigger: 'manual', tenantId: $event->tenantId),
            new RestoreTenantContext($event->tenantId),
        ];
    }

    public function handle(ReservationConfirmed $event): void
    {
        $this->notify->event('reserva.confirmada', [
            'reservation_id' => $event->reservationId,
            'reservation_code' => $event->reservationCode,
        ]);
    }
}
