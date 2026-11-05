<?php

/*
| Máquina de estados de la cotización (esp. 03 §4.1; CONVENCIONES §2: transiciones solo vía servicio).
| Plantilla de prueba unitaria de una StateMachine declarativa (F0-03):
|   App\Domain\Quotes\StateMachines\QuoteStateMachine::can(string $from, string $to): bool
|   ...::assertTransition($from, $to) lanza TransitionNotAllowed (→ 409 con code) si no es válida.
| Las guardas de negocio (QTE-BR-12/13/16, RT-3) se prueban en Feature; aquí solo el grafo.
*/

use App\Domain\Quotes\StateMachines\QuoteStateMachine;
use App\Domain\Shared\StateMachine\TransitionNotAllowed;

$sm = fn () => new QuoteStateMachine();

dataset('transiciones_validas', [
    'enviar' => ['borrador', 'enviada'],
    'cliente abre' => ['enviada', 'vista'],
    'negociar desde enviada' => ['enviada', 'negociacion'],
    'negociar desde vista' => ['vista', 'negociacion'],
    'aprobar desde enviada' => ['enviada', 'aprobada'],
    'aprobar desde vista' => ['vista', 'aprobada'],
    'aprobar desde negociación' => ['negociacion', 'aprobada'],
    'rechazar desde vista' => ['vista', 'rechazada'],
    'rechazar vencida' => ['vencida', 'rechazada'],
    'vencer borrador' => ['borrador', 'vencida'],
    'vencer negociación' => ['negociacion', 'vencida'],
    'nueva versión desde aprobada' => ['aprobada', 'borrador'],
    'nueva versión desde rechazada' => ['rechazada', 'borrador'],
    'convertir' => ['aprobada', 'convertida'],
]);

dataset('transiciones_invalidas', [
    'convertir sin aprobar (RT-3)' => ['enviada', 'convertida'],
    'aprobar borrador' => ['borrador', 'aprobada'],
    'vista desde borrador' => ['borrador', 'vista'],
    'reabrir convertida' => ['convertida', 'borrador'],
    'convertida a cualquier otro' => ['convertida', 'enviada'],
    'aprobada a enviada' => ['aprobada', 'enviada'],
    'vencer aprobada' => ['aprobada', 'vencida'],
    'rechazar borrador' => ['borrador', 'rechazada'],
]);

it('permite las transiciones de 03 §4.1', function (string $from, string $to) use ($sm) {
    expect($sm()->can($from, $to))->toBeTrue();
})->with('transiciones_validas');

it('rechaza transiciones no declaradas con TransitionNotAllowed', function (string $from, string $to) use ($sm) {
    expect(fn () => $sm()->assertTransition($from, $to))->toThrow(TransitionNotAllowed::class);
})->with('transiciones_invalidas');

it('los estados coinciden con el CHECK de quote_quotes.status', function () use ($sm) {
    expect($sm()->states())->toEqualCanonicalizing([
        'borrador', 'enviada', 'vista', 'negociacion', 'aprobada', 'rechazada', 'vencida', 'convertida', 'cancelada',
    ]);
});

it('convertida es terminal', function () use ($sm) {
    expect($sm()->allowedFrom('convertida'))->toBe([]);
});

it('la excepción se traduce a 409 con el código de la regla', function () use ($sm) {
    expect(fn () => $sm()->assertTransition('enviada', 'convertida'))
        ->toThrow(function (TransitionNotAllowed $e) {
            expect($e->status())->toBe(409)->and($e->ruleCode())->toBe('RT-3');
        });
});
