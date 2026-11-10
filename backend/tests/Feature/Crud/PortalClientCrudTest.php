<?php

use Illuminate\Support\Facades\DB;

function portalConsentimiento(string $client, string $channel): ?object
{
    return withinTenant(tenantA(), fn () => DB::table('mkt_consents')->where('subject_type', 'client')->where('subject_id', idOf('crm_clients', $client))->where('channel', $channel)->first());
}

function portalAuditoria(string $entityId, string $action): ?object
{
    return withinTenant(tenantA(), fn () => DB::table('audit_events')->where('entity_id', $entityId)->where('action', $action)->orderByDesc('occurred_at')->first());
}

it('actualizar el perfil desde el portal cambia la ficha del cliente en el back-office y el idioma del usuario', function () {
    actingAsSeed('U14');

    $this->patchJson('/api/v1/portal/client/profile', ['email' => 'Gabriela.Rios@NuevoCorreo.pe', 'phone' => '+51 988 777 666', 'city' => 'Arequipa', 'country' => 'Perú', 'locale' => 'en'])->assertOk();

    $client = rowOf('crm_clients', 'CLI-0001');
    $profile = $this->getJson('/api/v1/portal/client/profile')->assertOk()->json('data');

    expect($client->email)->toBe('Gabriela.Rios@NuevoCorreo.pe')
        ->and($client->email_norm)->toBe('gabriela.rios@nuevocorreo.pe')
        ->and($client->phone)->toBe('+51 988 777 666')
        ->and($client->phone_norm)->toBe('988777666')
        ->and($client->city)->toBe('Arequipa')
        ->and(rowOf('iam_users', 'U14')->locale)->toBe('en')
        ->and($profile['client']['city'])->toBe('Arequipa')
        ->and($profile['locale'])->toBe('en')
        ->and(json_decode((string) portalAuditoria('CLI-0001', 'actualizar_portal')?->diff, true)['before']['city'])->toBe('Lima');

    actingAsSeed('U01');
    $this->getJson('/api/v1/crm/clients/CLI-0001')->assertOk()
        ->assertJsonPath('data.email', 'Gabriela.Rios@NuevoCorreo.pe')
        ->assertJsonPath('data.city', 'Arequipa');
});

it('actualizar solo el idioma no borra el correo, el teléfono ni la ciudad del cliente', function () {
    actingAsSeed('U14');
    $before = rowOf('crm_clients', 'CLI-0001');

    $this->patchJson('/api/v1/portal/client/profile', ['locale' => 'pt'])->assertOk();
    $after = rowOf('crm_clients', 'CLI-0001');

    expect($after->email)->toBe($before->email)
        ->and($after->phone)->toBe($before->phone)
        ->and($after->city)->toBe($before->city)
        ->and($after->country)->toBe($before->country)
        ->and(rowOf('iam_users', 'U14')->locale)->toBe('pt');
});

it('el perfil no acepta un correo o teléfono que ya pertenece a otro cliente', function () {
    actingAsSeed('U14');

    expect($this->patchJson('/api/v1/portal/client/profile', ['email' => 'viajes@mcblanca.com.pe', 'locale' => 'es']))->toBeApiError(409, 'CRM-BR-17');
    expect($this->patchJson('/api/v1/portal/client/profile', ['phone' => '01 705 3300', 'locale' => 'es']))->toBeApiError(409, 'CRM-BR-17');
    expect(rowOf('crm_clients', 'CLI-0001')->email)->toBe('gabriela.rios@correo.pe');
});

it('el perfil valida correo, teléfono e idioma', function () {
    actingAsSeed('U14');

    $this->patchJson('/api/v1/portal/client/profile', ['email' => 'no-es-correo', 'phone' => 'abc', 'locale' => 'it'])
        ->assertStatus(422)->assertJsonValidationErrors(['email', 'phone', 'locale']);
});

