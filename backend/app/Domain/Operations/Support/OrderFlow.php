<?php

declare(strict_types=1);

namespace App\Domain\Operations\Support;

final class OrderFlow
{
    public const STEPS = ['planificada', 'pendiente_asignacion', 'asignada', 'confirmada', 'en_ejecucion', 'completada'];

    public const ACTIONS = [
        'to-assignment' => 'pendiente_asignacion',
        'mark-assigned' => 'asignada',
        'confirm' => 'confirmada',
        'start' => 'en_ejecucion',
        'close' => 'completada',
    ];

    public const MANUAL = [
        'planificada' => ['pendiente_asignacion' => 'Pasar a asignación'],
        'pendiente_asignacion' => ['asignada' => 'Marcar como asignada'],
        'asignada' => ['confirmada' => 'Confirmar operación'],
        'confirmada' => ['en_ejecucion' => 'Iniciar ejecución'],
        'en_ejecucion' => ['completada' => 'Cerrar operación'],
    ];

    public static function targets(string $status): array
    {
        return collect(self::MANUAL[$status] ?? [])->map(fn (string $label, string $target): array => ['status' => $target, 'label' => $label])->values()->all();
    }

    public static function allows(string $from, string $to): bool
    {
        return isset(self::MANUAL[$from][$to]);
    }
}
