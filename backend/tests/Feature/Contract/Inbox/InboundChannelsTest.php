<?php

use App\Domain\Integrations\Support\ChannelWebhooks;
use App\Domain\Platform\Support\WhatsappWebhook;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Testing\TestResponse;

beforeEach(fn () => $this->withoutMiddleware(ThrottleRequests::class));

function inboxCtAccount(string $channel, string $identifier, string $secret = 'secreto-del-webhook-inbox', ?string $tenantId = null): string
{
    $id = (string) Str::uuid7();
    DB::connection('pgsql_owner')->table('collab_channel_accounts')->insert([
        'id' => $id,
        'tenant_id' => $tenantId ?? tenantA()->getKey(),
        'channel' => $channel,
        'name' => 'Cuenta de pruebas',
        'phone_number_id' => $channel === 'whatsapp' ? $identifier : null,
        'mailbox' => $channel === 'email' ? $identifier : null,
        'webhook_secret_encrypted' => Crypt::encryptString($secret),
        'first_response_sla_minutes' => 60,
        'status' => 'activo',
    ]);
    test()->beforeApplicationDestroyed(fn () => DB::connection('pgsql_owner')->table('collab_channel_accounts')->where('id', $id)->delete());

    return $id;
}

function inboxCtSigned(string $raw, string $secret): array
{
    return ['CONTENT_TYPE' => 'application/json', 'HTTP_ACCEPT' => 'application/json', 'HTTP_X_HUB_SIGNATURE_256' => ChannelWebhooks::sign($raw, $secret)];
}

function inboxCtWaPost(array $payload, string $secret = 'secreto-del-webhook-inbox'): TestResponse
{
    $raw = (string) json_encode($payload);

    return test()->call('POST', '/api/v1/integrations/whatsapp/webhook', [], [], [], inboxCtSigned($raw, $secret), $raw);
}

function inboxCtMailPost(array $payload, string $secret = 'secreto-del-webhook-inbox'): TestResponse
{
    $raw = (string) json_encode($payload);

    return test()->call('POST', '/api/v1/integrations/email/inbound', [], [], [], inboxCtSigned($raw, $secret), $raw);
}

function inboxCtWhatsapp(string $phoneNumberId, string $messageId, string $text, string $from = '51999102334'): array
{
    return [
        'object' => 'whatsapp_business_account',
        'entry' => [[
            'id' => 'WABA-1',
            'changes' => [[
                'field' => 'messages',
                'value' => [
                    'messaging_product' => 'whatsapp',
                    'metadata' => ['display_phone_number' => '51984120450', 'phone_number_id' => $phoneNumberId],
                    'contacts' => [['profile' => ['name' => 'Gabriela Ríos'], 'wa_id' => $from]],
                    'messages' => [['from' => $from, 'id' => $messageId, 'timestamp' => (string) now()->timestamp, 'type' => 'text', 'text' => ['body' => $text]]],
                ],
            ]],
        ]],
    ];
}

function inboxCtTenant(Closure $fn): mixed
{
    return withinTenant(tenantA(), $fn);
}

function inboxCtAudit(array $where): bool
{
    return inboxCtTenant(fn () => DB::table('audit_events')->where($where)->exists());
}

