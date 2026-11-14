<?php

use App\Domain\Channels\Support\ReviewLinks;
use App\Domain\Channels\Support\ReviewRequestSender;
use App\Domain\Integrations\Contracts\MessagingChannel;
use App\Domain\Integrations\Fake\FakeMessagingChannel;
use App\Domain\Shared\Time\BusinessHours;
use Carbon\CarbonImmutable;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;

beforeEach(function () {
    $this->withoutMiddleware(ThrottleRequests::class);
    Queue::fake();
});

function resenaRequest(): array
{
    return withinTenant(tenantA(), function (): array {
        $reservation = DB::table('booking_reservations')->where('code', 'RES-2026-000346')->first(['id', 'client_id']);
        $code = (string) (DB::table('crm_review_requests')->where('reservation_id', $reservation->id)->value('code') ?? 'SRV-8'.random_int(100, 999));
        DB::table('crm_review_requests')->updateOrInsert(['code' => $code], [
            'reservation_id' => $reservation->id, 'client_id' => $reservation->client_id, 'to_address' => 'viajero@correo.pe', 'channel' => 'email',
            'token_hash' => ReviewLinks::hash((string) tenantA()->getKey(), $code), 'scheduled_at' => now()->subDay(), 'sent_at' => now()->subDay(), 'expires_at' => now()->addDays(20), 'status' => 'enviada',
        ]);

        return ['code' => $code, 't' => ReviewLinks::token((string) tenantA()->getKey(), $code), 'row' => DB::table('crm_review_requests')->where('code', $code)->first()];
    });
}

function resenaAt(string $moment): void
{
    $now = CarbonImmutable::parse($moment, 'America/Lima');
    Carbon::setTestNow($now);
    CarbonImmutable::setTestNow($now);
}

it('G7-27: «Probar» valida formato y dominio sin internet; se guardan los enlaces con auditoría y se rechaza un dominio ajeno', function () {
    actingAsSeed('U01');

    $this->postJson('/api/v1/channels/review-links/test', ['platform' => 'google', 'url' => 'https://g.page/r/andes-horizonte/review'])->assertOk()->assertJsonPath('data.ok', true);
    $this->postJson('/api/v1/channels/review-links/test', ['platform' => 'tripadvisor', 'url' => 'https://www.tripadvisor.com.pe/UserReviewEdit-g294314-d1234567'])->assertOk()->assertJsonPath('data.ok', true);
    $this->postJson('/api/v1/channels/review-links/test', ['platform' => 'google', 'url' => 'https://www.tripadvisor.com/Review'])->assertOk()->assertJsonPath('data.ok', false);
    $this->postJson('/api/v1/channels/review-links/test', ['platform' => 'tripadvisor', 'url' => 'http://www.tripadvisor.com/x'])->assertOk()->assertJsonPath('data.ok', false);

    $this->putJson('/api/v1/channels/review-links', ['google' => 'https://evil.example.com/review'])->assertStatus(422)->assertJsonValidationErrors(['google']);
    $saved = $this->putJson('/api/v1/channels/review-links', ['google' => 'https://g.page/r/andes-horizonte/review'])->assertOk()->json('data.platforms');

    expect(collect($saved)->firstWhere('platform', 'google')['url'])->toBe('https://g.page/r/andes-horizonte/review')
        ->and(collect($saved)->firstWhere('platform', 'tripadvisor')['url'])->toBeNull()
        ->and((bool) withinTenant(tenantA(), fn () => DB::table('audit_events')->where('entity', 'Reseña externa')->where('entity_id', 'enlace.google')->where('action', 'actualizar_enlace')->exists()))->toBeTrue();

    actingAsSeed('U05');
    expect($this->putJson('/api/v1/channels/review-links', ['google' => null]))->toBeApiError(403);
});

