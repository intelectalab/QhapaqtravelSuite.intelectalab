<?php

use Illuminate\Support\Facades\DB;

function cmsBody(array $overrides = []): array
{
    return [
        'title' => 'Guía de aclimatación en Cusco',
        'type' => 'Artículo',
        'channel' => 'Web',
        'body' => 'Recomendaciones para los primeros días de viaje en altura.',
        'seo_title' => 'Aclimatación en Cusco',
        'seo_description' => 'Consejos prácticos para disfrutar Cusco sin mal de altura.',
        ...$overrides,
    ];
}

function cmsEdit(string $code, array $overrides = []): array
{
    $row = rowOf('cms_contents', $code);

    return [
        'title' => $row->title,
        'type' => $row->type,
        'channel' => $row->channel,
        'slug' => $row->slug,
        'body' => $row->body,
        'seo_title' => $row->seo_title,
        'seo_description' => $row->seo_description,
        'placement' => $row->placement,
        'valid_from' => $row->valid_from,
        'valid_to' => $row->valid_to,
        ...$overrides,
    ];
}

function cmsLock(string $code): int
{
    return (int) rowOf('cms_contents', $code)->lock_version;
}

function cmsEvents(string $code): array
{
    return withinTenant(tenantA(), fn () => DB::table('cms_content_events')->where('content_id', idOf('cms_contents', $code))->orderBy('created_at')->pluck('message')->all());
}

function cmsAudit(string $code, string $action): bool
{
    return withinTenant(tenantA(), fn () => DB::table('audit_events')->where(['entity' => 'Contenido CMS', 'entity_id' => $code, 'action' => $action])->exists());
}

function cmsSiteBanner(): ?array
{
    return test()->getJson('/api/v1/public/site', siteOf())->assertOk()->json('data.banner');
}

function cmsListed(): array
{
    return collect(test()->getJson('/api/v1/cms/contents')->assertOk()->json('data.items'))->pluck('code')->all();
}

it('crear un contenido lo deja en borrador con su URL generada del título y el evento de creación', function () {
    $user = actingAsSeed('U02');

    $code = $this->postJson('/api/v1/cms/contents', cmsBody())->assertCreated()->json('data.code');
    $row = rowOf('cms_contents', $code);

    expect($code)->toBe('CMS-07')
        ->and($row->status)->toBe('borrador')
        ->and($row->slug)->toBe('guia-de-aclimatacion-en-cusco')
        ->and($row->author_id)->toBe($user->id)
        ->and($row->seo_title)->toBe('Aclimatación en Cusco')
        ->and(cmsListed())->toContain($code)
        ->and(cmsEvents($code))->toBe(['Contenido creado'])
        ->and(cmsAudit($code, 'crear'))->toBeTrue();
});

it('CMS-BR-03: la URL es única y se valida el contenido', function () {
    actingAsSeed('U01');

    expect($this->postJson('/api/v1/cms/contents', cmsBody(['slug' => 'Home Temporada de Primavera'])))->toBeApiError(409, 'CMS-BR-03');
    $this->postJson('/api/v1/cms/contents', cmsBody(['title' => 'x', 'type' => 'Video', 'channel' => 'TikTok', 'body' => '', 'seo_title' => str_repeat('a', 61), 'valid_from' => '2026-10-10', 'valid_to' => '2026-10-01']))
        ->assertStatus(422)->assertJsonValidationErrors(['title', 'type', 'channel', 'body', 'seo_title', 'valid_to']);

    expect(withinTenant(tenantA(), fn () => DB::table('cms_contents')->count()))->toBe(6);
});

