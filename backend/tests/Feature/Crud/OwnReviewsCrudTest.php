<?php

use Illuminate\Support\Facades\DB;

function ownReviewLock(string $code): int
{
    return (int) rowOf('crm_own_reviews', $code)->lock_version;
}

function ownReviewOnSite(string $code): bool
{
    $review = rowOf('crm_own_reviews', $code);
    $slug = withinTenant(tenantA(), fn () => DB::table('catalog_products')->where('id', $review->product_id)->value('slug'));

    return collect(test()->getJson("/api/v1/public/products/{$slug}", siteOf())->assertOk()->json('data.reviews.items'))->where('verified', true)->pluck('title')->contains($review->title);
}

it('publicar una reseña pendiente con consentimiento la deja publicada, registrada en su bitácora y auditada', function () {
    $user = actingAsSeed('U01');

    $this->postJson('/api/v1/reviews/RVO-0003/publish', [], critical(ownReviewLock('RVO-0003')))->assertOk()->assertJsonPath('data.code', 'RVO-0003');

    $review = rowOf('crm_own_reviews', 'RVO-0003');
    expect($review->status)->toBe('publicada')
        ->and($review->published_at)->not->toBeNull()
        ->and($review->moderated_by)->toBe($user->id)
        ->and($review->moderation_reason)->toBeNull()
        ->and(withinTenant(tenantA(), fn () => DB::table('crm_own_review_log')->where('review_id', $review->id)->where('action', 'publicar')->exists()))->toBeTrue()
        ->and(withinTenant(tenantA(), fn () => DB::table('audit_events')->where(['entity' => 'Reseña propia', 'entity_id' => 'RVO-0003', 'action' => 'publicar', 'before_value' => 'pendiente'])->exists()))->toBeTrue();
});

it('una reseña oculta vuelve al sitio público al publicarla de nuevo', function () {
    actingAsSeed('U01');
    expect(ownReviewOnSite('RVO-0001'))->toBeTrue();

    $this->postJson('/api/v1/reviews/RVO-0001/hide', ['reason' => 'Revisión de datos personales'], critical(ownReviewLock('RVO-0001')))->assertOk();
    expect(ownReviewOnSite('RVO-0001'))->toBeFalse();

    $this->postJson('/api/v1/reviews/RVO-0001/publish', [], critical(ownReviewLock('RVO-0001')))->assertOk();
    expect(ownReviewOnSite('RVO-0001'))->toBeTrue()
        ->and(rowOf('crm_own_reviews', 'RVO-0001')->moderation_reason)->toBeNull();
});

it('una reseña ya publicada no se vuelve a publicar', function () {
    actingAsSeed('U01');

    expect($this->postJson('/api/v1/reviews/RVO-0002/publish', [], critical(ownReviewLock('RVO-0002'))))->toBeApiError(409, 'RVW-00');
});

it('RVW-05: sin consentimiento del viajero la reseña no se publica', function () {
    actingAsSeed('U01');
    withinTenant(tenantA(), fn () => DB::table('crm_own_reviews')->where('code', 'RVO-0003')->update(['consent_publish' => false]));

    expect($this->postJson('/api/v1/reviews/RVO-0003/publish', [], critical(ownReviewLock('RVO-0003'))))->toBeApiError(422, 'RVW-05')
        ->and(rowOf('crm_own_reviews', 'RVO-0003')->status)->toBe('pendiente');
});

it('publicar exige la versión vigente de la reseña', function () {
    actingAsSeed('U01');

    expect($this->postJson('/api/v1/reviews/RVO-0003/publish', [], critical(ownReviewLock('RVO-0003') + 2)))->toBeApiError(409, 'STALE_VERSION')
        ->and(rowOf('crm_own_reviews', 'RVO-0003')->status)->toBe('pendiente');
});

it('RVW-11: Ventas no modera reseñas', function () {
    actingAsSeed('U03');

    expect($this->postJson('/api/v1/reviews/RVO-0003/publish', [], critical(ownReviewLock('RVO-0003'))))->toBeApiError(403)
        ->and(rowOf('crm_own_reviews', 'RVO-0003')->status)->toBe('pendiente');
});
