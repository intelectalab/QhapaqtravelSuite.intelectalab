<?php

use App\Domain\Integrations\Support\ChannelWebhooks;
use App\Domain\Platform\Support\OutgoingMail;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Testing\TestResponse;

const MENSAJES_SES_SECRET = 'secreto-ses-de-pruebas-2026';
const MENSAJES_WA_SECRET = 'secreto-meta-de-pruebas-2026';
const MENSAJES_WA_PHONE = '+51 984 120 450';

beforeEach(function () {
    $this->withoutMiddleware(ThrottleRequests::class);
});

function mensajesSesSecret(): void
{
    app(OutgoingMail::class)->store([], null, null, (string) platformUser()->getKey(), ['ses' => MENSAJES_SES_SECRET]);
}

function mensajesWhatsappSecret(): void
{
    withinTenant(tenantA(), fn () => DB::table('collab_channel_accounts')->where('channel', 'whatsapp')->where('phone_number_id', MENSAJES_WA_PHONE)->update(['webhook_secret_encrypted' => Crypt::encryptString(MENSAJES_WA_SECRET)]));
}

function mensajes_post(string $url, array $payload, string $header, ?string $signature): TestResponse
{
    $raw = json_encode($payload);
    $server = ['CONTENT_TYPE' => 'application/json', 'HTTP_ACCEPT' => 'application/json'];

    if ($signature !== null) {
        $server['HTTP_'.str_replace('-', '_', strtoupper($header))] = $signature === '' ? ChannelWebhooks::sign($raw, $header === 'X-Signature' ? MENSAJES_SES_SECRET : MENSAJES_WA_SECRET) : $signature;
    }

    return test()->call('POST', $url, [], [], [], $server, $raw);
}

function mensajesEmail(array $event, ?string $signature = ''): TestResponse
{
    return mensajes_post('/api/v1/integrations/email/webhooks', $event, 'X-Signature', $signature);
}

function mensajesWhatsapp(string $kind, array $value, string $field, ?string $signature = ''): TestResponse
{
    $payload = ['object' => 'whatsapp_business_account', 'entry' => [['id' => 'WABA-PEST', 'time' => 1790000000, 'changes' => [['field' => $field, 'value' => ['metadata' => ['phone_number_id' => MENSAJES_WA_PHONE], ...$value]]]]]];

    return $kind === 'templates'
        ? mensajes_post('/api/v1/integrations/whatsapp/webhooks/templates', $payload, ChannelWebhooks::SIGNATURE_HEADER, $signature)
        : mensajes_post('/api/v1/integrations/whatsapp/webhooks/messages', $payload, ChannelWebhooks::SIGNATURE_HEADER, $signature);
}

function mensajesRecipient(string $providerMessageId): object
{
    return withinTenant(tenantA(), fn () => DB::table('mkt_campaign_recipients')->where('provider_message_id', $providerMessageId)->first());
}

function mensajesResetRecipient(string $providerMessageId): object
{
    withinTenant(tenantA(), fn () => DB::table('mkt_campaign_recipients')->where('provider_message_id', $providerMessageId)->update(['status' => 'enviado', 'delivered_at' => null, 'opened_at' => null, 'clicked_at' => null, 'replied_at' => null, 'unsubscribed_at' => null, 'error' => null]));

    return mensajesRecipient($providerMessageId);
}

function mensajesGrantConsent(object $recipient, string $channel): string
{
    return withinTenant(tenantA(), function () use ($recipient, $channel) {
        $existing = DB::table('mkt_consents')->where('subject_type', $recipient->subject_type)->where('subject_id', $recipient->subject_id)->where('channel', $channel)->value('id');

        if ($existing !== null) {
            DB::table('mkt_consents')->where('id', $existing)->update(['status' => 'otorgado', 'revoked_at' => null, 'revoke_source' => null, 'revoke_campaign_id' => null]);

            return (string) $existing;
        }

        return (string) DB::table('mkt_consents')->insertGetId([
            'code' => 'CNS-PEST-'.strtoupper(substr($channel, 0, 2)),
            'subject_type' => $recipient->subject_type,
            'subject_id' => $recipient->subject_id,
            'channel' => $channel,
            'status' => 'otorgado',
            'granted_at' => now(),
            'source' => 'Formulario de pruebas',
            'evidence' => 'Casilla marcada en pruebas',
            'policy_version' => 'v1',
        ]);
    });
}

