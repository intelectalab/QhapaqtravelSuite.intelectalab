<?php

use Illuminate\Support\Facades\DB;

if (! function_exists('crecbAudited')) {
    function crecbAudited(array $where): bool
    {
        return (bool) withinTenant(tenantA(), fn () => DB::table('audit_events')->where($where)->exists());
    }
}

function crecbTemplate(array $overrides = []): array
{
    return [...['name' => 'aviso_pago_pest', 'lang' => 'es', 'category' => 'utility', 'purpose' => 'link_pago', 'body' => 'Hola {{nombre}}, tu link de pago de {{monto}} está listo.'], ...$overrides];
}

function crecbWhatsappConversation(bool $consent): object
{
    return withinTenant(tenantA(), function () use ($consent) {
        $conversation = DB::table('collab_conversations')->where('channel', 'whatsapp')->whereNotNull('client_id')->orderBy('code')->first();
        DB::table('collab_conversations')->where('id', $conversation->id)->update(['contact_phone' => '+51987654321']);
        $where = ['subject_type' => 'client', 'subject_id' => $conversation->client_id, 'channel' => 'whatsapp'];

        if (! DB::table('mkt_consents')->where($where)->exists()) {
            DB::table('mkt_consents')->insert([...$where, 'code' => 'CNS-PEST-01', 'status' => 'revocado', 'granted_at' => now(), 'revoked_at' => now(), 'source' => 'WhatsApp opt-in', 'evidence' => 'Respuesta SÍ', 'policy_version' => 'v1']);
        }

        DB::table('mkt_consents')->where($where)->update($consent ? ['status' => 'otorgado', 'revoked_at' => null] : ['status' => 'revocado', 'revoked_at' => now()]);

        return $conversation;
    });
}

it('crea una plantilla, abre el número en modo de prueba y la envía a revisión de Meta', function () {
    actingAsSeed('U01');

    $this->postJson('/api/v1/inbox/whatsapp-templates', crecbTemplate())
        ->assertCreated()
        ->assertJsonPath('data.status', 'enviada')
        ->assertJsonPath('data.variables', ['nombre', 'monto']);

    $this->getJson('/api/v1/inbox/whatsapp-templates')->assertOk()
        ->assertJsonPath('data.account.status', 'sandbox')
        ->assertJsonPath('data.templates', fn (array $templates) => collect($templates)->contains('name', 'aviso_pago_pest'));

    $this->postJson('/api/v1/inbox/whatsapp-templates', crecbTemplate())->assertStatus(409);
    $this->postJson('/api/v1/inbox/whatsapp-templates', crecbTemplate(['name' => 'Con Mayúsculas']))->assertStatus(422);

    expect(crecbAudited(['entity' => 'Plantilla WhatsApp', 'entity_id' => 'aviso_pago_pest', 'action' => 'crear']))->toBeTrue();
});

it('registra la respuesta de Meta, pausa, reanuda y una edición del texto vuelve a revisión', function () {
    actingAsSeed('U02');
    $id = $this->postJson('/api/v1/inbox/whatsapp-templates', crecbTemplate())->json('data.id');

    $this->patchJson("/api/v1/inbox/whatsapp-templates/{$id}", ['action' => 'pausar'])->assertStatus(409);
    $this->patchJson("/api/v1/inbox/whatsapp-templates/{$id}", ['meta_status' => 'aprobada'])->assertOk()->assertJsonPath('data.status', 'aprobada');
    $this->patchJson("/api/v1/inbox/whatsapp-templates/{$id}", ['action' => 'pausar'])->assertOk()->assertJsonPath('data.status', 'pausada');
    $this->patchJson("/api/v1/inbox/whatsapp-templates/{$id}", ['action' => 'reanudar'])->assertOk()->assertJsonPath('data.status', 'aprobada');
    $this->patchJson("/api/v1/inbox/whatsapp-templates/{$id}", ['body' => 'Hola {{nombre}}, te recordamos tu link de pago.'])->assertOk()->assertJsonPath('data.status', 'enviada');
});

it('SC-05: envía una plantilla aprobada solo con opt-in del cliente y variables completas', function () {
    actingAsSeed('U01');
    $id = $this->postJson('/api/v1/inbox/whatsapp-templates', crecbTemplate())->json('data.id');
    $conversation = crecbWhatsappConversation(false);

    expect($this->postJson("/api/v1/inbox/conversations/{$conversation->code}/send-template", ['template' => $id, 'variables' => ['nombre' => 'Ana', 'monto' => 'S/ 120']], critical()))
        ->toBeApiError(422, 'SC-05');

    $this->patchJson("/api/v1/inbox/whatsapp-templates/{$id}", ['meta_status' => 'aprobada'])->assertOk();

    expect($this->postJson("/api/v1/inbox/conversations/{$conversation->code}/send-template", ['template' => $id, 'variables' => ['nombre' => 'Ana', 'monto' => 'S/ 120']], critical()))
        ->toBeApiError(422, 'SC-05');

    crecbWhatsappConversation(true);
    $this->postJson("/api/v1/inbox/conversations/{$conversation->code}/send-template", ['template' => $id, 'variables' => ['nombre' => 'Ana']], critical())->assertStatus(422);

    $this->postJson("/api/v1/inbox/conversations/{$conversation->code}/send-template", ['template' => $id, 'variables' => ['nombre' => 'Ana', 'monto' => 'S/ 120']], critical())
        ->assertCreated()
        ->assertJsonPath('data.message.body', 'Hola Ana, tu link de pago de S/ 120 está listo.')
        ->assertJsonPath('data.message.delivery_status', 'enviado');

    expect(withinTenant(tenantA(), fn () => DB::table('collab_messages')->where('conversation_id', $conversation->id)->where('body', 'Hola Ana, tu link de pago de S/ 120 está listo.')->exists()))->toBeTrue()
        ->and(crecbAudited(['entity' => 'Conversación', 'entity_id' => $conversation->code, 'action' => 'enviar_plantilla']))->toBeTrue();
});

it('Ventas no administra las plantillas de WhatsApp: 403', function () {
    actingAsSeed('U03');

    $response = $this->getJson('/api/v1/inbox/whatsapp-templates');

    expect($response)->toBeApiError(403);
    expect($response->json('required_permissions'))->toContain('inbox.whatsapp.manage');
});
