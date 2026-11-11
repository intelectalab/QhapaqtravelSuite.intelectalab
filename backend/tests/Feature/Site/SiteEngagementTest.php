<?php

use App\Jobs\SendPlainMail;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;

beforeEach(function () {
    $this->withoutMiddleware(ThrottleRequests::class);
    Queue::fake();
});

it('SIT-BR-24: el chat web abre una conversación sin asignar con respuesta automática y nunca muestra notas internas', function () {
    $this->postJson('/api/v1/public/chat/sessions', ['name' => 'Ana', 'message' => 'Hola', 'consent' => true], siteOf())->assertStatus(422)->assertJsonValidationErrors(['email', 'whatsapp']);

    $chat = $this->postJson('/api/v1/public/chat/sessions', ['name' => 'Ana Torres', 'email' => 'ana.chat@viajes.pe', 'message' => '¿Tienen cupos para Machu Picchu en diciembre?', 'consent' => true], siteOf())->assertCreated()->json('data');
    $conversation = withinTenant(tenantA(), fn () => DB::table('collab_conversations')->where('code', $chat['session'])->first(['id', 'channel', 'assignee_id', 'status']));

    expect($conversation->channel)->toBe('webchat')->and($conversation->assignee_id)->toBeNull()
        ->and(collect($chat['messages'])->pluck('from')->all())->toBe(['contacto', 'sistema']);

    withinTenant(tenantA(), fn () => DB::table('collab_messages')->insert(['conversation_id' => $conversation->id, 'channel' => 'webchat', 'direction' => 'internal', 'body' => 'Nota interna: cliente VIP', 'sent_at' => now()]));
    $session = $chat['session'];
    $reply = $this->postJson("/api/v1/public/chat/sessions/{$session}/messages", ['body' => 'Somos dos adultos.'], siteOf(extra: ['X-Chat-Token' => $chat['token']]))->assertOk()->json('data.messages');

    expect(collect($reply)->pluck('body'))->not->toContain('Nota interna: cliente VIP')->and(collect($reply)->last()['body'])->toBe('Somos dos adultos.');
    $this->postJson("/api/v1/public/chat/sessions/{$session}/messages", ['body' => 'Hola'], siteOf(extra: ['X-Chat-Token' => 'falso']))->assertNotFound();
});

it('§8.4: los eventos de analítica solo se registran con consentimiento y con nombres GA4 válidos', function () {
    $before = (int) withinTenant(tenantA(), fn () => DB::table('channel_web_events')->count());
    $body = ['session_id' => 'sess_test_001', 'currency' => 'USD', 'events' => [['event' => 'page_view', 'params' => ['path' => '/tours']], ['event' => 'view_item', 'params' => ['item_id' => 'CUS-HUM-FD']]]];

    $this->postJson('/api/v1/public/analytics/events', $body, siteOf())->assertStatus(422)->assertJsonValidationErrors(['consent']);
    $this->postJson('/api/v1/public/analytics/events', [...$body, 'consent' => true, 'events' => [['event' => 'hackear']]], siteOf())->assertStatus(422);
    $this->postJson('/api/v1/public/analytics/events', [...$body, 'consent' => true], siteOf())->assertStatus(202)->assertJsonPath('data.recorded', 2);

    expect((int) withinTenant(tenantA(), fn () => DB::table('channel_web_events')->count()))->toBe($before + 2);
});

it('SIT-BR-25: la suscripción envía el correo de doble opt-in; el enlace confirma y el de baja revoca el consentimiento', function () {
    $this->postJson('/api/v1/public/newsletter', ['email' => 'boletin.prueba@viajes.pe', 'consent' => true], siteOf(extra: critical()))->assertCreated();

    $token = null;
    Queue::assertPushed(SendPlainMail::class, function (SendPlainMail $mail) use (&$token): bool {
        if (preg_match('#confirmar\?token=([A-Za-z0-9-]+\.[a-f0-9]{64})#', $mail->body, $match)) {
            $token = $match[1];
        }

        return true;
    });
    expect($token)->not->toBeNull();

    $this->getJson("/api/v1/public/newsletter/confirm/{$token}", siteOf())->assertOk()->assertJsonPath('data.status', 'confirmado');
    $this->getJson('/api/v1/public/newsletter/confirm/SUB-0001.'.str_repeat('a', 64), siteOf())->assertNotFound();

    $this->postJson('/api/v1/public/newsletter/unsubscribe', ['token' => $token], siteOf(extra: critical()))->assertOk()->assertJsonPath('data.status', 'baja');
    $subscriber = withinTenant(tenantA(), fn () => DB::table('mkt_contacts_subscribers')->where('email', 'boletin.prueba@viajes.pe')->value('id'));
    expect(withinTenant(tenantA(), fn () => DB::table('mkt_consents')->where('subject_id', $subscriber)->value('status')))->toBe('revocado');
    expect($this->getJson("/api/v1/public/newsletter/confirm/{$token}", siteOf()))->toBeApiError(409, 'SIT-BR-25');
});
