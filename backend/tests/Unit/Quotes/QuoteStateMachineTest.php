<?php

use App\Domain\Quotes\StateMachines\QuoteStateMachine;
use App\Domain\Shared\StateMachine\TransitionNotAllowed;

beforeEach(function () {
    if (! class_exists(QuoteStateMachine::class)) {
        $this->markTestSkipped('Fase B: falta App\Domain\Quotes\StateMachines\QuoteStateMachine (grafo de la esp. 03 §4.1). Las guardas vía API están en Feature/Quotes/QuoteLifecycleGuardsTest.');
    }
});

$sm = fn () => new QuoteStateMachine;

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
