<?php

declare(strict_types=1);

namespace App\Domain\Bookings\StateMachines;

use App\Domain\Bookings\Enums\ReservationStatus as S;
use App\Domain\Shared\StateMachine\StateMachine;

/**
 * Máquina de estados de la reserva — grafo de la spec 04 §4.1 (tabla «Desde | Hacia»).
 *
 * | Desde                                                                  | Hacia                | Acción (permiso)                                  |
 * |------------------------------------------------------------------------|----------------------|---------------------------------------------------|
 * | — (alta)                                                               | confirmada           | Convertir cotización / reserva directa (reservations.create) |
 * | — (alta)                                                               | borrador, pendiente_disponibilidad | Reserva directa «Guardar borrador» |
 * | — (alta, canales)                                                      | pendiente_pago       | Checkout web / B2B (spec 16 §6.1, spec 08)        |
 * | borrador, pendiente_disponibilidad, pendiente_proveedor, reprogramada  | confirmada           | Confirmar reserva (reservations.modify)           |
 * | confirmada                                                             | pendiente_proveedor  | Rechazo de proveedor en un servicio               |
 * | pendiente_proveedor                                                    | confirmada           | Último servicio confirmado (automático)           |
 * | pendiente_pago                                                         | confirmada           | Pago que deja saldo ≤ 0.50 (automático)           |
 * | confirmada, reprogramada, pendiente_pago, pendiente_proveedor          | en_operacion         | Iniciar operación (reservations.modify)           |
 * | en_operacion                                                           | completada           | Completar viaje (reservations.modify)             |
 * | no cerrada                                                             | reprogramada         | Reprogramar (reservations.modify)                 |
 * | no cerrada                                                             | cancelada            | Cancelar (reservations.cancel)                    |
 *
 * Guardas de datos (en la Action, no aquí): RES-BR-07 (disponibilidad y ≥ 1 pasajero para confirmar),
 * RES-BR-08 (iniciar solo si travel_from ≤ hoy + 1), RES-BR-20 (no reprogramar con servicios completados).
 * `parcial` e `incidencia` existen en el CHECK pero este módulo no los asigna (los usan B2B/e-commerce/operaciones):
 * sus transiciones de entrada quedan **Por definir** en las specs 08/05; solo heredan reprogramar/cancelar.
 */
final class ReservationStateMachine extends StateMachine
{
    /** Estados válidos al crear una reserva (no son transiciones: no hay estado previo). */
    public const INITIAL = [
        S::Confirmada->value,
        S::Borrador->value,
        S::PendienteDisponibilidad->value,
        S::PendientePago->value,
    ];

    public function states(): array
    {
        return S::values();
    }

    public function terminal(): array
    {
        return [S::Completada->value, S::Cancelada->value];
    }

    protected function transitions(): array
    {
        return [
            S::Borrador->value => [S::Confirmada->value],
            S::PendienteDisponibilidad->value => [S::Confirmada->value],
            S::PendienteProveedor->value => [S::Confirmada->value, S::EnOperacion->value],
            S::Reprogramada->value => [S::Confirmada->value, S::EnOperacion->value],
            S::Confirmada->value => [S::PendienteProveedor->value, S::EnOperacion->value],
            S::PendientePago->value => [S::Confirmada->value, S::EnOperacion->value],
            S::EnOperacion->value => [S::Completada->value],
            // «no cerrada → reprogramada | cancelada»: '*' excluye terminales (terminal()) y el mismo estado.
            '*' => [S::Reprogramada->value, S::Cancelada->value],
        ];
    }

    protected function ruleCodes(): array
    {
        return [
            '*>en_operacion' => 'RES-BR-08',
            '*>completada' => 'RES-BR-08',
            'completada>*' => 'RES-TERMINAL',
            'cancelada>*' => 'RES-TERMINAL',
        ];
    }

    protected function label(string $state): string
    {
        return S::tryFrom($state)?->label() ?? $state;
    }

    public function isValidInitial(string $status): bool
    {
        return in_array($status, self::INITIAL, true);
    }
}
