<?php

use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\DB;

beforeEach(function () {
    $this->withoutMiddleware(ThrottleRequests::class);
});

function reviewWidgetDefaults(): array
{
    return withinTenant(tenantA(), fn () => json_decode((string) DB::table('channel_widget_config')->value('defaults'), true));
}

it('la bandeja trae el widget de reseñas con las plataformas conectadas y los alcances de cada conector', function () {
    actingAsSeed('U01');

    $data = $this->getJson('/api/v1/channels/external-reviews')->assertOk()->json('data');
    $google = collect($data['sources'])->firstWhere('provider', 'google');

    expect($data['widget']['settings']['sources'])->toEqualCanonicalizing(['google', 'tripadvisor', 'getyourguide'])
        ->and($data['widget']['settings']['min_rating'])->toBe(4)
        ->and($data['widget']['public_key'])->not->toBeNull()
        ->and($data['can_configure'])->toBeTrue()
        ->and($google['scopes'])->toBe(['business.manage']);
});

it('guardar el widget de reseñas conserva los demás valores del widget y queda auditado', function () {
    actingAsSeed('U01');
    $method = reviewWidgetDefaults()['method'];

    $this->putJson('/api/v1/channels/external-reviews/widget', ['sources' => ['google'], 'min_rating' => 5, 'count' => 6, 'layout' => 'cuadricula'])
        ->assertOk()->assertJsonPath('data.layout', 'cuadricula');

    $defaults = reviewWidgetDefaults();
    expect($defaults['reviews_widget'])->toEqual(['sources' => ['google'], 'min_rating' => 5, 'count' => 6, 'layout' => 'cuadricula'])
        ->and($defaults['method'])->toBe($method)
        ->and(withinTenant(tenantA(), fn () => DB::table('audit_events')->where(['entity' => 'Widget de reseñas', 'entity_id' => 'configuracion', 'action' => 'editar'])->exists()))->toBeTrue()
        ->and($this->getJson('/api/v1/channels/external-reviews')->json('data.widget.settings.count'))->toBe(6);
});

it('el widget de reseñas solo muestra plataformas conectadas y valida sus límites', function () {
    actingAsSeed('U01');

    $this->putJson('/api/v1/channels/external-reviews/widget', ['sources' => ['trustpilot'], 'min_rating' => 4, 'count' => 3, 'layout' => 'lista'])->assertStatus(422)->assertJsonValidationErrors(['sources']);
    $this->putJson('/api/v1/channels/external-reviews/widget', ['sources' => [], 'min_rating' => 6, 'count' => 20, 'layout' => 'mosaico'])->assertStatus(422)->assertJsonValidationErrors(['sources', 'min_rating', 'count', 'layout']);

    expect(reviewWidgetDefaults())->not->toHaveKey('reviews_widget');
});

it('Finanzas y Operaciones no configuran el widget de reseñas', function (string $user) {
    actingAsSeed($user);

    expect($this->putJson('/api/v1/channels/external-reviews/widget', ['sources' => ['google'], 'min_rating' => 4, 'count' => 3, 'layout' => 'lista']))->toBeApiError(403);
})->with(['U07', 'U05']);