it('el pasajero no puede cambiar los datos del cliente ni sus consentimientos', function () {
    actingAsSeed('U15');
    $before = rowOf('crm_clients', 'CLI-0003');

    expect($this->patchJson('/api/v1/portal/client/profile', ['city' => 'Berlín', 'locale' => 'de']))->toBeApiError(403, 'PORTAL_READ_ONLY');
    expect($this->putJson('/api/v1/portal/client/profile/consents/email', ['granted' => false]))->toBeApiError(403, 'PORTAL_CUSTOMER_ONLY');
    expect(rowOf('crm_clients', 'CLI-0003')->city)->toBe($before->city)
        ->and(portalConsentimiento('CLI-0003', 'email')->status)->toBe('otorgado');
});

it('revocar y volver a otorgar un consentimiento cambia el estado del cliente, deja la evidencia y la auditoría', function () {
    actingAsSeed('U14');
    $consent = portalConsentimiento('CLI-0001', 'whatsapp');

    $this->putJson('/api/v1/portal/client/profile/consents/whatsapp', ['granted' => false])->assertOk()->assertJsonPath('data.channel', 'whatsapp');
    $revoked = portalConsentimiento('CLI-0001', 'whatsapp');
    $profile = collect($this->getJson('/api/v1/portal/client/profile')->assertOk()->json('data.consents'))->keyBy('channel');

    expect($revoked->id)->toBe($consent->id)
        ->and($revoked->status)->toBe('revocado')
        ->and($revoked->revoke_source)->toBe('Portal del cliente')
        ->and((int) $revoked->lock_version)->toBe((int) $consent->lock_version + 1)
        ->and($profile['whatsapp']['granted'])->toBeFalse()
        ->and($profile['email']['granted'])->toBeTrue()
        ->and(portalAuditoria('CLI-0001', 'revocar_consentimiento')?->after_value)->toBe('whatsapp · revocado');

    $this->putJson('/api/v1/portal/client/profile/consents/whatsapp', ['granted' => true])->assertOk();
    $events = withinTenant(tenantA(), fn () => DB::table('mkt_consent_events')->where('consent_id', $consent->id)->orderBy('occurred_at')->pluck('event')->all());

    expect(portalConsentimiento('CLI-0001', 'whatsapp')->status)->toBe('otorgado')
        ->and(portalConsentimiento('CLI-0001', 'whatsapp')->revoked_at)->toBeNull()
        ->and(array_slice($events, -2))->toBe(['revocado', 'otorgado'])
        ->and(portalAuditoria('CLI-0001', 'otorgar_consentimiento'))->not->toBeNull();
});

it('repetir el mismo consentimiento no genera eventos nuevos', function () {
    actingAsSeed('U14');
    $consent = portalConsentimiento('CLI-0001', 'email');
    $count = fn () => withinTenant(tenantA(), fn () => DB::table('mkt_consent_events')->where('consent_id', $consent->id)->count());
    $before = $count();

    $this->putJson('/api/v1/portal/client/profile/consents/email', ['granted' => true])->assertOk();

    expect($count())->toBe($before)
        ->and((int) portalConsentimiento('CLI-0001', 'email')->lock_version)->toBe((int) $consent->lock_version);
});

it('el consentimiento solo acepta los canales del portal y exige la decisión', function () {
    actingAsSeed('U14');

    expect($this->putJson('/api/v1/portal/client/profile/consents/sms', ['granted' => true]))->toBeApiError(404);
    $this->putJson('/api/v1/portal/client/profile/consents/email', [])->assertStatus(422)->assertJsonValidationErrors('granted');
});

