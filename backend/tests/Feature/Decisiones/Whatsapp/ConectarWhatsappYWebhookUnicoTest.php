<?php

use App\Domain\Inbox\Support\MessageCipher;
use App\Domain\Inbox\Support\WhatsappAccounts;
use App\Domain\Integrations\Support\ChannelWebhooks;
use App\Domain\Platform\Support\WhatsappWebhook;
use App\Domain\Site\Support\SiteWhatsapp;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;
use Illuminate\Testing\TestResponse;

const WADEC_APP_SECRET = 'secreto-app-kipucontrol-2026';

beforeEach(fn () => $this->withoutMiddleware(ThrottleRequests::class));

function wadecPlatformApp(): void
{
    app(WhatsappWebhook::class)->storeApp(['app_id' => '1234567890123', 'config_id' => '55443322'], WADEC_APP_SECRET, 'token-verificacion-kipu', (string) platformUser()->getKey());
}

function wadecSigned(string $uri, array $payload, string $secret): TestResponse
{
    $raw = (string) json_encode($payload);

    return test()->call('POST', $uri, [], [], [], ['CONTENT_TYPE' => 'application/json', 'HTTP_ACCEPT' => 'application/json', 'HTTP_X_HUB_SIGNATURE_256' => ChannelWebhooks::sign($raw, $secret)], $raw);
}

function wadecChange(string $field, array $value, string $entryId = 'WABA'): array
{
    return ['object' => 'whatsapp_business_account', 'entry' => [['id' => $entryId, 'time' => now()->timestamp, 'changes' => [['field' => $field, 'value' => $value]]]]];
}

function wadecInbound(string $phoneNumberId, string $messageId, string $text): array
{
    return wadecChange('messages', [
        'messaging_product' => 'whatsapp',
        'metadata' => ['display_phone_number' => '51984000111', 'phone_number_id' => $phoneNumberId],
        'contacts' => [['profile' => ['name' => 'Lucía Paredes'], 'wa_id' => '51999777555']],
        'messages' => [['from' => '51999777555', 'id' => $messageId, 'timestamp' => (string) now()->timestamp, 'type' => 'text', 'text' => ['body' => $text]]],
    ]);
}

function wadecAccount(): object
{
    return withinTenant(tenantA(), fn () => DB::table('collab_channel_accounts')->where('channel', 'whatsapp')->orderBy('created_at')->first());
}

it('Conectar WhatsApp usa el registro guiado, guarda la WABA cifrada y la muestra enmascarada', function () {
    actingAsSeed('U01');

    $this->getJson('/api/v1/inbox/whatsapp/connection')->assertOk()->assertJsonPath('data.platform.ready', false);
    expect($this->postJson('/api/v1/inbox/whatsapp/connection', ['code' => 'codigo-de-meta-123']))->toBeApiError(422, 'WA-CONNECT-01');

    wadecPlatformApp();
    expect($this->postJson('/api/v1/inbox/whatsapp/connection', ['code' => 'rechazado-por-meta']))->toBeApiError(422, 'WA-CONNECT-02');

    $connected = $this->postJson('/api/v1/inbox/whatsapp/connection', ['code' => 'codigo-de-meta-123', 'waba_id' => '102938475610', 'phone_number_id' => '198765432100'])->assertOk()->json('data');
    $account = wadecAccount();

    expect($connected['connected'])->toBeTrue()
        ->and($connected['mode'])->toBe('plataforma')
        ->and($connected['waba_masked'])->toBe('••••••••5610')
        ->and($account->phone_number_id)->toBe('198765432100')
        ->and($account->display_phone)->toMatch('/^\+519[0-9]{8}$/')
        ->and(withinTenant(tenantA(), fn () => app(SiteWhatsapp::class)->connected()))->toMatchArray(['number' => $account->display_phone, 'source' => 'inbox'])
        ->and($account->waba_id_encrypted)->not->toContain('102938475610')
        ->and(Crypt::decryptString($account->waba_id_encrypted))->toBe('102938475610')
        ->and($account->waba_id_hash)->toBe(WhatsappAccounts::hash('102938475610'))
        ->and($account->credentials_encrypted)->not->toBeNull()
        ->and(withinTenant(tenantA(), fn () => DB::table('audit_events')->where(['entity' => 'Cuenta de canal', 'entity_id' => 'WhatsApp Business · Conexión', 'action' => 'conectar'])->exists()))->toBeTrue();

    $channel = collect($this->getJson('/api/v1/inbox/channel-accounts')->assertOk()->json('data'))->firstWhere('channel', 'whatsapp');
    expect($channel['waba_masked'])->toBe('••••••••5610')
        ->and($channel['guided'])->toBeTrue()
        ->and(json_encode($channel))->not->toContain('102938475610');

    $this->putJson('/api/v1/inbox/channel-accounts/whatsapp', ['first_response_sla_minutes' => 45])->assertOk()->assertJsonPath('data.status', 'activo');

    $this->deleteJson('/api/v1/inbox/whatsapp/connection')->assertOk()->assertJsonPath('data.connected', false);
    expect(wadecAccount()->status)->toBe('inactivo')
        ->and(wadecAccount()->credentials_encrypted)->toBeNull();
    expect($this->deleteJson('/api/v1/inbox/whatsapp/connection'))->toBeApiError(409, 'WA-CONNECT-03');

    actingAsSeed('U04');
    $forbidden = $this->postJson('/api/v1/inbox/whatsapp/connection', ['code' => 'codigo-de-meta-123']);
    expect($forbidden)->toBeApiError(403)
        ->and($forbidden->json('required_permissions'))->toContain('admin.settings.manage');
});

