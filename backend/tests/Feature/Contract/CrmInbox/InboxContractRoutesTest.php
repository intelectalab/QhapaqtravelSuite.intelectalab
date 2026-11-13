<?php

use Illuminate\Support\Facades\DB;

require_once __DIR__.'/Support.php';

it('lista la matriz de reglas de aprobación paginada y filtrada por tipo', function () {
    actingAsSeed('U03');

    $response = $this->getJson('/api/v1/approval-rules?filter[type]=cancel')->assertOk();

    expect(collect($response->json('data'))->pluck('type')->unique()->all())->toBe(['cancel'])
        ->and($response->json('meta'))->toHaveKeys(['next_cursor', 'permissions']);
});

it('devuelve los contadores de la bandeja de aprobaciones', function () {
    actingAsSeed('U01');

    expect($this->getJson('/api/v1/approvals/counters')->assertOk()->json('data'))->toHaveKeys(['for_me', 'overdue', 'sent_open', 'resolved_week', 'avg_hours']);
});

it('muestra el detalle de una solicitud con el snapshot del origen', function () {
    actingAsSeed('U01');

    $this->getJson('/api/v1/approvals/APR-2026-0001')->assertOk()
        ->assertJsonPath('data.code', 'APR-2026-0001')
        ->assertJsonStructure(['data' => ['status', 'steps', 'events', 'origin_snapshot']]);
    $this->getJson('/api/v1/approvals/APR-NO-EXISTE')->assertNotFound();
});

it('calcula la penalidad de anulación y exige reservations.cancel', function () {
    actingAsSeed('U01');
    $data = $this->getJson('/api/v1/approvals/cancel-preview/RES-2026-000350')->assertOk()->json('data');
    expect($data['reservation'])->toBe('RES-2026-000350');

    actingAsSeed('U03');
    $response = $this->getJson('/api/v1/approvals/cancel-preview/RES-2026-000350');
    expect($response)->toBeApiError(403);
    expect($response->json('required_permissions'))->toContain('reservations.cancel');
});

it('crea, edita y lista plantillas de respuesta con auditoría', function () {
    actingAsSeed('U01');

    $created = $this->postJson('/api/v1/inbox/templates', ['name' => 'Plantilla de prueba contrato', 'body' => 'Hola, gracias por escribirnos.', 'channels' => ['email', 'whatsapp']])
        ->assertCreated()->json('data');
    expect($created['code'])->toStartWith('PL-')
        ->and($created['channels'])->toBe(['email', 'whatsapp'])
        ->and(crmInboxAudited(['entity' => 'Plantilla de respuesta', 'entity_id' => $created['code'], 'action' => 'crear']))->toBeTrue();

    $this->patchJson("/api/v1/inbox/templates/{$created['code']}", ['body' => 'Hola, ya revisamos tu consulta.'])->assertOk()->assertJsonPath('data.body', 'Hola, ya revisamos tu consulta.');
    $this->patchJson("/api/v1/inbox/templates/{$created['code']}", ['is_active' => false])->assertOk()->assertJsonPath('data.is_active', false);
    $this->patchJson("/api/v1/inbox/templates/{$created['code']}", ['is_active' => false])->assertStatus(422);
    $this->patchJson("/api/v1/inbox/templates/{$created['id']}", ['is_whatsapp_approved' => true])->assertStatus(422);
    $this->postJson('/api/v1/inbox/templates', ['name' => 'Plantilla de prueba contrato', 'body' => 'Otro texto de prueba.'])->assertStatus(409);

    expect(collect($this->getJson('/api/v1/inbox/templates')->assertOk()->json('data'))->pluck('code'))->toContain($created['code']);

    actingAsSeed('U03');
    expect(collect($this->getJson('/api/v1/inbox/templates')->assertOk()->json('data'))->pluck('code'))->not->toContain($created['code']);
    $denied = $this->postJson('/api/v1/inbox/templates', ['name' => 'Sin permiso', 'body' => 'Texto de prueba.']);
    expect($denied)->toBeApiError(403);
    expect($denied->json('required_permissions'))->toContain('admin.settings.manage');
});

it('agrega una nota interna a la conversación', function () {
    actingAsSeed('U01');
    $code = withinTenant(tenantA(), fn () => DB::table('collab_conversations')->orderBy('code')->value('code'));

    $this->postJson("/api/v1/inbox/conversations/{$code}/notes", ['body' => 'Nota interna de prueba'])->assertCreated();

    $note = withinTenant(tenantA(), fn () => DB::table('collab_messages as m')->join('collab_conversations as c', 'c.id', '=', 'm.conversation_id')
        ->where('c.code', $code)->where('m.direction', 'internal')->where('m.body', 'Nota interna de prueba')->exists());
    expect($note)->toBeTrue()
        ->and(crmInboxAudited(['entity' => 'Conversación', 'entity_id' => $code, 'action' => 'nota_interna']))->toBeTrue();

    $this->postJson("/api/v1/inbox/conversations/{$code}/notes", [])->assertStatus(422);
});

it('marca leído y responde el comentario del pasajero con mensaje saliente', function () {
    actingAsSeed('U01');

    $this->postJson('/api/v1/pax-feedback/FB-00002/read')->assertOk();
    expect(rowOf('channel_pax_feedback', 'FB-00002')->status)->toBe('leido');
    $this->postJson('/api/v1/pax-feedback/FB-00002/read')->assertStatus(409);

    expect($this->postJson('/api/v1/pax-feedback/FB-00002/reply', ['channel' => 'portal', 'text' => 'Gracias por tu comentario.']))->toBeApiError(422, 'IDEMPOTENCY_KEY_REQUIRED');

    $conversation = withinTenant(tenantA(), fn () => DB::table('collab_conversations')->where('status', '<>', 'resuelta')->orderBy('code')->first(['id', 'code']));
    withinTenant(tenantA(), fn () => DB::table('channel_pax_feedback')->where('code', 'FB-00002')->update(['conversation_id' => $conversation->id]));

    $data = $this->postJson('/api/v1/pax-feedback/FB-00002/reply', ['channel' => 'portal', 'text' => 'Gracias por tu comentario.', 'status' => 'respondido'], critical())
        ->assertOk()->json('data');

    expect($data['status'])->toBe('respondido')
        ->and($data['conversation'])->toBe($conversation->code)
        ->and(rowOf('channel_pax_feedback', 'FB-00002')->status)->toBe('respondido')
        ->and(rowOf('collab_conversations', $conversation->code)->status)->toBe('resuelta')
        ->and(rowOf('notif_pax_messages', $data['message']['code'])->channel)->toBe('portal')
        ->and(rowOf('notif_pax_messages', $data['message']['code'])->feedback_id)->toBe(rowOf('channel_pax_feedback', 'FB-00002')->id)
        ->and(crmInboxAudited(['entity' => 'Comentario del pasajero', 'entity_id' => 'FB-00002', 'action' => 'responder']))->toBeTrue();

    $this->postJson('/api/v1/pax-feedback/FB-00002/reply', ['channel' => 'email', 'text' => 'Seguimos revisando.', 'status' => 'leido'], critical())->assertStatus(409);
});

it('Finanzas no responde comentarios del pasajero: 403 con inbox.manage', function () {
    actingAsSeed('U07');

    $response = $this->postJson('/api/v1/pax-feedback/FB-00002/read');

    expect($response)->toBeApiError(403);
    expect($response->json('required_permissions'))->toContain('inbox.manage');
});