it('el mensaje del portal abre un ticket que llega a la bandeja de la agencia asignado al asesor del cliente', function () {
    actingAsSeed('U14');

    $code = $this->postJson('/api/v1/portal/client/tickets', ['subject' => 'Cambio de hotel', 'body' => 'Quisiera cambiar el hotel de Cusco.', 'topic' => 'cambios'])->assertOk()->json('data.code');
    $conversation = rowOf('collab_conversations', $code);
    $message = withinTenant(tenantA(), fn () => DB::table('collab_messages')->where('conversation_id', $conversation->id)->first());

    expect($conversation->channel)->toBe('portal')
        ->and($conversation->status)->toBe('abierta')
        ->and($conversation->subject)->toBe('Cambio de hotel')
        ->and($conversation->priority)->toBe('media')
        ->and($conversation->client_id)->toBe(idOf('crm_clients', 'CLI-0001'))
        ->and($conversation->assignee_id)->toBe(seedUser('U04')->id)
        ->and((int) $conversation->unread_count)->toBe(1)
        ->and($message->direction)->toBe('in')
        ->and($message->body)->toBe('Quisiera cambiar el hotel de Cusco.')
        ->and(portalAuditoria($code, 'mensaje_portal'))->not->toBeNull();
    expect(collect($this->getJson('/api/v1/portal/client/tickets')->assertOk()->json('data'))->flatten()->all())->toContain($code);

    actingAsSeed('U01');
    $this->getJson("/api/v1/inbox/conversations/{$code}")->assertOk();
});

it('responder en el mismo ticket reabre la conversación y suma un no leído', function () {
    actingAsSeed('U14');
    $code = $this->postJson('/api/v1/portal/client/tickets', ['body' => 'Primera consulta', 'topic' => 'salud'])->assertOk()->json('data.code');
    withinTenant(tenantA(), fn () => DB::table('collab_conversations')->where('code', $code)->update(['status' => 'resuelta', 'unread_count' => 0, 'resolved_at' => now()]));

    $this->postJson('/api/v1/portal/client/tickets', ['conversation' => $code, 'body' => 'Sigo con la duda'])->assertOk()->assertJsonPath('data.code', $code);
    $conversation = rowOf('collab_conversations', $code);

    expect($conversation->status)->toBe('abierta')
        ->and($conversation->priority)->toBe('alta')
        ->and((int) $conversation->unread_count)->toBe(1)
        ->and($conversation->resolved_at)->toBeNull()
        ->and(withinTenant(tenantA(), fn () => DB::table('collab_messages')->where('conversation_id', $conversation->id)->count()))->toBe(2);
});

it('el ticket valida el mensaje y no deja escribir en conversaciones ajenas ni en viajes ajenos', function () {
    actingAsSeed('U14');
    $this->postJson('/api/v1/portal/client/tickets', ['body' => ''])->assertStatus(422)->assertJsonValidationErrors('body');
    $this->postJson('/api/v1/portal/client/tickets', ['body' => 'Hola', 'topic' => 'otro'])->assertStatus(422)->assertJsonValidationErrors('topic');

    actingAsSeed('U15');
    $foreign = $this->postJson('/api/v1/portal/client/tickets', ['body' => 'Consulta del pasajero'])->assertOk()->json('data.code');

    actingAsSeed('U14');
    expect($this->postJson('/api/v1/portal/client/tickets', ['conversation' => $foreign, 'body' => 'Intento']))->toBeApiError(404);
    expect($this->postJson('/api/v1/portal/client/tickets', ['trip' => 'RES-2026-000348', 'body' => 'Intento'])->status())->toBeIn([403, 404]);
    expect(withinTenant(tenantA(), fn () => DB::table('collab_messages')->where('conversation_id', rowOf('collab_conversations', $foreign)->id)->count()))->toBe(1);
});

it('el ticket del pasajero queda ligado a su viaje', function () {
    actingAsSeed('U15');

    $code = $this->postJson('/api/v1/portal/client/tickets', ['body' => '¿A qué hora es el recojo?'])->assertOk()->json('data.code');
    $conversation = rowOf('collab_conversations', $code);

    expect($conversation->reservation_id)->not->toBeNull()
        ->and($conversation->client_id)->toBe(idOf('crm_clients', 'CLI-0003'));
});