it('G7-27: la invitación lleva la reseña propia y debajo solo las plataformas cargadas; el clic se registra con la redirección propia', function () {
    actingAsSeed('U01');
    $this->putJson('/api/v1/channels/review-links', ['tripadvisor' => 'https://www.tripadvisor.com.pe/UserReviewEdit-g294314-d1234567'])->assertOk();
    $link = resenaRequest();
    $fake = new FakeMessagingChannel;
    app()->instance(MessagingChannel::class, $fake);

    withinTenant(tenantA(), fn () => app(ReviewRequestSender::class)->send($link['row']));
    $body = (string) collect($fake->sent)->last()->body;

    expect($body)->toContain("/resena/{$link['code']}?t=")
        ->and($body)->toContain('Opina también en TripAdvisor: ')
        ->and($body)->toContain("/resena/{$link['code']}/tripadvisor?t={$link['t']}")
        ->and($body)->not->toContain('Opina también en Google');

    $url = $this->postJson("/api/v1/public/reviews/by-token/{$link['code']}/external-click", ['target' => 'tripadvisor', 't' => $link['t']], siteOf())->assertOk()->json('data.url');
    expect($url)->toBe('https://www.tripadvisor.com.pe/UserReviewEdit-g294314-d1234567');
    $this->postJson("/api/v1/public/reviews/by-token/{$link['code']}/external-click", ['target' => 'google', 't' => $link['t']], siteOf())->assertNotFound();
    $this->postJson("/api/v1/public/reviews/by-token/{$link['code']}/external-click", ['target' => 'tripadvisor', 't' => 'otro'], siteOf())->assertNotFound();

    $data = $this->getJson('/api/v1/channels/review-invitations')->assertOk()->json('data');
    $row = collect($data['rows'])->firstWhere('reservation.code', 'RES-2026-000346');
    expect($row['invitation']['code'])->toBe($link['code'])
        ->and($row['invited'])->toBe(1)
        ->and($row['clicks']['tripadvisor'])->toBe(1)
        ->and($row['clicks']['google'])->toBe(0)
        ->and(collect($data['platforms'])->firstWhere('platform', 'tripadvisor')['loaded'])->toBeTrue();
});

it('G7-23: select_date se acepta sin datos personales y arma el paso «Eligieron fecha» y la demanda sin cupo', function () {
    lockWebAnalytics();
    $slug = (string) withinTenant(tenantA(), fn () => DB::table('catalog_products')->where('code', 'CUS-HUM-FD')->value('slug'));
    $body = ['consent' => true, 'session_id' => 'sitio-select-01', 'events' => [
        ['event' => 'select_date', 'params' => ['item_id' => $slug, 'date' => '2026-12-24', 'adults' => 2, 'children' => 1, 'available' => false, 'email' => 'ana@correo.pe', 'name' => 'Ana']],
        ['event' => 'select_date', 'params' => ['item_id' => $slug, 'date' => '2026-12-26', 'adults' => 2, 'available' => true]],
    ]];

    $this->postJson('/api/v1/public/analytics/events', [...$body, 'consent' => false], siteOf())->assertStatus(422);
    $this->postJson('/api/v1/public/analytics/events', $body, siteOf())->assertStatus(202)->assertJsonPath('data.recorded', 2);

    $stored = withinTenant(tenantA(), fn () => DB::table('channel_web_events')->where('session_id', 'sitio-select-01')->where('params->date', '2026-12-24')->value('params'));
    expect(json_decode((string) $stored, true))->toEqualCanonicalizing(['item_id' => $slug, 'date' => '2026-12-24', 'adults' => 2, 'children' => 1, 'available' => false]);

    actingAsSeed('U01');
    $data = $this->getJson('/api/v1/channels/ecommerce')->assertOk()->json('data');
    $funnel = collect($data['funnel']);
    $unmet = collect($data['unmet_demand']['items'])->first(fn (array $item): bool => $item['date'] === '2026-12-24' && ($item['product']['slug'] ?? null) === $slug);

    expect($funnel->pluck('id')->all())->toBe(['sessions', 'views', 'dates', 'orders', 'paid'])
        ->and($funnel->firstWhere('id', 'dates')['value'])->toBeGreaterThanOrEqual(1)
        ->and($unmet['travelers'])->toBe(3)
        ->and($unmet['product']['name'])->not->toBe($slug);
});