function mensajesAudited(array $where): bool
{
    return (bool) withinTenant(tenantA(), fn () => DB::table('audit_events')->where($where)->exists());
}

it('POST /integrations/email/webhooks registra entrega, apertura y clic una sola vez por id de evento', function () {
    mensajesSesSecret();
    $recipient = mensajesResetRecipient('cmp-0008-001');

    $first = mensajesEmail(['event_id' => 'ses-evt-1', 'type' => 'delivered', 'message_id' => 'cmp-0008-001', 'occurred_at' => '2026-09-29T15:00:00Z'])->assertCreated()->json('data');
    expect($first)->toMatchArray(['result' => 'actualizado', 'status' => 'entregado', 'reference' => 'CMP-0008']);

    mensajesEmail(['event_id' => 'ses-evt-2', 'type' => 'clicked', 'message_id' => 'cmp-0008-001'])->assertCreated()->assertJsonPath('data.result', 'actualizado');
    mensajesEmail(['event_id' => 'ses-evt-2', 'type' => 'clicked', 'message_id' => 'cmp-0008-001'])->assertCreated()->assertJsonPath('data.result', 'duplicado');
    mensajesEmail(['event_id' => 'ses-evt-3', 'type' => 'delivered', 'message_id' => 'cmp-0008-001'])->assertCreated()->assertJsonPath('data.result', 'duplicado');

    $row = mensajesRecipient('cmp-0008-001');
    expect($row->status)->toBe('entregado')
        ->and($row->delivered_at)->not->toBeNull()
        ->and($row->opened_at)->not->toBeNull()
        ->and($row->clicked_at)->not->toBeNull()
        ->and(mensajesAudited(['entity' => 'Campaña', 'entity_id' => 'CMP-0008', 'action' => 'acuse_envio']))->toBeTrue()
        ->and(withinTenant(tenantA(), fn () => DB::table('collab_inbound_events')->where('channel', 'email')->where('external_event_id', 'estado:ses-evt-2')->count()))->toBe(1)
        ->and($recipient->status)->toBe('enviado');
});

it('POST /integrations/email/webhooks marca el rebote, rechaza firmas inválidas e ignora correos ajenos', function () {
    mensajesSesSecret();
    mensajesResetRecipient('cmp-0008-003');

    mensajesEmail(['event_id' => 'ses-evt-10', 'type' => 'bounced', 'message_id' => 'cmp-0008-003', 'reason' => 'Buzón inexistente'])->assertCreated()->assertJsonPath('data.status', 'rebotado');
    expect(mensajesRecipient('cmp-0008-003'))->status->toBe('rebotado')->error->toBe('Buzón inexistente');

    expect(mensajesEmail(['event_id' => 'ses-evt-11', 'type' => 'opened', 'message_id' => 'cmp-0008-003'], 'sha256=firma-falsa'))->toBeApiError(401, 'WEBHOOK_SIGNATURE_INVALID');
    expect(mensajesEmail(['event_id' => 'ses-evt-11', 'type' => 'opened', 'message_id' => 'cmp-0008-003'], null))->toBeApiError(401, 'WEBHOOK_SIGNATURE_INVALID');
    mensajesEmail(['event_id' => 'ses-evt-12', 'type' => 'opened', 'message_id' => 'no-existe-en-ninguna-campana'])->assertCreated()->assertJsonPath('data.result', 'ignorado');
    mensajesEmail(['event_id' => 'ses-evt-13', 'type' => 'abierto', 'message_id' => 'cmp-0008-003'])->assertUnprocessable()->assertJsonPath('errors.type.0', 'El evento del correo no tiene el formato esperado.');
});

