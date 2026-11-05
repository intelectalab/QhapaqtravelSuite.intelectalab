<?php

declare(strict_types=1);

namespace App\Domain\Bookings\Enums;

/**
 * Estados de `booking_reservations.status`. Valores IDÉNTICOS al CHECK de database/20_fase1.sql:
 *   check (status in ('borrador', 'pendiente_disponibilidad', 'confirmada', 'pendiente_pago',
 *                     'pendiente_proveedor', 'reprogramada', 'parcial', 'incidencia', 'en_operacion',
 *                     'completada', 'cancelada'))
 * Si el CHECK cambia, primero se edita el SQL (fuente 1), luego este enum y ReservationStateMachine.
 */
enum ReservationStatus: string
{
    case Borrador = 'borrador';
    case PendienteDisponibilidad = 'pendiente_disponibilidad';
    case Confirmada = 'confirmada';
    case PendientePago = 'pendiente_pago';
    case PendienteProveedor = 'pendiente_proveedor';
    case Reprogramada = 'reprogramada';
    case Parcial = 'parcial';
    case Incidencia = 'incidencia';
    case EnOperacion = 'en_operacion';
    case Completada = 'completada';
    case Cancelada = 'cancelada';

    /** Etiqueta en español (misma que kit-ia/design/tokens.json → status.labels). */
    public function label(): string
    {
        return match ($this) {
            self::Borrador => 'Borrador',
            self::PendienteDisponibilidad => 'Pend. disponibilidad',
            self::Confirmada => 'Confirmada',
            self::PendientePago => 'Pendiente de pago',
            self::PendienteProveedor => 'Pend. proveedor',
            self::Reprogramada => 'Reprogramada',
            self::Parcial => 'Parcial',
            self::Incidencia => 'Con incidencia',
            self::EnOperacion => 'En operación',
            self::Completada => 'Completada',
            self::Cancelada => 'Cancelada',
        };
    }

    /** Estados terminales (spec 04 §4.1): se ocultan Modificar/Reprogramar/Cancelar. */
    public function isClosed(): bool
    {
        return $this === self::Completada || $this === self::Cancelada;
    }

    /** @return list<string> */
    public static function values(): array
    {
        return array_map(fn (self $s) => $s->value, self::cases());
    }
}