it('G8-11: los plazos de chat web, formularios y portal se editan en la agencia y corren solo en horario de atención', function () {
    actingAsSeed('U01');
    $data = $this->getJson('/api/v1/inbox/response-times')->assertOk()->json('data');
    expect(collect($data['channels'])->pluck('minutes', 'channel')->all())->toBe(['webchat' => 15, 'form' => 120, 'portal' => 240])
        ->and($data['options'])->toBe([15, 30, 60, 120, 240, 480]);

    $this->putJson('/api/v1/inbox/response-times', ['webchat' => 45])->assertStatus(422);
    $this->putJson('/api/v1/inbox/response-times', ['webchat' => 60, 'form' => 30])->assertOk()->assertJsonPath('data.channels.0.minutes', 60);
    expect((bool) withinTenant(tenantA(), fn () => DB::table('audit_events')->where('entity_id', 'notifications.inbox_sla.webchat')->exists()))->toBeTrue();

    resenaAt('2026-09-29 18:30');
    $chat = $this->postJson('/api/v1/public/chat/sessions', ['name' => 'Ana Torres', 'email' => 'ana.plazo@viajes.pe', 'message' => '¿Tienen cupos en diciembre?', 'consent' => true], siteOf())->assertCreated()->json('data');
    $due = withinTenant(tenantA(), fn () => DB::table('collab_conversations')->where('contact_email', 'ana.plazo@viajes.pe')->where('channel', 'webchat')->value('first_response_due_at'));
    $expected = withinTenant(tenantA(), fn () => app(BusinessHours::class)->addMinutes(CarbonImmutable::now(), 60));

    expect($chat)->not->toBeEmpty()
        ->and(CarbonImmutable::parse((string) $due)->equalTo($expected))->toBeTrue()
        ->and($expected->setTimezone('America/Lima')->format('Y-m-d H:i'))->toBe('2026-09-30 08:30');

    actingAsSeed('U03');
    expect($this->putJson('/api/v1/inbox/response-times', ['portal' => 60]))->toBeApiError(403);
});

it('G8-12: una nota interna más reciente no quita «sin responder» ni el plazo del último mensaje del cliente', function () {
    resenaAt('2026-09-29 10:00');
    $this->postJson('/api/v1/public/chat/sessions', ['name' => 'Luis Pérez', 'email' => 'luis.nota@viajes.pe', 'message' => 'Hola, quiero cotizar', 'consent' => true], siteOf())->assertCreated();
    $code = withinTenant(tenantA(), fn () => DB::table('collab_conversations')->where('contact_email', 'luis.nota@viajes.pe')->value('code'));

    actingAsSeed('U01');
    $this->postJson("/api/v1/inbox/conversations/{$code}/messages", ['body' => 'Revisar disponibilidad antes de responder', 'internal' => true], critical())->assertSuccessful();

    $item = collect($this->getJson('/api/v1/inbox/conversations')->assertOk()->json('data.items'))->firstWhere('code', $code);
    expect($item['preview_note'])->toBeTrue()
        ->and($item['awaiting_reply'])->toBeTrue()
        ->and($item['sla']['responded_at'])->toBeNull()
        ->and($item['sla']['state'])->not->toBe('met');

    $this->postJson("/api/v1/inbox/conversations/{$code}/messages", ['body' => 'Hola Luis, te escribo con opciones.'], critical())->assertSuccessful();
    $item = collect($this->getJson('/api/v1/inbox/conversations')->json('data.items'))->firstWhere('code', $code);
    expect($item['awaiting_reply'])->toBeFalse()->and($item['sla']['state'])->toBe('met');
});
