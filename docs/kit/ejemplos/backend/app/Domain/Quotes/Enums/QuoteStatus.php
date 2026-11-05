<?php

declare(strict_types=1);

namespace App\Domain\Quotes\Enums;

/**
 * Estados de `quote_quotes.status` = CHECK de database/20_fase1.sql:
 *   ('borrador', 'enviada', 'vista', 'negociacion', 'aprobada', 'rechazada', 'vencida', 'convertida', 'cancelada')
 */
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

    /** @return list<string> */
    public static function values(): array
    {
        return array_map(fn (self $s) => $s->value, self::cases());
    }
}
