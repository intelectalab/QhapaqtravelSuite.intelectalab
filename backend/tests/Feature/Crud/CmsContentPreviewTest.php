<?php

use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\DB;

beforeEach(fn () => $this->withoutMiddleware(ThrottleRequests::class));

it('§6.4 CMS: el detalle trae la bitácora y la vista previa usa los datos sin guardar con su vista en el buscador', function () {
    actingAsSeed('U01');
    $code = (string) withinTenant(tenantA(), fn () => DB::table('cms_contents')->whereNull('deleted_at')->orderBy('code')->value('code'));

    $detail = $this->getJson("/api/v1/cms/contents/{$code}")->assertOk()->json('data');
    expect($detail['code'])->toBe($code)->and($detail)->toHaveKeys(['log', 'next', 'body']);
    expect($this->getJson('/api/v1/cms/contents/CMS-NO-EXISTE'))->toBeApiError(404);

    $body = "Primer párrafo con <script>alert(1)</script> texto.\n\nSegundo párrafo del artículo.";
    $preview = $this->postJson("/api/v1/cms/contents/{$code}/preview", ['title' => 'Guía para visitar Machu Picchu en temporada de lluvias', 'body' => $body, 'seo_title' => 'Guía para visitar Machu Picchu en temporada de lluvias', 'seo_description' => 'Corta'])->assertOk()->json('data');

    expect($preview['html'])->toContain('<p>')->not->toContain('<script>')
        ->and($preview['serp']['title'])->toBe('Guía para visitar Machu Picchu en temporada de lluvias')
        ->and($preview['serp']['url'])->toContain('andes.')
        ->and($preview['serp']['warnings'])->toContain('La descripción SEO es muy corta.')
        ->and($preview['words'])->toBeGreaterThan(5);

    expect(withinTenant(tenantA(), fn () => DB::table('cms_contents')->where('code', $code)->value('title')))->toBe($detail['title']);
});

it('sin permiso de publicación no se ve el detalle del CMS', function () {
    actingAsSeed('U05');
    expect($this->getJson('/api/v1/cms/contents/CMS-0001')->status())->toBe(403);
});
