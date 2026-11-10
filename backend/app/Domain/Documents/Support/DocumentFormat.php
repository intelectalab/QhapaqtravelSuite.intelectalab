<?php

declare(strict_types=1);

namespace App\Domain\Documents\Support;

use App\Domain\Shared\Money\Decimal;
use Brick\Math\BigDecimal;
use Carbon\CarbonImmutable;

final class DocumentFormat
{
    private const RESERVATION = [
        'pendiente_disponibilidad' => 'Verificando disponibilidad',
        'confirmada' => 'Confirmada',
        'pendiente_pago' => 'Pendiente de pago',
        'pendiente_proveedor' => 'En confirmación con proveedores',
        'reprogramada' => 'Reprogramada',
        'parcial' => 'Confirmada parcialmente',
        'incidencia' => 'En seguimiento',
        'en_operacion' => 'En viaje',
        'completada' => 'Viaje realizado',
        'cancelada' => 'Cancelada',
    ];

    private const SERVICE = [
        'pendiente' => 'Por confirmar',
        'solicitado' => 'Por confirmar',
        'rechazado' => 'Por confirmar',
        'confirmado' => 'Confirmado',
        'en_curso' => 'En curso',
        'completado' => 'Realizado',
        'cancelado' => 'Cancelado',
    ];

    private const PAYMENT = [
        'abierta' => 'Pendiente',
        'parcial' => 'Pago parcial',
        'vencida' => 'Vencida',
        'pagada' => 'Pagada',
    ];

    private const PAX = ['ADT' => 'Adulto', 'CHD' => 'Niño', 'INF' => 'Infante'];

    public static function money(BigDecimal|string|null $value, string $currency): string
    {
        return $value === null ? '—' : Decimal::display(Decimal::money($value), $currency);
    }

    public static function date(?string $value): string
    {
        return $value === null || $value === '' ? '—' : self::carbon($value)->translatedFormat('j M Y');
    }

    public static function longDate(?string $value): string
    {
        return $value === null || $value === '' ? '—' : self::carbon($value)->translatedFormat('j \d\e F \d\e Y');
    }

    public static function dayTitle(string $value): string
    {
        return ucfirst(self::carbon($value)->translatedFormat('l j \d\e F'));
    }

    public static function dateTime(?string $value, string $timezone): string
    {
        return $value === null || $value === '' ? '—' : CarbonImmutable::parse($value)->setTimezone($timezone)->locale('es')->translatedFormat('j M Y, H:i');
    }

    public static function range(string $from, string $to): string
    {
        $start = self::carbon($from);
        $end = self::carbon($to);

        if ($start->isSameDay($end)) {
            return self::longDate($from);
        }

        if ($start->isSameMonth($end)) {
            return $start->translatedFormat('j').' al '.$end->translatedFormat('j \d\e F \d\e Y');
        }

        return $start->isSameYear($end)
            ? $start->translatedFormat('j \d\e F').' al '.$end->translatedFormat('j \d\e F \d\e Y')
            : self::longDate($from).' al '.self::longDate($to);
    }

    public static function duration(string $from, string $to): string
    {
        $days = (int) self::carbon($from)->diffInDays(self::carbon($to)) + 1;

        return $days === 1 ? '1 día' : "{$days} días · ".($days - 1).' '.($days - 1 === 1 ? 'noche' : 'noches');
    }

    public static function time(?string $value): ?string
    {
        return $value === null || $value === '' ? null : substr($value, 0, 5);
    }

    public static function pax(int $adults, int $children = 0, int $infants = 0): string
    {
        return collect([
            [$adults, 'adulto', 'adultos'],
            [$children, 'niño', 'niños'],
            [$infants, 'infante', 'infantes'],
        ])->filter(fn (array $row): bool => $row[0] > 0)
            ->map(fn (array $row): string => $row[0].' '.($row[0] === 1 ? $row[1] : $row[2]))
            ->implode(', ') ?: '—';
    }

    public static function count(int $value, string $one, string $many): string
    {
        return $value.' '.($value === 1 ? $one : $many);
    }

    public static function percent(BigDecimal|string $value): string
    {
        return str_replace('.', ',', (string) BigDecimal::of((string) $value)->strippedOfTrailingZeros()).' %';
    }

    public static function reservationStatus(string $status): string
    {
        return self::RESERVATION[$status] ?? ucfirst(str_replace('_', ' ', $status));
    }

    public static function serviceStatus(string $status): string
    {
        return self::SERVICE[$status] ?? ucfirst(str_replace('_', ' ', $status));
    }

    public static function paymentStatus(string $status): string
    {
        return self::PAYMENT[$status] ?? ucfirst($status);
    }

    public static function paxType(string $type): string
    {
        return self::PAX[$type] ?? $type;
    }

    public static function tint(string $hex, float $amount): string
    {
        [$r, $g, $b] = sscanf($hex, '#%02x%02x%02x');

        return sprintf('#%02x%02x%02x', (int) round($r + (255 - $r) * $amount), (int) round($g + (255 - $g) * $amount), (int) round($b + (255 - $b) * $amount));
    }

    private static function carbon(string $value): CarbonImmutable
    {
        return CarbonImmutable::parse(substr($value, 0, 10))->locale('es');
    }
}
