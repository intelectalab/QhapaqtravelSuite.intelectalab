<?php

declare(strict_types=1);

namespace App\Domain\Shared\StateMachine;

use BackedEnum;
use Illuminate\Database\Eloquent\Model;

abstract class StateMachine
{
    abstract public function states(): array;

    abstract protected function transitions(): array;

    public function terminal(): array
    {
        return [];
    }

    protected function ruleCodes(): array
    {
        return [];
    }

    protected function label(string $state): string
    {
        return $state;
    }

    public function can(string $from, string $to): bool
    {
        return in_array($to, $this->allowedFrom($from), true);
    }

    public function allowedFrom(string $from): array
    {
        if (in_array($from, $this->terminal(), true)) {
            return [];
        }

        $graph = $this->transitions();
        $targets = [...($graph[$from] ?? []), ...($graph['*'] ?? [])];

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

        $code = $codes[$from.'>'.$to] ?? $codes[$from.'>*'] ?? $codes['*>'.$to] ?? 'STATE_TRANSITION_NOT_ALLOWED';

        throw new TransitionNotAllowed(
            $from,
            $to,
            $code,
            sprintf('No se puede pasar de «%s» a «%s».', $this->label($from), $this->label($to)),
        );
    }

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
