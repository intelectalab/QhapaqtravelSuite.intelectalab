<?php

declare(strict_types=1);

namespace App\Domain\Booking\StateMachines;

use App\Domain\Booking\Enums\ReservationStatus as S;
use App\Domain\Shared\StateMachine\StateMachine;

final class ReservationStateMachine extends StateMachine
{
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