it('POST /integrations/email/webhooks con respuesta BAJA revoca el consentimiento del contacto', function () {
    mensajesSesSecret();
    $recipient = mensajesResetRecipient('cmp-0008-002');
    $consent = mensajesGrantConsent($recipient, 'email');

    mensajesEmail(['event_id' => 'ses-evt-20', 'type' => 'replied', 'message_id' => 'cmp-0008-002', 'reply' => 'baja'])->assertCreated()->assertJsonPath('data.result', 'baja');

    $stored = withinTenant(tenantA(), fn () => DB::table('mkt_consents')->where('id', $consent)->first());
    expect($stored->status)->toBe('revocado')
        ->and($stored->revoke_campaign_id)->toBe($recipient->campaign_id)
        ->and($stored->revoke_source)->toBe('Respuesta BAJA a la campaña CMP-0008')
        ->and(mensajesRecipient('cmp-0008-002')->unsubscribed_at)->not->toBeNull()
        ->and(withinTenant(tenantA(), fn () => DB::table('mkt_consent_events')->where('consent_id', $consent)->where('event', 'revocado')->count()))->toBe(1)
        ->and(mensajesAudited(['entity' => 'Consentimiento', 'action' => 'baja_email']))->toBeTrue();

    mensajesEmail(['event_id' => 'ses-evt-20', 'type' => 'replied', 'message_id' => 'cmp-0008-002', 'reply' => 'baja'])->assertCreated()->assertJsonPath('data.result', 'duplicado');
    mensajesEmail(['event_id' => 'ses-evt-21', 'type' => 'replied', 'message_id' => 'cmp-0008-005', 'reply' => 'Gracias, me interesa la oferta'])->assertCreated()->assertJsonPath('data.result', 'actualizado');
    expect(mensajesRecipient('cmp-0008-005')->unsubscribed_at)->toBeNull();
});

it('POST /integrations/whatsapp/webhooks/messages aplica estados y la respuesta BAJA por WhatsApp', function () {
    mensajesWhatsappSecret();
    $recipient = mensajesResetRecipient('cmp-0010-001');
    $consent = mensajesGrantConsent($recipient, 'whatsapp');

    $statuses = ['statuses' => [
        ['id' => 'cmp-0010-001', 'status' => 'delivered', 'timestamp' => '1790000100', 'recipient_id' => '51999102334'],
        ['id' => 'cmp-0010-001', 'status' => 'read', 'timestamp' => '1790000200', 'recipient_id' => '51999102334'],
        ['id' => 'cmp-0010-001', 'status' => 'sent', 'timestamp' => '1790000000', 'recipient_id' => '51999102334'],
    ]];
    mensajesWhatsapp('messages', $statuses, 'messages')->assertOk()->assertJsonPath('data', ['actualizados' => 2, 'duplicados' => 0, 'ignorados' => 1, 'bajas' => 0]);
    mensajesWhatsapp('messages', $statuses, 'messages')->assertOk()->assertJsonPath('data.duplicados', 2);

    $row = mensajesRecipient('cmp-0010-001');
    expect($row->status)->toBe('entregado')->and($row->opened_at)->not->toBeNull();

    $reply = ['messages' => [['id' => 'wamid.PEST.REPLY1', 'from' => '51999102334', 'timestamp' => '1790000300', 'type' => 'text', 'text' => ['body' => 'BAJA']]]];
    mensajesWhatsapp('messages', $reply, 'messages')->assertOk()->assertJsonPath('data.bajas', 1);
    mensajesWhatsapp('messages', $reply, 'messages')->assertOk()->assertJsonPath('data.duplicados', 1);

    expect(withinTenant(tenantA(), fn () => DB::table('mkt_consents')->where('id', $consent)->value('status')))->toBe('revocado')
        ->and(mensajesRecipient('cmp-0010-001')->replied_at)->not->toBeNull()
        ->and(mensajesAudited(['entity' => 'Consentimiento', 'action' => 'baja_whatsapp']))->toBeTrue();

    expect(mensajesWhatsapp('messages', $statuses, 'messages', 'sha256=firma-falsa'))->toBeApiError(401, 'WEBHOOK_SIGNATURE_INVALID');
    expect(mensajes_post('/api/v1/integrations/whatsapp/webhooks/messages', ['entry' => [['changes' => [['field' => 'messages', 'value' => ['metadata' => ['phone_number_id' => '000000']]]]]]], ChannelWebhooks::SIGNATURE_HEADER, ''))->toBeApiError(404);
    mensajes_post('/api/v1/integrations/whatsapp/webhooks/messages', ['object' => 'whatsapp_business_account'], ChannelWebhooks::SIGNATURE_HEADER, '')->assertUnprocessable();
});

