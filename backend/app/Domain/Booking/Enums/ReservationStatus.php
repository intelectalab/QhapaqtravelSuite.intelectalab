<?php

declare(strict_types=1);

namespace App\Domain\Booking\Enums;

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

    public function isClosed(): bool
    {
        return $this === self::Completada || $this === self::Cancelada;
    }

    public static function values(): array
    {
        return array_map(fn (self $status): string => $status->value, self::cases());
    }
}
