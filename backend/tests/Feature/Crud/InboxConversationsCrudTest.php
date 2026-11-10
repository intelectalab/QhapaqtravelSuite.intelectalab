<?php

use Illuminate\Support\Facades\DB;

function inbConversacionVersion(string $code): int
{
    return (int) rowOf('collab_conversations', $code)->lock_version;
}

function inbMensajes(string $code): array
{
    $id = rowOf('collab_conversations', $code)->id;

    return withinTenant(tenantA(), fn () => DB::table('collab_messages')->where('conversation_id', $id)->orderBy('sent_at')->get()->all());
}

function inbConversacionAuditada(string $code, string $action): bool
{
    return withinTenant(tenantA(), fn () => DB::table('audit_events')->where('entity', 'Conversación')->where('entity_id', $code)->where('action', $action)->exists());
}

it('responder una conversación sin responsable la asigna a quien responde y registra la primera respuesta', function () {
    $seller = actingAsSeed('U03');

    $this->postJson('/api/v1/inbox/conversations/CNV-0105/messages', ['body' => 'Hola, te enviamos la propuesta hoy mismo.'], critical())->assertCreated();

    $conversation = rowOf('collab_conversations', 'CNV-0105');
    $last = collect(inbMensajes('CNV-0105'))->last();
    expect($conversation->status)->toBe('pendiente')
        ->and($conversation->assignee_id)->toBe($seller->id)
        ->and($conversation->first_response_at)->not->toBeNull()
        ->and((int) $conversation->unread_count)->toBe(0)
        ->and($last->direction)->toBe('out')
        ->and($last->author_user_id)->toBe($seller->id)
        ->and(inbConversacionAuditada('CNV-0105', 'responder'))->toBeTrue();

    $thread = $this->getJson('/api/v1/inbox/conversations/CNV-0105')->assertOk()->json('data');
    expect(collect($thread['messages'])->last()['body'])->toBe('Hola, te enviamos la propuesta hoy mismo.')
        ->and($thread['assignee']['id'])->toBe($seller->id);
});

it('una nota interna no cambia el estado ni aparece como vista previa', function () {
    actingAsSeed('U03');

    $this->postJson('/api/v1/inbox/conversations/CNV-0101/messages', ['body' => 'Revisar con operaciones el horario del traslado.', 'internal' => true], critical())->assertCreated();

    $conversation = rowOf('collab_conversations', 'CNV-0101');
    $item = collect($this->getJson('/api/v1/inbox/conversations')->json('data.items'))->firstWhere('code', 'CNV-0101');
    expect($conversation->status)->toBe('abierta')
        ->and((int) $conversation->unread_count)->toBe(2)
        ->and(collect(inbMensajes('CNV-0101'))->last()->direction)->toBe('internal')
        ->and($item['preview'])->not->toContain('Revisar con operaciones')
        ->and(inbConversacionAuditada('CNV-0101', 'nota_interna'))->toBeTrue();
});

it('responder y resolver cierra la conversación en un paso', function () {
    $seller = actingAsSeed('U03');

    $this->postJson('/api/v1/inbox/conversations/CNV-0104/messages', ['body' => 'Listo, quedó confirmada tu reserva.', 'resolve' => true], critical())->assertCreated();

    $conversation = rowOf('collab_conversations', 'CNV-0104');
    expect($conversation->status)->toBe('resuelta')
        ->and($conversation->resolved_by)->toBe($seller->id)
        ->and(inbConversacionAuditada('CNV-0104', 'responder_y_resolver'))->toBeTrue();
});

it('en WhatsApp fuera de 24 horas solo se envía una plantilla aprobada', function () {
    actingAsSeed('U04');
    withinTenant(tenantA(), fn () => DB::table('collab_conversations')->where('code', 'CNV-0102')->update(['last_inbound_at' => now()->subDays(2)]));
    $count = count(inbMensajes('CNV-0102'));

    expect($this->postJson('/api/v1/inbox/conversations/CNV-0102/messages', ['body' => 'Texto libre fuera de ventana'], critical()))->toBeApiError(422, 'INB-BR-02')
        ->and(count(inbMensajes('CNV-0102')))->toBe($count);

    $this->postJson('/api/v1/inbox/conversations/CNV-0102/messages', ['body' => 'Plantilla aprobada de seguimiento', 'template' => 'PL-07'], critical())->assertCreated();
    expect(collect(inbMensajes('CNV-0102'))->last()->template_id)->not->toBeNull();
});

it('responder exige texto y respeta el alcance de cada rol', function () {
    actingAsSeed('U03');
    $this->postJson('/api/v1/inbox/conversations/CNV-0105/messages', ['body' => ''], critical())->assertStatus(422)->assertJsonValidationErrors('body');
    expect($this->postJson('/api/v1/inbox/conversations/CNV-0103/messages', ['body' => 'Conversación de otro'], critical()))->toBeApiError(404);

    actingAsSeed('U07');
    expect($this->postJson('/api/v1/inbox/conversations/CNV-0105/messages', ['body' => 'Sin permiso'], critical()))->toBeApiError(403);
});

