<?php

use Illuminate\Support\Facades\DB;

function extReview(string $externalId): object
{
    return rowOf('channel_external_reviews', $externalId, column: 'external_id');
}

function extReviewAudit(string $externalId, string $action): bool
{
    return withinTenant(tenantA(), fn () => DB::table('audit_events')->where(['entity' => 'Reseña externa', 'entity_id' => $externalId, 'action' => $action])->exists());
}

it('responder una reseña externa la deja pendiente de publicar en la plataforma', function () {
    $user = actingAsSeed('U01');
    $id = extReview('XRV-0014')->id;

    $this->putJson("/api/v1/channels/external-reviews/{$id}/reply", ['text' => 'Gracias por tu comentario, lo compartimos con el equipo de guías.'])->assertOk()->assertJsonPath('data.id', $id);

    $review = extReview('XRV-0014');
    expect($review->response_status)->toBe('pendiente_publicar')
        ->and($review->reply)->toBe('Gracias por tu comentario, lo compartimos con el equipo de guías.')
        ->and($review->replied_by)->toBe($user->id)
        ->and(extReviewAudit('XRV-0014', 'responder'))->toBeTrue();
});

it('marcar publicada una respuesta guardada cierra el ciclo y no se marca dos veces', function () {
    actingAsSeed('U01');
    $id = extReview('XRV-0014')->id;
    $this->putJson("/api/v1/channels/external-reviews/{$id}/reply", ['text' => 'Gracias por elegirnos para tu viaje.'])->assertOk();

    $this->postJson("/api/v1/channels/external-reviews/{$id}/mark-published", [], critical())->assertOk();

    expect(extReview('XRV-0014')->response_status)->toBe('publicada')
        ->and(extReviewAudit('XRV-0014', 'marcar_publicada'))->toBeTrue()
        ->and($this->postJson("/api/v1/channels/external-reviews/{$id}/mark-published", [], critical()))->toBeApiError(409, 'REV-BR-04');
});

it('REV-BR-03: no se marca publicada una reseña sin respuesta guardada', function () {
    actingAsSeed('U01');
    $id = extReview('XRV-0013')->id;

    expect($this->postJson("/api/v1/channels/external-reviews/{$id}/mark-published", [], critical()))->toBeApiError(409, 'REV-BR-03')
        ->and(extReview('XRV-0013')->response_status)->toBe('sin_responder');
});

it('editar la respuesta de una reseña ya publicada la vuelve a dejar pendiente de publicar', function () {
    actingAsSeed('U01');
    $id = extReview('XRV-0009')->id;

    $this->putJson("/api/v1/channels/external-reviews/{$id}/reply", ['text' => 'Actualizamos la respuesta con la nueva política.'])->assertOk();

    expect(extReview('XRV-0009')->response_status)->toBe('pendiente_publicar');
});

it('REV-BR-02: una plataforma que no admite respuestas no se responde', function () {
    actingAsSeed('U01');
    withinTenant(tenantA(), fn () => DB::table('channel_external_reviews')->where('external_id', 'XRV-0012')->update(['response_status' => 'no_admite']));
    $id = extReview('XRV-0012')->id;

    expect($this->putJson("/api/v1/channels/external-reviews/{$id}/reply", ['text' => 'Gracias por tu comentario.']))->toBeApiError(409, 'REV-BR-02')
        ->and(extReview('XRV-0012')->reply)->toBeNull();
});

it('valida la respuesta, exige Idempotency-Key al marcar y una reseña inexistente responde 404', function () {
    actingAsSeed('U01');
    $id = extReview('XRV-0014')->id;

    $this->putJson("/api/v1/channels/external-reviews/{$id}/reply", ['text' => 'ok'])->assertStatus(422)->assertJsonValidationErrors(['text']);
    expect($this->postJson("/api/v1/channels/external-reviews/{$id}/mark-published"))->toBeApiError(422, 'IDEMPOTENCY_KEY_REQUIRED')
        ->and($this->putJson('/api/v1/channels/external-reviews/00000000-0000-7000-8000-000000000000/reply', ['text' => 'Gracias por tu comentario.']))->toBeApiError(404);
});

it('Finanzas y Operaciones no responden reseñas externas', function (string $user) {
    actingAsSeed($user);
    $id = extReview('XRV-0014')->id;

    expect($this->putJson("/api/v1/channels/external-reviews/{$id}/reply", ['text' => 'Gracias por tu comentario.']))->toBeApiError(403)
        ->and($this->postJson("/api/v1/channels/external-reviews/{$id}/mark-published", [], critical()))->toBeApiError(403);
})->with(['U07', 'U05']);