it('GET /integrations/whatsapp/webhook devuelve el challenge solo con el token de verificación de la consola', function () {
    $query = fn (string $token) => '/api/v1/integrations/whatsapp/webhook?hub.mode=subscribe&hub.verify_token='.$token.'&hub.challenge=1158201444';

    expect($this->get($query('token-de-meta-pruebas'), ['Accept' => 'application/json']))->toBeApiError(403, 'WEBHOOK_VERIFY_TOKEN_INVALID');

    actingAsPlatform();
    $summary = $this->putJson('/api/v1/platform/settings/whatsapp-webhook', ['verify_token' => 'token-de-meta-pruebas'])->assertOk()->json('data');

    expect($summary['verify_token_set'])->toBeTrue()
        ->and(json_encode($summary))->not->toContain('token-de-meta-pruebas')
        ->and(DB::connection('pgsql_platform')->table('platform_settings')->where('key', WhatsappWebhook::KEY)->value('value'))->not->toContain('token-de-meta-pruebas')
        ->and(DB::connection('pgsql_platform')->table('audit_events')->whereNull('tenant_id')->where('entity_id', 'Token de verificación de WhatsApp')->value('after_value'))->toBe('cambiado');

    $this->getJson('/api/v1/platform/settings')->assertOk()->assertJsonPath('data.sections.whatsapp_webhook.verify_token_set', true);
    expect($this->putJson('/api/v1/platform/settings/whatsapp-webhook', ['verify_token' => 'token-de-meta-pruebas']))->toBeApiError(422, 'CFG-BR-01');

    $ok = $this->get($query('token-de-meta-pruebas'))->assertOk();
    expect($ok->getContent())->toBe('1158201444');

    $wrong = $this->get($query('otro-token-cualquiera'), ['Accept' => 'application/json']);
    expect($wrong)->toBeApiError(403, 'WEBHOOK_VERIFY_TOKEN_INVALID')
        ->and($wrong->json('required_permissions'))->toBe(['verify_token']);

    $this->putJson('/api/v1/platform/settings/whatsapp-webhook', ['clear' => true])->assertOk()->assertJsonPath('data.verify_token_set', false);
    expect($this->get($query('token-de-meta-pruebas'), ['Accept' => 'application/json']))->toBeApiError(403);
});

it('POST /integrations/whatsapp/webhook valida la firma, crea la conversación una sola vez y reabre la resuelta', function () {
    $phone = (string) random_int(100000000000, 999999999999);
    $account = inboxCtAccount('whatsapp', $phone);
    $payload = inboxCtWhatsapp($phone, 'wamid.'.Str::random(20), 'Hola, quiero cambiar la fecha de mi tour.');

    expect(inboxCtWaPost($payload, 'firma-equivocada-del-todo'))->toBeApiError(401, 'WEBHOOK_SIGNATURE_INVALID');
    expect(inboxCtWaPost(inboxCtWhatsapp('000111222', 'wamid.x', 'Hola')))->toBeApiError(404);

    inboxCtWaPost($payload)->assertStatus(202)->assertJsonPath('data.received', 1)->assertJsonPath('data.duplicates', 0);
    inboxCtWaPost($payload)->assertStatus(202)->assertJsonPath('data.received', 0)->assertJsonPath('data.duplicates', 1)->assertJsonPath('data.events.0.status', 'duplicado');

    $conversation = inboxCtTenant(fn () => DB::table('collab_conversations')->where('channel_account_id', $account)->first());
    $client = inboxCtTenant(fn () => DB::table('crm_clients')->whereNull('deleted_at')->where('phone_norm', '999102334')->value('id'));

    expect($conversation)->not->toBeNull()
        ->and($conversation->channel)->toBe('whatsapp')
        ->and($conversation->contact_name)->toBe('Gabriela Ríos')
        ->and($conversation->status)->toBe('abierta')
        ->and($conversation->client_id)->toBe($client)
        ->and(inboxCtTenant(fn () => DB::table('collab_messages')->where('conversation_id', $conversation->id)->where('direction', 'in')->count()))->toBe(1)
        ->and(inboxCtTenant(fn () => DB::table('collab_inbound_events')->where('channel', 'whatsapp')->where('external_event_id', $payload['entry'][0]['changes'][0]['value']['messages'][0]['id'])->value('status')))->toBe('procesado')
        ->and(inboxCtAudit(['entity' => 'Conversación', 'entity_id' => $conversation->code, 'action' => 'crear']))->toBeTrue();

    inboxCtTenant(fn () => DB::table('collab_conversations')->where('id', $conversation->id)->update(['status' => 'resuelta', 'resolved_at' => now()]));
    inboxCtWaPost(inboxCtWhatsapp($phone, 'wamid.'.Str::random(20), 'Una consulta más, por favor.'))->assertStatus(202)->assertJsonPath('data.received', 1);

    $after = inboxCtTenant(fn () => DB::table('collab_conversations')->where('id', $conversation->id)->first());
    expect($after->status)->toBe('abierta')
        ->and($after->resolved_at)->toBeNull()
        ->and(inboxCtTenant(fn () => DB::table('collab_conversations')->where('channel_account_id', $account)->count()))->toBe(1)
        ->and(inboxCtTenant(fn () => DB::table('collab_messages')->where('conversation_id', $conversation->id)->where('direction', 'system')->count()))->toBe(1)
        ->and(inboxCtAudit(['entity' => 'Conversación', 'entity_id' => $conversation->code, 'action' => 'mensaje_entrante']))->toBeTrue();
});