it('Ventas toma una conversación sin asignar pero no la reasigna a otra persona', function () {
    $seller = actingAsSeed('U03');

    $this->postJson('/api/v1/inbox/conversations/CNV-0106/assign', [], critical(inbConversacionVersion('CNV-0106')))->assertOk();
    expect(rowOf('collab_conversations', 'CNV-0106')->assignee_id)->toBe($seller->id)
        ->and(inbConversacionAuditada('CNV-0106', 'asignar'))->toBeTrue();

    expect($this->postJson('/api/v1/inbox/conversations/CNV-0106/assign', ['assignee_id' => seedUser('U04')->id], critical(inbConversacionVersion('CNV-0106'))))->toBeApiError(403, 'INB-BR-04')
        ->and(rowOf('collab_conversations', 'CNV-0106')->assignee_id)->toBe($seller->id);
});

it('un supervisor asigna a una persona del equipo de atención', function () {
    actingAsSeed('U02');
    $version = inbConversacionVersion('CNV-0105');

    $this->postJson('/api/v1/inbox/conversations/CNV-0105/assign', ['assignee_id' => seedUser('U05')->id], critical($version))->assertOk();
    expect(rowOf('collab_conversations', 'CNV-0105')->assignee_id)->toBe(seedUser('U05')->id)
        ->and(inbConversacionVersion('CNV-0105'))->toBe($version + 1);

    expect($this->postJson('/api/v1/inbox/conversations/CNV-0105/assign', ['assignee_id' => seedUser('U07')->id], critical(inbConversacionVersion('CNV-0105'))))->toBeApiError(422, 'VALIDATION_ERROR');
    expect($this->postJson('/api/v1/inbox/conversations/CNV-0105/assign', ['assignee_id' => seedUser('U03')->id], critical($version)))->toBeApiError(409, 'STALE_VERSION');
});

it('resolver una conversación la cierra con un mensaje del sistema y no se resuelve dos veces', function () {
    $seller = actingAsSeed('U03');

    $this->postJson('/api/v1/inbox/conversations/CNV-0104/resolve', [], critical(inbConversacionVersion('CNV-0104')))->assertOk();

    $conversation = rowOf('collab_conversations', 'CNV-0104');
    expect($conversation->status)->toBe('resuelta')
        ->and($conversation->resolved_by)->toBe($seller->id)
        ->and(collect(inbMensajes('CNV-0104'))->last()->direction)->toBe('system')
        ->and(inbConversacionAuditada('CNV-0104', 'resolver'))->toBeTrue();
    expect($this->postJson('/api/v1/inbox/conversations/CNV-0104/resolve', [], critical(inbConversacionVersion('CNV-0104'))))->toBeApiError(409, 'INB-BR-STATE');
});

it('reabrir una conversación resuelta la vuelve a abrir y limpia la resolución', function () {
    actingAsSeed('U02');

    $this->postJson('/api/v1/inbox/conversations/CNV-0107/reopen', [], critical(inbConversacionVersion('CNV-0107')))->assertOk();

    $conversation = rowOf('collab_conversations', 'CNV-0107');
    expect($conversation->status)->toBe('abierta')
        ->and($conversation->resolved_at)->toBeNull()
        ->and($conversation->resolved_by)->toBeNull()
        ->and(inbConversacionAuditada('CNV-0107', 'reabrir'))->toBeTrue();
    expect($this->postJson('/api/v1/inbox/conversations/CNV-0107/reopen', [], critical(inbConversacionVersion('CNV-0107'))))->toBeApiError(409, 'INB-BR-STATE');
});

it('clasificar una conversación guarda prioridad y etiquetas', function () {
    actingAsSeed('U03');

    $this->patchJson('/api/v1/inbox/conversations/CNV-0104', ['priority' => 'critica', 'tags' => ['VIP', 'Reclamo', 'VIP']], critical(inbConversacionVersion('CNV-0104')))->assertOk();

    expect(rowOf('collab_conversations', 'CNV-0104')->priority)->toBe('critica')
        ->and($this->getJson('/api/v1/inbox/conversations/CNV-0104')->json('data.tags'))->toBe(['VIP', 'Reclamo'])
        ->and(inbConversacionAuditada('CNV-0104', 'clasificar'))->toBeTrue();
});

it('clasificar valida la prioridad y el máximo de etiquetas', function () {
    actingAsSeed('U03');

    $this->patchJson('/api/v1/inbox/conversations/CNV-0104', ['priority' => 'urgentisima', 'tags' => array_map(fn (int $n) => "t{$n}", range(1, 9))], critical(inbConversacionVersion('CNV-0104')))
        ->assertStatus(422)->assertJsonValidationErrors(['priority', 'tags']);
    expect(rowOf('collab_conversations', 'CNV-0104')->priority)->toBe('media');
});
