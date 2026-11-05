<?php

declare(strict_types=1);

namespace App\Domain\Shared\StateMachine;

use App\Domain\Shared\Errors\ApiException;

/**
 * Transición no declarada en la máquina de estados ⇒ 409 con el código de regla de la spec
 * (p. ej. `RT-3`: solo una cotización aprobada genera reserva). Interfaz exigida por
 * kit-ia/tests/pest/Unit/Quotes/QuoteStateMachineTest.php: status() y ruleCode().
 */
final class TransitionNotAllowed extends ApiException
{
    public function __construct(
        public readonly string $from,
        public readonly string $to,
        string $ruleCode,
        string $message,
    ) {
        parent::__construct(409, 'CONFLICT', $ruleCode, $message, [], ['from' => $from, 'to' => $to]);
    }

    public function status(): int
    {
        return $this->status;
    }

    public function ruleCode(): string
    {
        return (string) $this->ruleCode;
    }
}