it('el URL único de Meta reparte mensajes a la bandeja, estados a la entrega y plantillas a la revisión', function () {
    Queue::fake();
    wadecPlatformApp();
    $accountId = (string) Str::uuid7();
    DB::connection('pgsql_owner')->table('collab_channel_accounts')->insert([
        'id' => $accountId,
        'tenant_id' => tenantA()->getKey(),
        'channel' => 'whatsapp',
        'name' => 'WhatsApp de pruebas',
        'phone_number_id' => '177788899900',
        'waba_id_encrypted' => Crypt::encryptString('556677889900'),
        'waba_id_hash' => WhatsappAccounts::hash('556677889900'),
        'connection_mode' => 'plataforma',
        'connected_at' => now(),
        'status' => 'activo',
    ]);
    $this->beforeApplicationDestroyed(fn () => DB::connection('pgsql_owner')->table('collab_channel_accounts')->where('id', $accountId)->delete());
    $uri = '/api/v1/integrations/whatsapp/webhook';
    $messageId = 'wamid.'.Str::random(20);

    expect(wadecSigned($uri, wadecInbound('177788899900', $messageId, 'Hola, ¿siguen los cupos?'), 'firma-de-otra-app-cualquiera'))->toBeApiError(401, 'WEBHOOK_SIGNATURE_INVALID');

    wadecSigned($uri, wadecInbound('177788899900', $messageId, 'Hola, ¿siguen los cupos?'), WADEC_APP_SECRET)->assertStatus(202)->assertJsonPath('data.received', 1);
    wadecSigned($uri, wadecInbound('177788899900', $messageId, 'Hola, ¿siguen los cupos?'), WADEC_APP_SECRET)->assertStatus(202)->assertJsonPath('data.duplicates', 1);
    wadecSigned($uri, wadecInbound('000000000001', 'wamid.x', 'Hola'), WADEC_APP_SECRET)->assertStatus(202)->assertJsonPath('data.ignored', 1);

    $event = withinTenant(tenantA(), fn () => DB::table('collab_inbound_events')->where('channel', 'whatsapp')->where('external_event_id', $messageId)->first());
    expect($event->payload)->not->toContain('siguen los cupos')
        ->and(MessageCipher::open(json_decode($event->payload, true)['message']['body']))->toBe('Hola, ¿siguen los cupos?');

    $pax = withinTenant(tenantA(), function (): object {
        $row = DB::table('notif_pax_messages')->whereIn('status', ['enviado'])->first(['id', 'code']) ?? DB::table('notif_pax_messages')->first(['id', 'code']);
        DB::table('notif_pax_messages')->where('id', $row->id)->update(['status' => 'enviado', 'provider_message_id' => 'wamid.pax-'.$row->code, 'delivered_at' => null]);

        return $row;
    });

    wadecSigned($uri, wadecChange('messages', [
        'metadata' => ['phone_number_id' => '177788899900'],
        'statuses' => [['id' => 'wamid.pax-'.$pax->code, 'status' => 'delivered', 'timestamp' => (string) now()->timestamp, 'recipient_id' => '51999777555']],
    ]), WADEC_APP_SECRET)->assertStatus(202)->assertJsonPath('data.statuses.actualizados', 1);

    expect(withinTenant(tenantA(), fn () => DB::table('notif_pax_messages')->where('id', $pax->id)->value('status')))->toBe('entregado');

    $template = withinTenant(tenantA(), function () use ($accountId): object {
        $id = (string) Str::uuid7();
        DB::table('collab_whatsapp_templates')->insert(['id' => $id, 'channel_account_id' => $accountId, 'name' => 'aviso_waba_pest', 'lang' => 'es', 'category' => 'utility', 'purpose' => 'otro', 'body' => 'Hola {{nombre}}', 'variables' => '{nombre}', 'meta_template_id' => 'tpl-waba-777', 'status' => 'enviada']);

        return DB::table('collab_whatsapp_templates')->where('id', $id)->first();
    });

    wadecSigned($uri, wadecChange('message_template_status_update', ['event' => 'APPROVED', 'message_template_id' => 'tpl-waba-777', 'message_template_name' => 'aviso_waba_pest', 'message_template_language' => 'es', 'reason' => 'NONE'], '556677889900'), WADEC_APP_SECRET)
        ->assertStatus(202)->assertJsonPath('data.templates.0.status', 'aprobada');
    wadecSigned($uri, wadecChange('message_template_status_update', ['event' => 'REJECTED', 'message_template_id' => 'tpl-waba-777'], '999999999999'), WADEC_APP_SECRET)
        ->assertStatus(202)->assertJsonPath('data.ignored', 1);

    expect(withinTenant(tenantA(), fn () => DB::table('collab_whatsapp_templates')->where('id', $template->id)->value('status')))->toBe('aprobada');
});

