<?php

declare(strict_types=1);

namespace App\Domain\Quotes\StateMachines;

use App\Domain\Quotes\Enums\QuoteStatus as S;
use App\Domain\Shared\StateMachine\StateMachine;

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
        $draft = S::Borrador->value;

        return [
            S::Borrador->value => [S::Enviada->value, S::Vencida->value],
            S::Enviada->value => [S::Vista->value, S::Negociacion->value, S::Aprobada->value, S::Rechazada->value, S::Vencida->value, $draft],
            S::Vista->value => [S::Negociacion->value, S::Aprobada->value, S::Rechazada->value, S::Vencida->value, $draft],
            S::Negociacion->value => [S::Aprobada->value, S::Rechazada->value, S::Vencida->value, $draft],
            S::Aprobada->value => [S::Convertida->value, $draft],
            S::Rechazada->value => [$draft],
            S::Vencida->value => [S::Rechazada->value, $draft],
            S::Cancelada->value => [$draft],
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
