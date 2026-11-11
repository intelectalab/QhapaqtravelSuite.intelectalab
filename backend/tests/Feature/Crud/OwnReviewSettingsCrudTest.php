<?php

use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;

beforeEach(function () {
    $this->withoutMiddleware(ThrottleRequests::class);
    Queue::fake();
});

it('RVW-06: los ajustes de reseñas propias tienen valores por defecto y se editan con validación, versión y auditoría', function () {
    actingAsSeed('U01');

    $current = $this->getJson('/api/v1/settings/own-reviews')->assertOk()->json('data');
    expect($current['values']['personal_data'])->toBe('retener')->and($current['values']['invite']['expire_days'])->toBe(30)
        ->and(collect($current['options']['subratings'])->pluck('value'))->toContain('guia');

    $this->patchJson('/api/v1/settings/own-reviews', ['active_subratings' => [], 'personal_data' => 'borrar', 'invite' => ['expire_days' => 1, 'body' => 'corto']], ['If-Match' => (string) $current['lock_version']])->assertStatus(422)
        ->assertJsonValidationErrors(['active_subratings', 'personal_data', 'invite.expire_days', 'invite.body']);
    $this->patchJson('/api/v1/settings/own-reviews', ['invite' => ['reminder_days' => 20, 'expire_days' => 10]], ['If-Match' => (string) $current['lock_version']])->assertStatus(422)->assertJsonValidationErrors(['invite.reminder_days']);

    $saved = $this->patchJson('/api/v1/settings/own-reviews', [
        'auto_publish' => true, 'banned_words' => ['Estafa', 'estafa ', 'basura'], 'personal_data' => 'enmascarar', 'active_subratings' => ['guia', 'valor'],
        'show_on_site' => false, 'invite' => ['expire_days' => 15, 'reminder_days' => 5],
    ], ['If-Match' => (string) $current['lock_version']])->assertOk()->json('data');

    expect($saved['values']['banned_words'])->toBe(['estafa', 'basura'])
        ->and($saved['values']['active_subratings'])->toBe(['guia', 'valor'])
        ->and($saved['values']['invite']['expire_days'])->toBe(15)
        ->and($saved['values']['invite']['subject'])->toBe($current['values']['invite']['subject'])
        ->and($saved['updated_by'])->not->toBeNull()
        ->and(withinTenant(tenantA(), fn () => DB::table('audit_events')->where(['entity' => 'Ajustes de reseñas', 'action' => 'actualizar'])->exists()))->toBeTrue();

    $again = $this->patchJson('/api/v1/settings/own-reviews', ['auto_publish' => false], ['If-Match' => (string) $saved['lock_version']])->assertOk()->json('data');
    expect($again['lock_version'])->toBeGreaterThan($saved['lock_version'])
        ->and($this->patchJson('/api/v1/settings/own-reviews', ['auto_publish' => true], ['If-Match' => (string) $saved['lock_version']]))->toBeApiError(409);

    $home = $this->getJson('/api/v1/public/home', siteOf())->assertOk()->json('data.reviews');
    expect(collect($home['items'] ?? [])->where('source', 'propia')->count())->toBe(0);
});

it('solo quien gestiona el e-commerce cambia los ajustes de reseñas', function () {
    actingAsSeed('U05');
    $status = $this->patchJson('/api/v1/settings/own-reviews', ['auto_publish' => true], ['If-Match' => '0'])->status();
    expect($status)->toBeIn([403]);
});