it('editar un contenido guarda los cambios, sube su versión y deja el evento', function () {
    actingAsSeed('U01');
    $lock = cmsLock('CMS-04');

    $this->patchJson('/api/v1/cms/contents/CMS-04', cmsEdit('CMS-04', ['title' => 'Landing: Año Nuevo andino 2027', 'slug' => 'ano-nuevo-andino-2027', 'seo_title' => 'Año Nuevo en Cusco']), critical($lock))->assertOk();

    $row = rowOf('cms_contents', 'CMS-04');
    expect($row->title)->toBe('Landing: Año Nuevo andino 2027')
        ->and($row->slug)->toBe('ano-nuevo-andino-2027')
        ->and((int) $row->lock_version)->toBe($lock + 1)
        ->and(cmsEvents('CMS-04'))->toContain('Contenido editado')
        ->and(cmsAudit('CMS-04', 'editar'))->toBeTrue()
        ->and($this->patchJson('/api/v1/cms/contents/CMS-04', cmsEdit('CMS-04'), critical($lock)))->toBeApiError(409, 'STALE_VERSION');
});

it('CMS-BR-04: un contenido publicado no se queda sin título SEO y la URL sigue siendo única al editar', function () {
    actingAsSeed('U01');

    expect($this->patchJson('/api/v1/cms/contents/CMS-01', cmsEdit('CMS-01', ['seo_title' => null]), critical(cmsLock('CMS-01'))))->toBeApiError(422, 'CMS-BR-04')
        ->and($this->patchJson('/api/v1/cms/contents/CMS-04', cmsEdit('CMS-04', ['slug' => 'politica-de-cancelaciones']), critical(cmsLock('CMS-04'))))->toBeApiError(409, 'CMS-BR-03')
        ->and(rowOf('cms_contents', 'CMS-01')->seo_title)->not->toBeNull();
});

it('archivar es lógico: el contenido sale del listado, conserva su historial y libera su URL', function () {
    actingAsSeed('U01');
    $slug = rowOf('cms_contents', 'CMS-04')->slug;

    $this->deleteJson('/api/v1/cms/contents/CMS-04')->assertOk()->assertJsonPath('data.code', 'CMS-04');

    expect(withinTenant(tenantA(), fn () => DB::table('cms_contents')->where('code', 'CMS-04')->value('deleted_at')))->not->toBeNull()
        ->and(cmsListed())->not->toContain('CMS-04')
        ->and(cmsAudit('CMS-04', 'archivar'))->toBeTrue()
        ->and($this->deleteJson('/api/v1/cms/contents/CMS-04'))->toBeApiError(404);

    $this->postJson('/api/v1/cms/contents', cmsBody(['slug' => $slug]))->assertCreated();
});

it('CMS-BR-07: un contenido publicado no se archiva sin despublicarlo', function () {
    actingAsSeed('U01');

    expect($this->deleteJson('/api/v1/cms/contents/CMS-01'))->toBeApiError(409, 'CMS-BR-07')
        ->and(rowOf('cms_contents', 'CMS-01')->deleted_at)->toBeNull();
});

it('aprobar un contenido en revisión lo deja listo para publicar', function () {
    actingAsSeed('U01');

    $this->postJson('/api/v1/cms/contents/CMS-03/approve', [], critical(cmsLock('CMS-03')))->assertOk();

    expect(rowOf('cms_contents', 'CMS-03')->status)->toBe('aprobado')
        ->and(cmsEvents('CMS-03'))->toContain('Aprobado')
        ->and(cmsAudit('CMS-03', 'aprobado'))->toBeTrue();

    expect($this->postJson('/api/v1/cms/contents/CMS-03/publish', [], critical(cmsLock('CMS-03'))))->toBeApiError(422, 'CMS-BR-04');
    $this->patchJson('/api/v1/cms/contents/CMS-03', cmsEdit('CMS-03', ['seo_title' => 'Mal de altura: 10 consejos']), critical(cmsLock('CMS-03')))->assertOk();
    $this->postJson('/api/v1/cms/contents/CMS-03/publish', [], critical(cmsLock('CMS-03')))->assertOk();
    expect(rowOf('cms_contents', 'CMS-03')->status)->toBe('publicado')
        ->and(rowOf('cms_contents', 'CMS-03')->published_at)->not->toBeNull();
});

