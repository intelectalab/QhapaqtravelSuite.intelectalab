<?php

use Illuminate\Support\Facades\DB;

it('registra en la auditoría cada lista exportada con formato, filas y filtros', function () {
    actingAsSeed('U03');

    $this->postJson('/api/v1/me/data-exports', [
        'screen' => 'opportunities',
        'title' => 'Oportunidades',
        'format' => 'xlsx',
        'scope' => 'all',
        'rows' => 10,
        'columns' => [],
        'filters' => ['Etapa: Negociación', 'Orden: Monto en soles (Mayor a menor)'],
    ])->assertOk()->assertJsonPath('data.logged', true);

    $event = withinTenant(tenantA(), fn () => DB::table('audit_events')->where(['entity' => 'Lista exportada', 'entity_id' => 'opportunities', 'action' => 'exportar'])->latest('occurred_at')->first());
    expect($event)->not->toBeNull()
        ->and($event->after_value)->toContain('Excel')
        ->and($event->after_value)->toContain('10 filas');
});

it('valida el formato y el alcance de la exportación', function () {
    actingAsSeed('U03');

    $this->postJson('/api/v1/me/data-exports', ['screen' => 'x', 'title' => 'X', 'format' => 'pdf', 'scope' => 'todo', 'rows' => -1])
        ->assertStatus(422)->assertJsonValidationErrors(['format', 'scope', 'rows']);
});
