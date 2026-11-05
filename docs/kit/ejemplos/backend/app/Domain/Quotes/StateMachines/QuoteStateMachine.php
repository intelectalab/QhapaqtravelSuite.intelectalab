<?php

declare(strict_types=1);

namespace App\Domain\Quotes\StateMachines;

use App\Domain\Quotes\Enums\QuoteStatus as S;
use App\Domain\Shared\StateMachine\StateMachine;

/**
 * Máquina de estados de la cotización — spec 03 §4.1. Cumple kit-ia/tests/pest/Unit/Quotes/QuoteStateMachineTest.php.
 *
 * - `aprobada → convertida` solo vía ConvertQuoteToReservation; desde cualquier otro estado ⇒ 409 RT-3.
 * - «Crear nueva versión» (cualquier estado salvo convertida → borrador, QTE-BR-18).
 * - `vencida` la asigna el job JOB-02 (ExpireQuotes) desde borrador/enviada/vista/negociacion.
 * - `cancelada`: existe en el CHECK pero el prototipo no la implementa (spec 03 §12) ⇒ sin transición de entrada (Por definir).
 * Guardas de datos (QTE-BR-12/13/16: aprobación interna pendiente, vencimiento) van en las Actions.
 */
final class QuoteStateMachine extends StateMachine
{
    public function states(): array
    {
        return S::values();
    }

    public function terminal(): array
    {
        return [S::Convertida->value];
    }

    protected function transitions(): array
    {
        $b = S::Borrador->value;

        return [
            S::Borrador->value => [S::Enviada->value, S::Vencida->value],
            S::Enviada->value => [S::Vista->value, S::Negociacion->value, S::Aprobada->value, S::Rechazada->value, S::Vencida->value, $b],
            S::Vista->value => [S::Negociacion->value, S::Aprobada->value, S::Rechazada->value, S::Vencida->value, $b],
            S::Negociacion->value => [S::Aprobada->value, S::Rechazada->value, S::Vencida->value, $b],
            S::Aprobada->value => [S::Convertida->value, $b],
            S::Rechazada->value => [$b],
            S::Vencida->value => [S::Rechazada->value, $b],
            S::Cancelada->value => [$b],
        ];
    }

    protected function ruleCodes(): array
    {
        return [
            '*>convertida' => 'RT-3',
            'convertida>*' => 'QTE-CONVERTED',
        ];
    }

    protected function label(string $state): string
    {
        return S::tryFrom($state)?->label() ?? $state;
    }
}
