<?php

use App\Domain\Booking\Rules\RuleResolver;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;

require_once __DIR__.'/PlataformaHelpers.php';

beforeEach(fn () => Queue::fake());

function p3Review(string $provider, int $maxRating = 5, int $minRating = 1): object
{
    return withinTenant(tenantA(), fn () => DB::table('channel_external_reviews as e')->join('integration_review_sources as s', 's.id', '=', 'e.source_id')
        ->where('s.provider', $provider)->whereBetween('e.rating', [$minRating, $maxRating])->where('e.response_status', 'sin_responder')->whereNull('e.conversation_id')
        ->orderBy('e.rating')->first(['e.*']));
}

function p3InviteRule(bool $on): void
{
    withinTenant(tenantA(), function () use ($on) {
        DB::table('sys_booking_rules')->where('code', 'R-REVIEW-INVITE')->update(['enabled' => $on]);
        RuleResolver::invalidate((string) tenantA()->getKey());
    });
}

function p3FinishedTrip(string $code): void
{
    withinTenant(tenantA(), function () use ($code) {
        $id = DB::table('booking_reservations')->where('code', $code)->value('id');
        DB::table('crm_review_requests')->where('reservation_id', $id)->delete();
        DB::table('booking_reservations')->where('id', $id)->update(['travel_from' => '2026-09-10', 'travel_to' => '2026-09-15']);
    });
}

it('conecta una plataforma sin devolver la credencial, la sincroniza con el adaptador y la desconecta', function () {
    actingAsSeed('U01');
    $sources = $this->getJson('/api/v1/integrations/review-sources')->assertOk()->json('data');
    expect($sources)->toHaveCount(6)->and(json_encode($sources))->not->toContain('vault://');

    $this->postJson('/api/v1/integrations/review-sources', ['provider' => 'trustpilot', 'account' => 'andes-travel.pe', 'credential' => 'tp_live_123456789'], critical())->assertUnprocessable()->assertJsonValidationErrors('contract_ack');

    $connected = $this->postJson('/api/v1/integrations/review-sources', ['provider' => 'trustpilot', 'account' => 'andes-travel.pe', 'credential' => 'tp_live_123456789', 'contract_ack' => true], critical())->assertCreated()->json('data');
    expect($connected['status'])->toBe('conectado')->and($connected['key_last4'])->toBe('6789')->and($connected['can_reply'])->toBeTrue()->and(json_encode($connected))->not->toContain('tp_live');
    expect($this->postJson('/api/v1/integrations/review-sources', ['provider' => 'trustpilot', 'account' => 'otra', 'credential' => 'tp_live_999999999', 'contract_ack' => true], critical()))->toBeApiError(409, 'RV-03');

    $first = $this->postJson('/api/v1/integrations/review-sources/trustpilot/sync')->assertOk()->json('data');
    $second = $this->postJson('/api/v1/integrations/review-sources/trustpilot/sync')->assertOk()->json('data');
    expect($first['created'])->toBe(4)->and($second['created'])->toBe(0)->and($second['source']['inbox'])->toBe(4)->and($second['source']['last_sync_at'])->not->toBeNull();

    $this->deleteJson('/api/v1/integrations/review-sources/trustpilot', [], critical())->assertNoContent();
    $row = p3Row('integration_review_sources', ['provider' => 'trustpilot']);
    expect($row->status)->toBe('no_conectado')->and($row->secret_ref)->toBeNull()->and($row->secret_last4)->toBeNull();
    expect($this->postJson('/api/v1/integrations/review-sources/trustpilot/sync'))->toBeApiError(409, 'RV-03');
    expect(p3Audited(['entity' => 'Integración de reseñas', 'entity_id' => 'trustpilot', 'action' => 'sincronizar']))->toBeTrue();
    $this->deleteJson('/api/v1/integrations/review-sources/myspace', [], critical())->assertNotFound();

    actingAsSeed('U03');
    expect($this->getJson('/api/v1/integrations/review-sources'))->toBeApiError(403);
});

it('responde una reseña: se publica por API donde se puede y queda por publicar donde no', function () {
    actingAsSeed('U01');
    $google = p3Review('google');
    $published = $this->postJson("/api/v1/channels/external-reviews/{$google->id}/reply", ['text' => 'Gracias por contarnos su experiencia, ya revisamos el caso.'], critical())->assertOk()->json('data');
    expect($published['status'])->toBe('publicada')->and($published['published_by_api'])->toBeTrue();

    $trip = p3Review('tripadvisor');
    $pending = $this->postJson("/api/v1/channels/external-reviews/{$trip->id}/reply", ['text' => 'Muchas gracias por elegirnos para su viaje.'], critical())->assertOk()->json('data');
    expect($pending['status'])->toBe('pendiente_publicar')->and($pending['published_by_api'])->toBeFalse();
    $this->postJson("/api/v1/channels/external-reviews/{$trip->id}/reply", ['text' => 'Hola'], critical())->assertUnprocessable();
});

it('deriva a postventa una reseña crítica una sola vez y abre la conversación', function () {
    actingAsSeed('U03');
    $critical = p3Review('google', 3);
    $escalated = $this->postJson("/api/v1/channels/external-reviews/{$critical->id}/escalate", ['note' => 'Revisar el traslado del aeropuerto'], critical())->assertCreated()->json('data');

    expect($escalated['conversation'])->toStartWith('CNV-')
        ->and(p3Row('collab_conversations', ['code' => $escalated['conversation']])->priority)->not->toBeNull()
        ->and(p3Row('channel_external_reviews', ['id' => $critical->id])->conversation_id)->not->toBeNull();
    expect($this->postJson("/api/v1/channels/external-reviews/{$critical->id}/escalate", [], critical()))->toBeApiError(409, 'REV-BR-06');

    $good = withinTenant(tenantA(), fn () => DB::table('channel_external_reviews')->where('rating', '>=', 4)->whereNull('conversation_id')->value('id'));
    expect($this->postJson("/api/v1/channels/external-reviews/{$good}/escalate", [], critical()))->toBeApiError(422, 'REV-BR-05');
    expect(p3Audited(['entity' => 'Reseña externa', 'action' => 'derivar_postventa']))->toBeTrue();
});

it('invita a reseñar desde una reserva terminada solo con la regla activa', function () {
    actingAsSeed('U01');
    p3FinishedTrip('RES-2026-000348');
    p3InviteRule(false);
    expect($this->postJson('/api/v1/reservations/RES-2026-000348/review-invitations', [], critical()))->toBeApiError(422, 'RULE_INACTIVE');

    p3InviteRule(true);
    $invited = $this->postJson('/api/v1/reservations/RES-2026-000348/review-invitations', ['channel' => 'email'], critical())->assertCreated()->json('data');
    expect($invited['request'])->toStartWith('SRV-')->and($invited['status'])->toBe('enviada')->and($invited['channel'])->toBe('email');
    expect($this->postJson('/api/v1/reservations/RES-2026-000348/review-invitations', [], critical()))->toBeApiError(409, 'REV-BR-09');

    $future = (string) withinTenant(tenantA(), fn () => DB::table('booking_reservations')->whereNull('deleted_at')->whereNotIn('status', ['cancelada', 'borrador'])->where('travel_to', '>', '2026-10-15')->value('code'));
    expect($this->postJson("/api/v1/reservations/{$future}/review-invitations", [], critical()))->toBeApiError(422, 'REV-BR-07');
    $this->postJson('/api/v1/reservations/RES-0000-000000/review-invitations', [], critical())->assertNotFound();
});
