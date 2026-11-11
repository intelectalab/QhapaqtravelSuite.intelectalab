<?php

use App\Domain\Channels\Support\OwnReviewSettings;
use App\Domain\Channels\Support\ReviewLinks;
use App\Domain\Integrations\Contracts\MessagingChannel;
use App\Domain\Integrations\Fake\FakeMessagingChannel;
use App\Jobs\SendDueReviewRequests;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;

beforeEach(function () {
    $this->withoutMiddleware(ThrottleRequests::class);
    Queue::fake();
});

function tokenRequest(string $status = 'enviada', ?string $expires = null): array
{
    return withinTenant(tenantA(), function () use ($status, $expires): array {
        $reservation = DB::table('booking_reservations')->where('code', 'RES-2026-000347')->first(['id', 'client_id']);
        $service = DB::table('booking_reservation_services')->where('reservation_id', $reservation->id)->orderBy('service_date')->value('id');
        DB::table('booking_reservation_services')->where('id', $service)->update(['product_id' => idOf('catalog_products', 'CUS-HUM-FD'), 'status' => 'completado']);
        DB::table('crm_own_reviews')->where('reservation_id', $reservation->id)->where('product_id', idOf('catalog_products', 'CUS-HUM-FD'))->update(['deleted_at' => now()]);
        $code = (string) (DB::table('crm_review_requests')->where('reservation_id', $reservation->id)->value('code') ?? 'SRV-9'.random_int(100, 999));
        DB::table('crm_review_requests')->updateOrInsert(['code' => $code], [
            'reservation_id' => $reservation->id, 'client_id' => $reservation->client_id, 'to_address' => 'viajero@correo.pe', 'channel' => 'email',
            'token_hash' => ReviewLinks::hash((string) tenantA()->getKey(), $code), 'scheduled_at' => now()->subDays(2), 'sent_at' => now()->subDay(), 'reminded_at' => null,
            'expires_at' => $expires ?? now()->addDays(29), 'status' => $status,
        ]);

        return ['code' => $code, 't' => ReviewLinks::token((string) tenantA()->getKey(), $code)];
    });
}

function tokenReview(array $link, array $extra = []): array
{
    return ['code' => $link['code'], 't' => $link['t'], 'product' => 'CUS-HUM-FD', 'stars' => 5, 'subratings' => ['guia' => 5], 'title' => 'Una laguna inolvidable', 'body' => 'El guía nos cuidó en toda la subida y el paisaje fue increíble.', 'consent_publish' => true, ...$extra];
}

it('el enlace de invitación abre el formulario, marca la solicitud como abierta y lista lo calificable', function () {
    $link = tokenRequest();

    $data = $this->getJson("/api/v1/public/reviews/by-token/{$link['code']}?t={$link['t']}", siteOf())->assertOk()->json('data');

    expect($data['trip']['code'])->toBe('RES-2026-000347')
        ->and(collect($data['items'])->firstWhere('product.code', 'CUS-HUM-FD')['eligible'])->toBeTrue()
        ->and($data['subratings'])->not->toBeEmpty()
        ->and(withinTenant(tenantA(), fn () => DB::table('crm_review_requests')->where('code', $link['code'])->value('status')))->toBe('abierta');

    $this->getJson("/api/v1/public/reviews/by-token/{$link['code']}?t=otro-token", siteOf())->assertNotFound();
});

it('POST public/reviews/by-token crea la reseña verificada desde el correo y el enlace es de un solo uso', function () {
    $link = tokenRequest();

    $data = $this->postJson('/api/v1/public/reviews/by-token', tokenReview($link), siteOf(extra: critical()))->assertCreated()->json('data');
    $review = withinTenant(tenantA(), fn () => DB::table('crm_own_reviews')->where('code', $data['code'])->first());

    expect($review->source)->toBe('email')
        ->and((bool) $review->verified)->toBeTrue()
        ->and($review->request_id)->not->toBeNull()
        ->and($review->created_by)->toBeNull()
        ->and(withinTenant(tenantA(), fn () => DB::table('crm_review_requests')->where('code', $link['code'])->value('status')))->toBe('respondida');

    expect($this->postJson('/api/v1/public/reviews/by-token', tokenReview($link, ['title' => 'Otra vez']), siteOf(extra: critical())))->toBeApiError(409, 'RVW-03');
});

it('un enlace vencido responde 410 y una validación incompleta responde 422', function () {
    $expired = tokenRequest('enviada', now()->subMinute()->toDateTimeString());
    expect($this->getJson("/api/v1/public/reviews/by-token/{$expired['code']}?t={$expired['t']}", siteOf()))->toBeApiError(410, 'REVIEW_LINK_EXPIRED');

    $link = tokenRequest();
    $this->postJson('/api/v1/public/reviews/by-token', tokenReview($link, ['body' => 'corto', 'stars' => 9]), siteOf(extra: critical()))->assertStatus(422)->assertJsonValidationErrors(['body', 'stars']);
});

it('RVW-09: SendDueReviewRequests envía las programadas con el enlace, recuerda a los 5 días (seed del kit) y vence las caducadas', function () {
    expect(OwnReviewSettings::DEFAULTS['invite']['reminder_days'])->toBe(5);
    $fake = new FakeMessagingChannel;
    app()->instance(MessagingChannel::class, $fake);
    $link = tokenRequest('programada');
    withinTenant(tenantA(), fn () => DB::table('crm_review_requests')->where('code', $link['code'])->update(['sent_at' => null, 'scheduled_at' => now()->subMinute(), 'token_hash' => str_repeat('0', 64)]));
    withinTenant(tenantA(), fn () => DB::table('sys_settings')->where('section', OwnReviewSettings::SECTION)->delete());
    $run = fn () => withinTenant(tenantA(), fn () => (new SendDueReviewRequests)->handle());

    $run();
    $row = withinTenant(tenantA(), fn () => DB::table('crm_review_requests')->where('code', $link['code'])->first());
    expect($row->status)->toBe('enviada')
        ->and($row->token_hash)->toBe(hash('sha256', $link['t']))
        ->and(collect($fake->sent)->contains(fn ($message) => str_contains((string) $message->body, "/resena/{$link['code']}?t={$link['t']}")))->toBeTrue();

    withinTenant(tenantA(), fn () => DB::table('crm_review_requests')->where('code', $link['code'])->update(['sent_at' => now()->subDays(4)]));
    $run();
    expect(withinTenant(tenantA(), fn () => DB::table('crm_review_requests')->where('code', $link['code'])->value('reminded_at')))->toBeNull();

    withinTenant(tenantA(), fn () => DB::table('crm_review_requests')->where('code', $link['code'])->update(['sent_at' => now()->subDays(5)->subMinute()]));
    $run();
    expect(withinTenant(tenantA(), fn () => DB::table('crm_review_requests')->where('code', $link['code'])->value('reminded_at')))->not->toBeNull();

    withinTenant(tenantA(), fn () => DB::table('crm_review_requests')->where('code', $link['code'])->update(['expires_at' => now()->subMinute()]));
    $run();
    expect(withinTenant(tenantA(), fn () => DB::table('crm_review_requests')->where('code', $link['code'])->value('status')))->toBe('vencida');
});
