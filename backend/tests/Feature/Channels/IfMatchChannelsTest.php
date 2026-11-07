<?php

use Illuminate\Http\Request;

function channelLockVersion(string $table, string $code): int
{
    return (int) rowOf($table, $code)->lock_version;
}

it('exige la versión del registro en reglas, agencias B2B, CMS y reseñas propias', function (string $route, string $method, string $path, array $body) {
    actingAsSeed('U01');

    expect(app('router')->getRoutes()->match(Request::create("/api/v1/{$path}", $method))->getName())->toBe($route);
    expect($this->json($method, "/api/v1/{$path}", $body, critical()))->toBeApiError(428, 'IF_MATCH_REQUIRED');
})->with([
    ['admin.rules.update', 'PATCH', 'admin/booking-rules/R-LODGING', ['enabled' => true]],
    ['admin.rules.destroy', 'DELETE', 'admin/booking-rules/R-LODGING', []],
    ['channels.b2b.block', 'POST', 'channels/b2b/agencies/AGB-01/block', ['reason' => 'Pagos vencidos']],
    ['channels.b2b.unblock', 'POST', 'channels/b2b/agencies/AGB-03/unblock', []],
    ['channels.cms.update', 'PATCH', 'cms/contents/CMS-04', ['title' => 'Título de prueba']],
    ['channels.cms.submit', 'POST', 'cms/contents/CMS-04/submit', []],
    ['channels.cms.return', 'POST', 'cms/contents/CMS-03/return', ['reason' => 'Faltan datos']],
    ['channels.cms.approve', 'POST', 'cms/contents/CMS-03/approve', []],
    ['channels.cms.publish', 'POST', 'cms/contents/CMS-06/publish', []],
    ['channels.cms.unpublish', 'POST', 'cms/contents/CMS-01/unpublish', ['reason' => 'Temporada cerrada']],
    ['channels.reviews.publish', 'POST', 'reviews/RVO-0003/publish', []],
    ['channels.reviews.reject', 'POST', 'reviews/RVO-0003/reject', ['reason' => 'Lenguaje ofensivo']],
    ['channels.reviews.hide', 'POST', 'reviews/RVO-0001/hide', ['reason' => 'Datos personales']],
    ['channels.reviews.reply', 'PUT', 'reviews/RVO-0001/reply', ['text' => 'Gracias por viajar con nosotros.']],
]);

it('una regla de reserva se cambia con su versión y rechaza una versión vieja', function () {
    actingAsSeed('U01');
    $before = rowOf('sys_booking_rules', 'R-LODGING');

    $this->patchJson('/api/v1/admin/booking-rules/R-LODGING', ['enabled' => ! $before->enabled], critical((int) $before->lock_version))->assertOk();
    expect(channelLockVersion('sys_booking_rules', 'R-LODGING'))->toBe((int) $before->lock_version + 1);

    expect($this->patchJson('/api/v1/admin/booking-rules/R-LODGING', ['enabled' => (bool) $before->enabled], critical((int) $before->lock_version)))->toBeApiError(409, 'STALE_VERSION');
    expect((bool) rowOf('sys_booking_rules', 'R-LODGING')->enabled)->toBe(! $before->enabled);
});

it('una agencia B2B se bloquea con su versión y rechaza una versión vieja', function () {
    actingAsSeed('U01');
    $version = channelLockVersion('channel_b2b_agencies', 'AGB-01');

    $this->postJson('/api/v1/channels/b2b/agencies/AGB-01/block', ['reason' => 'Pagos vencidos'], critical($version))->assertOk();
    expect(channelLockVersion('channel_b2b_agencies', 'AGB-01'))->toBe($version + 1);

    expect($this->postJson('/api/v1/channels/b2b/agencies/AGB-01/unblock', [], critical($version)))->toBeApiError(409, 'STALE_VERSION');
    expect(rowOf('channel_b2b_agencies', 'AGB-01')->status)->toBe('bloqueada');
});

it('un contenido CMS cambia de estado con su versión y rechaza una versión vieja', function () {
    actingAsSeed('U01');
    $version = channelLockVersion('cms_contents', 'CMS-04');

    $this->postJson('/api/v1/cms/contents/CMS-04/submit', [], critical($version))->assertOk();
    expect(channelLockVersion('cms_contents', 'CMS-04'))->toBe($version + 1);

    expect($this->postJson('/api/v1/cms/contents/CMS-04/return', ['reason' => 'Faltan datos'], critical($version)))->toBeApiError(409, 'STALE_VERSION');
    expect(rowOf('cms_contents', 'CMS-04')->status)->toBe('en_revision');
});

it('una reseña propia se modera con su versión y rechaza una versión vieja', function () {
    actingAsSeed('U01');
    $version = channelLockVersion('crm_own_reviews', 'RVO-0001');

    $this->postJson('/api/v1/reviews/RVO-0001/hide', ['reason' => 'Datos personales'], critical($version))->assertOk();
    expect(channelLockVersion('crm_own_reviews', 'RVO-0001'))->toBe($version + 1);

    expect($this->putJson('/api/v1/reviews/RVO-0001/reply', ['text' => 'Gracias por viajar con nosotros.'], critical($version)))->toBeApiError(409, 'STALE_VERSION');
    expect(rowOf('crm_own_reviews', 'RVO-0001')->status)->toBe('oculta');
});