it('POST /integrations/email/inbound resuelve la agencia por buzón, guarda adjuntos y une las respuestas al mismo hilo', function () {
    Storage::fake((string) config('filesystems.default'));
    $mailbox = 'atencion-'.Str::lower(Str::random(8)).'@agencia-pruebas.pe';
    $account = inboxCtAccount('email', $mailbox);
    $first = [
        'message_id' => '<'.Str::random(16).'@correo.pe>',
        'from' => 'Gabriela Ríos <gabriela.rios@correo.pe>',
        'to' => ['Reservas <otro@agencia-pruebas.pe>', "Atención <{$mailbox}>"],
        'subject' => 'Consulta por el tour a Machu Picchu',
        'html' => '<p>Hola,</p><p>¿Tienen cupos para el 20?</p>',
        'attachments' => [['file_name' => 'pasaporte.pdf', 'mime' => 'application/pdf', 'content' => base64_encode("%PDF-1.4\n%prueba\n")]],
    ];

    expect(inboxCtMailPost($first, 'firma-equivocada-del-todo'))->toBeApiError(401, 'WEBHOOK_SIGNATURE_INVALID');
    expect(inboxCtMailPost([...$first, 'to' => 'nadie@desconocido.pe']))->toBeApiError(404);
    expect(inboxCtMailPost(['from' => 'x@y.pe']))->toBeApiError(422);

    inboxCtMailPost($first)->assertStatus(202)->assertJsonPath('data.received', 1);
    inboxCtMailPost($first)->assertStatus(202)->assertJsonPath('data.duplicates', 1);
    inboxCtMailPost([
        'message_id' => '<'.Str::random(16).'@correo.pe>',
        'in_reply_to' => $first['message_id'],
        'from' => 'gabriela.rios@correo.pe',
        'to' => $mailbox,
        'subject' => 'Re: Consulta por el tour a Machu Picchu',
        'text' => 'Seríamos dos personas.',
    ])->assertStatus(202)->assertJsonPath('data.received', 1);

    $conversation = inboxCtTenant(fn () => DB::table('collab_conversations')->where('channel_account_id', $account)->first());
    $messages = inboxCtTenant(fn () => DB::table('collab_messages')->where('conversation_id', $conversation->id)->where('direction', 'in')->orderBy('sent_at')->get());
    $attachment = inboxCtTenant(fn () => DB::table('collab_message_attachments')->where('message_id', $messages->first()->id)->first());
    $event = inboxCtTenant(fn () => DB::table('collab_inbound_events')->where('channel', 'email')->where('external_event_id', trim($first['message_id'], '<>'))->first());

    expect(inboxCtTenant(fn () => DB::table('collab_conversations')->where('channel_account_id', $account)->count()))->toBe(1)
        ->and($conversation->channel)->toBe('email')
        ->and($conversation->subject)->toBe('Consulta por el tour a Machu Picchu')
        ->and($conversation->contact_email)->toBe('gabriela.rios@correo.pe')
        ->and($conversation->client_id)->not->toBeNull()
        ->and($messages)->toHaveCount(2)
        ->and($messages->first()->body)->toContain('¿Tienen cupos para el 20?')
        ->and($attachment->file_name)->toBe('pasaporte.pdf')
        ->and(Storage::disk((string) config('filesystems.default'))->exists($attachment->storage_path))->toBeTrue()
        ->and($event->status)->toBe('procesado')
        ->and($event->payload)->not->toContain(base64_encode("%PDF-1.4\n%prueba\n"));
});