it('POST /integrations/whatsapp/webhooks/templates aprueba y rechaza plantillas de WhatsApp y de campañas', function () {
    mensajesWhatsappSecret();

    $approved = ['event' => 'APPROVED', 'message_template_id' => 'wa_tpl_sbx_resena_viaje', 'message_template_name' => 'resena_viaje', 'message_template_language' => 'es', 'reason' => 'NONE'];
    mensajesWhatsapp('templates', $approved, 'message_template_status_update')->assertOk()->assertJsonPath('data.templates.0', ['result' => 'actualizado', 'template' => 'resena_viaje', 'status' => 'aprobada']);
    mensajesWhatsapp('templates', $approved, 'message_template_status_update')->assertOk()->assertJsonPath('data.templates.0.result', 'duplicado');

    $rejected = ['event' => 'REJECTED', 'message_template_id' => 'wa_tpl_tpl-05', 'reason' => 'INVALID_FORMAT'];
    mensajesWhatsapp('templates', $rejected, 'message_template_status_update')->assertOk()->assertJsonPath('data.templates.0.result', 'actualizado');

    expect(withinTenant(tenantA(), fn () => DB::table('collab_whatsapp_templates')->where('meta_template_id', 'wa_tpl_sbx_resena_viaje')->value('status')))->toBe('aprobada')
        ->and(withinTenant(tenantA(), fn () => DB::table('mkt_templates')->where('provider_template_id', 'wa_tpl_tpl-05')->value('status')))->toBe('rechazada')
        ->and(mensajesAudited(['entity' => 'Plantilla WhatsApp', 'entity_id' => 'resena_viaje', 'action' => 'respuesta_meta']))->toBeTrue()
        ->and(mensajesAudited(['entity' => 'Plantilla', 'action' => 'aprobacion_meta']))->toBeTrue();

    mensajesWhatsapp('templates', ['event' => 'PENDING', 'message_template_id' => 'wa_tpl_sbx_resena_viaje'], 'message_template_status_update')->assertOk()->assertJsonPath('data.templates.0.result', 'ignorado');
    expect(mensajesWhatsapp('templates', $approved, 'message_template_status_update', 'sha256=firma-falsa'))->toBeApiError(401);
});

it('POST /webhooks/providers/{provider} registra acuses entregado y leído con dedupe por provider_message_id', function () {
    mensajesWhatsappSecret();
    $code = (string) withinTenant(tenantA(), function () {
        $code = DB::table('notif_pax_messages')->where('channel', 'whatsapp')->orderBy('code')->value('code');
        DB::table('notif_pax_messages')->where('code', $code)->update(['status' => 'enviado', 'sent_at' => now(), 'delivered_at' => null, 'read_at' => null, 'provider_message_id' => 'wamid.PEST.PAX1']);

        return $code;
    });
    $ack = fn (string $status) => mensajes_post('/api/v1/webhooks/providers/whatsapp', ['provider_message_id' => 'wamid.PEST.PAX1', 'status' => $status, 'phone_number_id' => MENSAJES_WA_PHONE], ChannelWebhooks::SIGNATURE_HEADER, '');

    $ack('entregado')->assertOk()->assertJsonPath('data.result', 'actualizado')->assertJsonPath('data.status', 'entregado')->assertJsonPath('data.reference', $code);
    $ack('leido')->assertOk()->assertJsonPath('data.status', 'leido');
    $ack('leido')->assertOk()->assertJsonPath('data.result', 'duplicado');
    $ack('entregado')->assertOk()->assertJsonPath('data.result', 'duplicado')->assertJsonPath('data.status', 'leido');

    $message = withinTenant(tenantA(), fn () => DB::table('notif_pax_messages')->where('code', $code)->first());
    expect($message->status)->toBe('leido')
        ->and($message->delivered_at)->not->toBeNull()
        ->and($message->read_at)->not->toBeNull()
        ->and(mensajesAudited(['entity' => 'Mensaje al pasajero', 'entity_id' => $code, 'action' => 'acuse']))->toBeTrue();

    expect(mensajes_post('/api/v1/webhooks/providers/whatsapp', ['provider_message_id' => 'wamid.NO.EXISTE', 'status' => 'leido', 'phone_number_id' => MENSAJES_WA_PHONE], ChannelWebhooks::SIGNATURE_HEADER, ''))->toBeApiError(404);
});

