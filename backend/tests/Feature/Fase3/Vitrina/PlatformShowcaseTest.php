<?php

use Illuminate\Support\Facades\DB;

function vitrinaPlatformAudit(string $entity, string $entityId, string $action): bool
{
    return DB::connection('pgsql_platform')->table('audit_events')->whereNull('tenant_id')->where(['entity' => $entity, 'entity_id' => $entityId, 'action' => $action])->exists();
}

it('la moderación lista publicaciones y agencias por revisar y el embudo por mes', function () {
    actingAsPlatform();
    $moderation = $this->getJson('/api/v1/platform/showcase/moderation')->assertOk()->json('data');

    expect(collect($moderation['listings'])->pluck('code'))->toContain('SHL-010')
        ->and(collect($moderation['agencies'])->firstWhere('code', 'SHA-05')['status'])->toBe('en_revision')
        ->and($moderation['kpis']['pending_listings'])->toBeGreaterThanOrEqual(1);

    $funnel = $this->getJson('/api/v1/platform/showcase/funnel')->assertOk()->json('data');
    expect($funnel['months'])->not->toBeEmpty()->and($funnel['months'][0])->toHaveKeys(['visita', 'reserva', 'registro_agencia', 'pase_iniciado', 'plan_pagado']);
});

it('VT-01: no aprueba una publicación de una agencia sin verificar; rechazar exige motivo', function () {
    actingAsPlatform();

    expect($this->postJson('/api/v1/platform/showcase/listings/SHL-010/decision', ['decision' => 'aprobar']))->toBeApiError(422, 'VT-01');
    expect($this->postJson('/api/v1/platform/showcase/listings/SHL-010/decision', ['decision' => 'rechazar']))->toBeApiError(422, 'VT-01');

    $this->postJson('/api/v1/platform/showcase/agencies/SHA-05/verify', [])->assertOk()->assertJsonPath('data.status', 'activa');
    $this->postJson('/api/v1/platform/showcase/listings/SHL-010/decision', ['decision' => 'aprobar'])->assertOk()->assertJsonPath('data.status', 'publicado');

    expect(DB::connection('pgsql_platform')->table('platform_showcase_listings')->where('code', 'SHL-010')->value('published_at'))->not->toBeNull()
        ->and(vitrinaPlatformAudit('Vitrina', 'SHL-010', 'aprobar'))->toBeTrue()
        ->and(vitrinaPlatformAudit('Vitrina agencia', 'SHA-05', 'verificar'))->toBeTrue();
    expect($this->postJson('/api/v1/platform/showcase/listings/SHL-010/decision', ['decision' => 'aprobar']))->toBeApiError(409, 'VT-01');
});

it('rechazar con motivo y suspender una agencia despublica sus tours', function () {
    actingAsPlatform();
    DB::connection('pgsql_platform')->table('platform_showcase_listings')->where('code', 'SHL-011')->update(['status' => 'en_revision', 'published_at' => null]);

    $this->postJson('/api/v1/platform/showcase/listings/SHL-011/decision', ['decision' => 'rechazar', 'reason' => 'Las fotos no son propias.'])->assertOk()->assertJsonPath('data.status', 'rechazado');
    expect(DB::connection('pgsql_platform')->table('platform_showcase_listings')->where('code', 'SHL-011')->value('reject_reason'))->toBe('Las fotos no son propias.');

    $this->postJson('/api/v1/platform/showcase/agencies/SHA-04/verify', ['action' => 'suspender', 'reason' => 'Reclamos de viajeros'])->assertOk()->assertJsonPath('data.status', 'suspendida');
    expect(DB::connection('pgsql_platform')->table('platform_showcase_listings as l')->join('platform_showcase_agencies as a', 'a.id', '=', 'l.agency_id')->where('a.code', 'SHA-04')->where('l.status', 'publicado')->count())->toBe(0);
});

it('VT-13: el blog crea borradores y no publica con menos de 800 palabras ni sin 3 tours de la ciudad', function () {
    actingAsPlatform();
    $created = $this->postJson('/api/v1/platform/showcase/posts', ['title' => 'Free tours en Barranco: guía completa', 'excerpt' => 'Murales, miradores y cafés de Barranco a pie con guías locales.', 'focus_keyword' => 'free tour barranco', 'city' => 'lima', 'body' => str_repeat('palabra ', 700)])->assertOk()->json('data');

    expect($created['status'])->toBe('borrador');
    expect($this->patchJson("/api/v1/platform/showcase/posts/{$created['id']}", ['status' => 'publicado']))->toBeApiError(422, 'VT-13');

    $lima = DB::connection('pgsql_platform')->table('platform_showcase_listings')->where('city', 'lima')->where('status', 'publicado')->orderBy('code')->limit(3)->pluck('id')->all();
    expect($this->patchJson("/api/v1/platform/showcase/posts/{$created['id']}", ['status' => 'publicado', 'body' => str_repeat('palabra ', 900)]))->toBeApiError(422, 'VT-13');

    $this->patchJson("/api/v1/platform/showcase/posts/{$created['id']}", ['status' => 'publicado', 'body' => str_repeat('palabra ', 900), 'linked_listings' => $lima])->assertOk()->assertJsonPath('data.status', 'publicado');
    expect(collect($this->getJson('/api/v1/platform/showcase/posts')->assertOk()->json('data.items'))->firstWhere('id', $created['id'])['word_count'])->toBe(900)
        ->and(vitrinaPlatformAudit('Blog vitrina', $created['slug'], 'publicado'))->toBeTrue();
});

it('la vitrina de plataforma es solo para la consola', function () {
    actingAsSeed('U01');

    $this->getJson('/api/v1/platform/showcase/moderation')->assertStatus(403);
});
