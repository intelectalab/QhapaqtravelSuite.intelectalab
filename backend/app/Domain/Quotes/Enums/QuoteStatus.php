<?php

declare(strict_types=1);

namespace App\Domain\Quotes\Enums;

enum QuoteStatus: string
{
    case Borrador = 'borrador';
    case Enviada = 'enviada';
    case Vista = 'vista';
    case Negociacion = 'negociacion';
    case Aprobada = 'aprobada';
    case Rechazada = 'rechazada';
    case Vencida = 'vencida';
    case Convertida = 'convertida';
    case Cancelada = 'cancelada';

    public function label(): string
    {
        return match ($this) {
            self::Borrador => 'Borrador',
            self::Enviada => 'Enviada',
            self::Vista => 'Vista',
            self::Negociacion => 'Negociación',
            self::Aprobada => 'Aprobada',
            self::Rechazada => 'Rechazada',
            self::Vencida => 'Vencida',
            self::Convertida => 'Convertida en reserva',
            self::Cancelada => 'Cancelada',
        };
    }

    public static function values(): array
    {
        return array_map(fn (self $status): string => $status->value, self::cases());
    }
}
