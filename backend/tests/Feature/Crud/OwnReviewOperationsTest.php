<?php

use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;

beforeEach(function () {
    $this->withoutMiddleware(ThrottleRequests::class);
    Queue::fake();
});

it('RVW: estadísticas, detalle con historial y lista de solicitudes de reseñas propias', function () {
    actingAsSeed('U01');

    $stats = $this->getJson('/api/v1/reviews/stats')->assertOk()->json('data');
    expect($stats)->toHaveKeys(['kpis', 'distribution', 'by_product', 'subratings'])->and($stats['distribution'])->toHaveCount(5);

    $code = (string) withinTenant(tenantA(), fn () => DB::table('crm_own_reviews')->whereNull('deleted_at')->orderBy('code')->value('code'));
    $review = $this->getJson("/api/v1/reviews/{$code}")->assertOk()->json('data');
    expect($review['code'])->toBe($code)->and($review)->toHaveKeys(['log', 'stars', 'status']);
    expect($this->getJson('/api/v1/reviews/RVO-9999'))->toBeApiError(404);

    $requests = $this->getJson('/api/v1/review-requests?status=programada')->assertOk()->json('data');
    expect(collect($requests)->pluck('status')->unique()->values()->all())->toBeIn([[], ['programada']]);
});

it('RVW-09: programar pendientes crea una invitación por cada viaje terminado sin solicitud y no duplica', function () {
    actingAsSeed('U01');
    $before = (int) withinTenant(tenantA(), fn () => DB::table('crm_review_requests')->count());

    $first = $this->postJson('/api/v1/review-requests/schedule-pending', [], critical())->assertOk()->json('data');
    $second = $this->postJson('/api/v1/review-requests/schedule-pending', [], critical())->assertOk()->json('data');

    expect((int) withinTenant(tenantA(), fn () => DB::table('crm_review_requests')->count()))->toBe($before + count($first['created']))
        ->and($second['created'])->toBe([]);

    if ($first['created'] !== []) {
        $row = withinTenant(tenantA(), fn () => DB::table('crm_review_requests')->where('code', $first['created'][0]['code'])->first(['status', 'channel', 'scheduled_at', 'expires_at']));
        expect($row->status)->toBe('programada')->and($row->channel)->toBe('email')->and($row->expires_at > $row->scheduled_at)->toBeTrue();
    }
});

it('RVW-10: exportar el feed respeta «mostrar en el widget» y deja la última exportación en los ajustes', function () {
    actingAsSeed('U01');

    $feed = $this->postJson('/api/v1/reviews/export-feed', [], critical())->assertOk()->json('data');
    $published = (int) withinTenant(tenantA(), fn () => DB::table('crm_own_reviews')->whereNull('deleted_at')->where('status', 'publicada')->count());
    expect($feed['count'])->toBe($published)->and($feed['widget'])->toBeTrue();

    $settings = $this->getJson('/api/v1/settings/own-reviews')->json('data');
    expect($settings['values']['last_export']['count'])->toBe($published);

    $this->patchJson('/api/v1/settings/own-reviews', ['show_on_widget' => false], ['If-Match' => (string) $settings['lock_version']])->assertOk();
    expect($this->postJson('/api/v1/reviews/export-feed', [], critical())->assertOk()->json('data.count'))->toBe(0);
});

it('Ventas consulta pero no programa invitaciones ni exporta el feed', function () {
    actingAsSeed('U03');

    $this->getJson('/api/v1/reviews/stats')->assertOk();
    expect($this->postJson('/api/v1/review-requests/schedule-pending', [], critical())->status())->toBe(403)
        ->and($this->postJson('/api/v1/reviews/export-feed', [], critical())->status())->toBe(403);
});
