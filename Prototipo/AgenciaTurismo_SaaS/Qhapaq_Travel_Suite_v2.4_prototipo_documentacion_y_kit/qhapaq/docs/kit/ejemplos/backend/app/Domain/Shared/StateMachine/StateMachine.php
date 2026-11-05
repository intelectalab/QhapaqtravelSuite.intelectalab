<?php

declare(strict_types=1);

namespace App\Domain\Shared\StateMachine;

use BackedEnum;
use Illuminate\Database\Eloquent\Model;

/**
 * Máquina de estados declarativa base (CONVENCIONES §2: «Transiciones solo vía servicio de dominio, nunca
 * update directo»; CLAUDE.md backend: nunca `update(['status' => …])`).
 *
 * Cada dominio declara:
 *  - states():       valores EXACTOS del CHECK de SQL (se prueba contra la lista del CHECK).
 *  - transitions():  grafo [desde => [hacia, …]]. '*' = desde cualquier estado no terminal.
 *  - ruleCodes():    código de regla de la spec cuando una transición concreta no está permitida
 *                    (p. ej. ['*>convertida' => 'RT-3']); por defecto STATE_TRANSITION_NOT_ALLOWED.
 *
 * Las GUARDAS que dependen de datos (vencimiento, aprobación interna, disponibilidad…) NO van aquí: van en la
 * Action, que las evalúa y luego llama transition(). Aquí solo el grafo.
 */
abstract class StateMachine
{
    /** @return list<string> */
    abstract public function states(): array;

    /** @return array<string, list<string>> */
    abstract protected function transitions(): array;

    /** @return list<string> */
    public function terminal(): array
    {
        return [];
    }

    /** @return array<string, string> clave "desde>hacia", "desde>*" o "*>hacia" → código de regla */
    protected function ruleCodes(): array
    {
        return [];
    }

    /** Etiqueta humana del estado para mensajes (por defecto el valor). */
    protected function label(string $state): string
    {
        return $state;
    }

    public function can(string $from, string $to): bool
    {
        return in_array($to, $this->allowedFrom($from), true);
    }

    /** @return list<string> */
    public function allowedFrom(string $from): array
    {
        if (in_array($from, $this->terminal(), true)) {
            return [];
        }

        $graph = $this->transitions();
        $targets = [...($graph[$from] ?? []), ...($graph['*'] ?? [])];

        // '*' no permite transiciones al mismo estado ni a estados no declarados
        return array_values(array_unique(array_filter(
            $targets,
            fn (string $to) => $to !== $from && in_array($to, $this->states(), true),
        )));
    }

    public function assertTransition(string $from, string $to): void
    {
        if ($this->can($from, $to)) {
            return;
        }

        $codes = $this->ruleCodes();
        // Prioridad: transición exacta → desde un estado (terminales) → hacia un estado.
        $code = $codes[$from.'>'.$to] ?? $codes[$from.'>*'] ?? $codes['*>'.$to] ?? 'STATE_TRANSITION_NOT_ALLOWED';

        throw new TransitionNotAllowed(
            $from,
            $to,
            $code,
            sprintf('No se puede pasar de «%s» a «%s».', $this->label($from), $this->label($to)),
        );
    }

    /**
     * Aplica la transición sobre el modelo (no guarda: la Action guarda dentro de su transacción y audita).
     * Devuelve el estado anterior para la auditoría (before/after).
     */
    public function transition(Model $model, string|BackedEnum $to, string $column = 'status'): string
    {
        $from = $model->getAttribute($column);
        $from = $from instanceof BackedEnum ? (string) $from->value : (string) $from;
        $target = $to instanceof BackedEnum ? (string) $to->value : $to;

        $this->assertTransition($from, $target);
        $model->setAttribute($column, $target);

        return $from;
    }
}
