<?php

use Illuminate\Support\Facades\DB;

function paxFeedback(string $code): array
{
    return collect(test()->getJson('/api/v1/channels/passenger-portal')->assertOk()->json('data.feedback'))->firstWhere('code', $code);
}

function paxFeedbackAudit(string $code, string $action): bool
{
    return withinTenant(tenantA(), fn () => DB::table('audit_events')->where(['entity' => 'Comentario del pasajero', 'entity_id' => $code, 'action' => $action])->exists());
}

it('responder un comentario del pasajero guarda la respuesta, quién respondió y lo saca de los nuevos', function () {
    $user = actingAsSeed('U01');
    $before = $this->getJson('/api/v1/channels/passenger-portal')->assertOk()->json('data.kpis.feedback_new');

    $this->putJson('/api/v1/channels/passenger-portal/feedback/FB-00002/reply', ['text' => 'Gracias por avisarnos; coordinamos el cambio de hotel.'])->assertOk()->assertJsonPath('data.code', 'FB-00002');

    $row = rowOf('channel_pax_feedback', 'FB-00002');
    expect($row->status)->toBe('respondido')
        ->and($row->reply)->toBe('Gracias por avisarnos; coordinamos el cambio de hotel.')
        ->and($row->replied_by)->toBe($user->id)
        ->and($row->replied_at)->not->toBeNull()
        ->and(paxFeedback('FB-00002')['status'])->toBe('respondido')
        ->and($this->getJson('/api/v1/channels/passenger-portal')->json('data.kpis.feedback_new'))->toBe($before - 1)
        ->and(paxFeedbackAudit('FB-00002', 'responder'))->toBeTrue();
});

it('marcar un comentario como leído deja la traza; derivar sin crear la incidencia no existe', function () {
    actingAsSeed('U01');

    $this->postJson('/api/v1/channels/passenger-portal/feedback/FB-00002/status', ['status' => 'leido'])->assertOk();
    expect(rowOf('channel_pax_feedback', 'FB-00002')->status)->toBe('leido')
        ->and(paxFeedbackAudit('FB-00002', 'marcar_leido'))->toBeTrue();

    $this->postJson('/api/v1/channels/passenger-portal/feedback/FB-00002/status', ['status' => 'derivado'])->assertStatus(422)->assertJsonValidationErrors(['status']);
    expect(rowOf('channel_pax_feedback', 'FB-00002')->status)->toBe('leido');
});

it('PAX-FB-02: un comentario derivado a una incidencia ya no se responde', function () {
    actingAsSeed('U01');
    withinTenant(tenantA(), fn () => DB::table('channel_pax_feedback')->where('code', 'FB-00002')->update(['status' => 'derivado']));

    expect($this->putJson('/api/v1/channels/passenger-portal/feedback/FB-00002/reply', ['text' => 'Gracias por escribirnos.']))->toBeApiError(409, 'PAX-FB-02')
        ->and(rowOf('channel_pax_feedback', 'FB-00002')->reply)->toBeNull();
});

it('PAX-FB-01: un comentario respondido o ya en ese estado no cambia de estado', function () {
    actingAsSeed('U01');

    expect($this->postJson('/api/v1/channels/passenger-portal/feedback/FB-00001/status', ['status' => 'leido']))->toBeApiError(409, 'PAX-FB-01')
        ->and(rowOf('channel_pax_feedback', 'FB-00001')->status)->toBe('respondido');

    $this->postJson('/api/v1/channels/passenger-portal/feedback/FB-00002/status', ['status' => 'leido'])->assertOk();
    expect($this->postJson('/api/v1/channels/passenger-portal/feedback/FB-00002/status', ['status' => 'leido']))->toBeApiError(409, 'PAX-FB-01');
});

it('valida la respuesta y el estado, y un comentario inexistente responde 404', function () {
    actingAsSeed('U01');

    $this->putJson('/api/v1/channels/passenger-portal/feedback/FB-00002/reply', ['text' => 'ok'])->assertStatus(422)->assertJsonValidationErrors(['text']);
    $this->postJson('/api/v1/channels/passenger-portal/feedback/FB-00002/status', ['status' => 'respondido'])->assertStatus(422)->assertJsonValidationErrors(['status']);
    expect($this->putJson('/api/v1/channels/passenger-portal/feedback/FB-99999/reply', ['text' => 'Gracias por escribirnos.']))->toBeApiError(404)
        ->and(rowOf('channel_pax_feedback', 'FB-00002')->status)->toBe('nuevo');
});

it('Ventas y Finanzas no atienden comentarios de pasajeros', function (string $user) {
    actingAsSeed($user);

    expect($this->putJson('/api/v1/channels/passenger-portal/feedback/FB-00002/reply', ['text' => 'Gracias por escribirnos.']))->toBeApiError(403)
        ->and($this->postJson('/api/v1/channels/passenger-portal/feedback/FB-00002/status', ['status' => 'leido']))->toBeApiError(403);
})->with(['U03', 'U07']);