it('POST /webhooks/providers/{provider} valida la firma de la plataforma para SES y FCM', function () {
    mensajesSesSecret();
    mensajesResetRecipient('cmp-0008-004');

    mensajes_post('/api/v1/webhooks/providers/ses', ['provider_message_id' => 'cmp-0008-004', 'status' => 'fallido', 'error' => 'Dirección rechazada'], 'X-Signature', '')
        ->assertOk()->assertJsonPath('data.provider', 'ses')->assertJsonPath('data.status', 'fallido');
    expect(mensajesRecipient('cmp-0008-004'))->status->toBe('fallido')->error->toBe('Dirección rechazada');

    expect(mensajes_post('/api/v1/webhooks/providers/ses', ['provider_message_id' => 'no-existe', 'status' => 'entregado'], 'X-Signature', ''))->toBeApiError(404);
    expect(mensajes_post('/api/v1/webhooks/providers/fcm', ['provider_message_id' => 'cmp-0008-004', 'status' => 'entregado'], 'X-Signature', ''))->toBeApiError(401, 'WEBHOOK_SIGNATURE_INVALID');
    mensajes_post('/api/v1/webhooks/providers/ses', ['provider_message_id' => 'cmp-0008-004', 'status' => 'abierto'], 'X-Signature', '')->assertUnprocessable();
    test()->call('POST', '/api/v1/webhooks/providers/sendgrid', [], [], [], ['CONTENT_TYPE' => 'application/json', 'HTTP_ACCEPT' => 'application/json'], '{}')->assertNotFound();
});

it('PUT /platform/settings/outgoing-mail guarda los secretos de acuses cifrados y sin devolverlos', function () {
    actingAsPlatform();

    $summary = test()->putJson('/api/v1/platform/settings/outgoing-mail', ['enabled' => false, 'encryption' => 'ssl', 'ses_webhook_secret' => MENSAJES_SES_SECRET])->assertOk()->json('data');
    $stored = (array) json_decode((string) DB::connection('pgsql_platform')->table('platform_settings')->where('key', OutgoingMail::KEY)->value('value'), true);

    expect($summary['webhook_secrets'])->toBe(['ses' => true, 'fcm' => false])
        ->and(json_encode($summary))->not->toContain(MENSAJES_SES_SECRET)
        ->and(json_encode($stored))->not->toContain(MENSAJES_SES_SECRET)
        ->and(app(OutgoingMail::class)->webhookSecret('ses'))->toBe(MENSAJES_SES_SECRET);

    expect(test()->putJson('/api/v1/platform/settings/outgoing-mail', ['enabled' => false, 'encryption' => 'ssl', 'fcm_webhook_secret' => 'corto']))->toBeApiError(422);
    expect(test()->putJson('/api/v1/platform/settings/outgoing-mail', ['enabled' => false, 'encryption' => 'ssl', 'ses_webhook_secret' => MENSAJES_SES_SECRET]))->toBeApiError(422, 'CFG-BR-01');
});