it('GET y PUT /inbox/channel-accounts configuran el número, el buzón y el secreto cifrado, con auditoría y permisos', function () {
    actingAsSeed('U01');
    $channels = collect($this->getJson('/api/v1/inbox/channel-accounts')->assertOk()->json('data'))->keyBy('channel');
    expect($channels->keys()->all())->toBe(['whatsapp', 'email'])
        ->and($channels['email']['connected'])->toBeFalse();

    expect($this->putJson('/api/v1/inbox/channel-accounts/email', ['mailbox' => 'atencion@andes-pruebas.pe', 'status' => 'activo']))->toBeApiError(422, 'INB-CH-03');
    expect($this->putJson('/api/v1/inbox/channel-accounts/email', ['phone_number_id' => '123456789']))->toBeApiError(422);

    $saved = $this->putJson('/api/v1/inbox/channel-accounts/email', ['mailbox' => 'Atencion@Andes-Pruebas.pe', 'webhook_secret' => 'secreto-largo-de-correo-123', 'status' => 'activo', 'first_response_sla_minutes' => 90])->assertOk()->json('data');
    $stored = inboxCtTenant(fn () => DB::table('collab_channel_accounts')->where('channel', 'email')->first());

    expect($saved['mailbox'])->toBe('atencion@andes-pruebas.pe')
        ->and($saved['webhook_secret_set'])->toBeTrue()
        ->and($saved['status'])->toBe('activo')
        ->and(json_encode($saved))->not->toContain('secreto-largo-de-correo-123')
        ->and($stored->webhook_secret_encrypted)->not->toContain('secreto-largo')
        ->and(Crypt::decryptString($stored->webhook_secret_encrypted))->toBe('secreto-largo-de-correo-123')
        ->and(inboxCtAudit(['entity' => 'Cuenta de canal', 'entity_id' => 'Correo de atención · Secreto del webhook', 'after_value' => 'cambiado']))->toBeTrue();

    expect($this->putJson('/api/v1/inbox/channel-accounts/email', ['mailbox' => 'atencion@andes-pruebas.pe']))->toBeApiError(422, 'INB-CH-01');
    $this->putJson('/api/v1/inbox/channel-accounts/email', ['status' => 'inactivo'])->assertOk()->assertJsonPath('data.status', 'inactivo');

    $taken = (string) random_int(100000000000, 999999999999);
    inboxCtAccount('whatsapp', $taken, tenantId: tenantB()->getKey());
    expect($this->putJson('/api/v1/inbox/channel-accounts/whatsapp', ['phone_number_id' => $taken]))->toBeApiError(409, 'INB-CH-04');
    $this->putJson('/api/v1/inbox/channel-accounts/whatsapp', ['phone_number_id' => '109876543210', 'webhook_secret' => 'secreto-largo-de-whatsapp-1'])->assertOk()->assertJsonPath('data.phone_number_id', '109876543210')->assertJsonPath('data.webhook_secret_set', true);

    actingAsSeed('U04');
    $forbidden = $this->getJson('/api/v1/inbox/channel-accounts');
    expect($forbidden)->toBeApiError(403)
        ->and($forbidden->json('required_permissions'))->toContain('admin.settings.manage');
    expect($this->putJson('/api/v1/inbox/channel-accounts/email', ['status' => 'activo']))->toBeApiError(403);
});