it('CMS-BR-06: solo se aprueba lo que está en revisión', function (string $code) {
    actingAsSeed('U01');
    $status = rowOf('cms_contents', $code)->status;

    expect($this->postJson("/api/v1/cms/contents/{$code}/approve", [], critical(cmsLock($code))))->toBeApiError(409, 'CMS-BR-06')
        ->and(rowOf('cms_contents', $code)->status)->toBe($status);
})->with(['CMS-04', 'CMS-01', 'CMS-06']);

it('despublicar un banner lo retira del sitio público con su motivo', function () {
    actingAsSeed('U01');
    expect(cmsSiteBanner()['title'])->toBe('Promo Humantay S/ 129');

    $this->postJson('/api/v1/cms/contents/CMS-02/unpublish', ['reason' => 'Terminó la promoción'], critical(cmsLock('CMS-02')))->assertOk();

    $row = rowOf('cms_contents', 'CMS-02');
    expect($row->status)->toBe('despublicado')
        ->and($row->unpublished_at)->not->toBeNull()
        ->and(cmsEvents('CMS-02'))->toContain('Despublicado — Terminó la promoción')
        ->and(cmsAudit('CMS-02', 'despublicado'))->toBeTrue()
        ->and(cmsSiteBanner())->toBeNull();
});

it('CMS-BR-05 / CMS-BR-06: despublicar exige motivo y solo aplica a contenido publicado', function () {
    actingAsSeed('U01');

    expect($this->postJson('/api/v1/cms/contents/CMS-02/unpublish', [], critical(cmsLock('CMS-02'))))->toBeApiError(422, 'CMS-BR-05')
        ->and($this->postJson('/api/v1/cms/contents/CMS-04/unpublish', ['reason' => 'No aplica'], critical(cmsLock('CMS-04'))))->toBeApiError(409, 'CMS-BR-06')
        ->and(rowOf('cms_contents', 'CMS-02')->status)->toBe('publicado');
});

it('CMS-BR-07: un banner publicado con vigencia futura todavía no se muestra en el sitio', function () {
    actingAsSeed('U01');
    $this->postJson('/api/v1/cms/contents/CMS-02/unpublish', ['reason' => 'Cambio de campaña'], critical(cmsLock('CMS-02')))->assertOk();
    $code = $this->postJson('/api/v1/cms/contents', cmsBody(['title' => 'Banner: Navidad en los Andes', 'type' => 'Banner', 'valid_from' => '2026-12-01', 'valid_to' => '2026-12-31']))->assertCreated()->json('data.code');

    foreach (['submit', 'approve', 'publish'] as $action) {
        $this->postJson("/api/v1/cms/contents/{$code}/{$action}", [], critical(cmsLock($code)))->assertOk();
    }

    expect(rowOf('cms_contents', $code)->status)->toBe('publicado')
        ->and(cmsSiteBanner())->toBeNull();
});

it('CMS-BR-01: Ventas no crea, edita, archiva ni modera contenidos', function () {
    actingAsSeed('U03');

    expect($this->postJson('/api/v1/cms/contents', cmsBody()))->toBeApiError(403)
        ->and($this->patchJson('/api/v1/cms/contents/CMS-04', cmsEdit('CMS-04'), critical(cmsLock('CMS-04'))))->toBeApiError(403)
        ->and($this->deleteJson('/api/v1/cms/contents/CMS-04'))->toBeApiError(403)
        ->and($this->postJson('/api/v1/cms/contents/CMS-03/approve', [], critical(cmsLock('CMS-03'))))->toBeApiError(403)
        ->and($this->postJson('/api/v1/cms/contents/CMS-02/unpublish', ['reason' => 'Prueba'], critical(cmsLock('CMS-02'))))->toBeApiError(403)
        ->and(rowOf('cms_contents', 'CMS-03')->status)->toBe('en_revision');
});