it('con su propia app de Meta la agencia recibe una URL propia, firmada con su secreto', function () {
    Queue::fake();
    actingAsSeed('U01');

    expect($this->putJson('/api/v1/inbox/whatsapp/connection/own-app', ['app_id' => '7654321098', 'phone_number_id' => '166655544433', 'access_token' => 'EAAG-token-permanente-de-la-agencia']))->toBeApiError(422, 'WA-OWN-01');
    expect($this->putJson('/api/v1/inbox/whatsapp/connection/own-app', ['app_id' => '7654321098', 'phone_number_id' => '166655544433', 'access_token' => 'rechazado-token-de-la-agencia', 'app_secret' => 'secreto-app-propia-agencia']))->toBeApiError(422, 'WA-OWN-02');

    $saved = $this->putJson('/api/v1/inbox/whatsapp/connection/own-app', [
        'app_id' => '7654321098',
        'app_secret' => 'secreto-app-propia-agencia',
        'access_token' => 'EAAG-token-permanente-de-la-agencia',
        'phone_number_id' => '166655544433',
    ])->assertOk()->json('data');
    $subdomain = tenantA()->subdomain;

    expect($saved['mode'])->toBe('propia')
        ->and($saved['own_app']['app_secret_set'])->toBeTrue()
        ->and($saved['own_app']['access_token_set'])->toBeTrue()
        ->and($saved['own_app']['webhook_url'])->toEndWith('/api/v1/integrations/whatsapp/webhook/'.$subdomain)
        ->and(json_encode($saved))->not->toContain('EAAG-token-permanente-de-la-agencia')
        ->and(json_encode($saved))->not->toContain('secreto-app-propia-agencia');

    $verify = fn (string $token) => $this->get("/api/v1/integrations/whatsapp/webhook/{$subdomain}?hub.mode=subscribe&hub.verify_token={$token}&hub.challenge=4455", ['Accept' => 'application/json']);
    expect($verify($saved['own_app']['verify_token'])->assertOk()->getContent())->toBe('4455');
    expect($verify('otro-token'))->toBeApiError(403, 'WEBHOOK_VERIFY_TOKEN_INVALID');

    $uri = "/api/v1/integrations/whatsapp/webhook/{$subdomain}";
    expect(wadecSigned($uri, wadecInbound('166655544433', 'wamid.propia-1', 'Hola desde la app propia'), WADEC_APP_SECRET))->toBeApiError(401, 'WEBHOOK_SIGNATURE_INVALID');
    $raw = (string) json_encode(wadecInbound('166655544433', 'wamid.propia-1', 'Hola desde la app propia'));
    $this->call('POST', "/api/v1/integrations/whatsapp/webhook/{$subdomain}", [], [], [], ['CONTENT_TYPE' => 'application/json', 'HTTP_ACCEPT' => 'application/json', 'HTTP_X_HUB_SIGNATURE_256' => ChannelWebhooks::sign($raw, 'secreto-app-propia-agencia')], $raw)
        ->assertStatus(202)->assertJsonPath('data.received', 1);
    wadecSigned($uri, wadecInbound('166655544433', 'wamid.propia-1', 'Hola desde la app propia'), 'secreto-app-propia-agencia')->assertStatus(202)->assertJsonPath('data.duplicates', 1);

    $event = withinTenant(tenantA(), fn () => DB::table('collab_inbound_events')->where('channel', 'whatsapp')->where('external_event_id', 'wamid.propia-1')->first());
    expect($event)->not->toBeNull()
        ->and(MessageCipher::open(json_decode($event->payload, true)['message']['body']))->toBe('Hola desde la app propia');

    expect(wadecSigned('/api/v1/integrations/whatsapp/webhook/agencia-inexistente', wadecInbound('166655544433', 'wamid.propia-2', 'Hola'), 'secreto-app-propia-agencia'))->toBeApiError(404);

    withinTenant(tenantA(), fn () => DB::table('collab_channel_accounts')->where('channel', 'whatsapp')->update(['status' => 'inactivo']));
    expect(wadecSigned($uri, wadecInbound('166655544433', 'wamid.propia-3', 'Hola'), 'secreto-app-propia-agencia'))->toBeApiError(404);
});
