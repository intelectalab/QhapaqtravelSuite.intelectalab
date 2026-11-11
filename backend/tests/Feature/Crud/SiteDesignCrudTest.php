<?php

use App\Domain\Platform\Support\Entitlements;
use App\Domain\Site\Support\SiteDesign;
use App\Http\Middleware\EnsureFeature;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Testing\TestResponse;

beforeEach(fn () => lockPlatformBilling());

function siteDesignDraft(): array
{
    return test()->getJson('/api/v1/admin/site-design')->assertOk()->json('data');
}

function siteDesignSave(array $design, int $lock): TestResponse
{
    return test()->putJson('/api/v1/admin/site-design/draft', ['design' => $design, 'lock_version' => $lock]);
}

function siteDesignAudit(string $action): ?object
{
    return withinTenant(tenantA(), fn () => DB::table('audit_events')->where(['entity' => 'Sitio web', 'action' => $action])->orderByDesc('code')->first());
}

function siteDesignPlan(string $code): void
{
    $db = DB::connection('pgsql_platform');
    $db->table('tenants')->where('id', tenantA()->getKey())->update(['plan_id' => $db->table('plans')->where('code', $code)->value('id')]);
    Entitlements::flush();
}

it('el borrador nace con los valores de fábrica y los colores del panel, sin cambios pendientes', function () {
    actingAsSeed('U01');

    $data = siteDesignDraft();

    expect($data['draft']['theme']['colors'])->toBe('panel')
        ->and($data['draft']['theme']['brand'])->toBe('#b3263e')
        ->and(array_column($data['draft']['sections'], 'id'))->toBe(array_keys(SiteDesign::SECTIONS))
        ->and($data['published'])->toBeNull()
        ->and($data['pending'])->toBe([])
        ->and($data['site']['subdomain'])->toBe('andes')
        ->and($data['catalog']['texts'])->not->toBeEmpty();
});

it('guarda el borrador sin tocar lo que ven los visitantes, y publicar lo hace visible y auditado', function () {
    actingAsSeed('U01');
    $data = siteDesignDraft();
    $design = $data['draft'];
    $design['theme'] = [...$design['theme'], 'colors' => 'propios', 'brand' => '#0F766E', 'font' => 'editorial'];
    $design['texts']['es'] = ['home.heroTitle' => 'Viaja distinto con {agencia}', 'footer.about' => 'Somos cusqueños.'];
    $design['sections'] = array_reverse($design['sections']);
    $design['sections'][0]['visible'] = false;
    $design['announcement'] = ['mode' => 'propio', 'text' => 'Feriado largo: 10 % menos', 'link_label' => 'Ver ofertas', 'link_href' => '/ofertas'];

    $saved = siteDesignSave($design, $data['lock_version'])->assertOk()->json('data');

    expect($saved['pending'])->toContain('Marca y estilo', 'Textos', 'Secciones de la portada', 'Aviso superior');

    $public = $this->getJson('/api/v1/public/site', siteOf())->assertOk()->json('data');
    expect($public['branding']['brand'])->toBe('#b3263e')
        ->and($public['design']['texts']['es'])->toBe([]);

    $preview = $this->getJson('/api/v1/admin/site-design/preview')->assertOk()->json('data');
    expect($preview['branding']['brand'])->toBe('#0f766e')
        ->and($preview['banner']['title'])->toBe('Feriado largo: 10 % menos')
        ->and($preview['design']['texts']['es']['home.heroTitle'])->toBe('Viaja distinto con {agencia}');

    $this->postJson('/api/v1/admin/site-design/publish', ['note' => 'Campaña de feriado'])->assertOk()->assertJsonPath('data.version', 1);

    $public = $this->getJson('/api/v1/public/site', siteOf())->assertOk()->json('data');
    expect($public['branding']['brand'])->toBe('#0f766e')
        ->and($public['design']['theme']['font'])->toBe('editorial')
        ->and($public['design']['sections'][0])->toBe(['id' => 'newsletter', 'visible' => false])
        ->and($public['banner'])->toBe(['title' => 'Feriado largo: 10 % menos', 'body' => null, 'link_label' => 'Ver ofertas', 'link_href' => '/ofertas'])
        ->and(siteDesignAudit('publicar')->after_value)->toBe('Campaña de feriado')
        ->and(siteDesignDraft()['pending'])->toBe([])
        ->and(siteDesignDraft()['versions'][0])->toMatchArray(['version' => 1, 'note' => 'Campaña de feriado']);

    expect($this->postJson('/api/v1/admin/site-design/publish', []))->toBeApiError(422, 'SITE-BR-02');
});

it('SITE-BR-01: dos personas editando a la vez no se pisan', function () {
    actingAsSeed('U01');
    $data = siteDesignDraft();
    $first = siteDesignSave($data['draft'], $data['lock_version'])->assertOk()->json('data.lock_version');

    expect(siteDesignSave($data['draft'], $data['lock_version']))->toBeApiError(409, 'SITE-BR-01');

    siteDesignSave($data['draft'], $first)->assertOk();
});

it('descarta el borrador volviendo a lo publicado y restaura una versión anterior al borrador', function () {
    actingAsSeed('U01');
    $data = siteDesignDraft();
    $design = $data['draft'];
    $design['hero']['show_stats'] = false;
    $lock = siteDesignSave($design, $data['lock_version'])->assertOk()->json('data.lock_version');
    $this->postJson('/api/v1/admin/site-design/publish')->assertOk();

    $design['seo']['title'] = 'Andes Horizonte | Tours en Cusco';
    siteDesignSave($design, siteDesignDraft()['lock_version'])->assertOk();
    $this->postJson('/api/v1/admin/site-design/discard')->assertOk();

    expect(siteDesignDraft()['draft']['seo']['title'])->toBe('')
        ->and(siteDesignAudit('descartar'))->not->toBeNull();
    expect($this->postJson('/api/v1/admin/site-design/discard'))->toBeApiError(422, 'SITE-BR-03');

    $design['hero']['show_stats'] = true;
    siteDesignSave($design, siteDesignDraft()['lock_version'])->assertOk();
    $this->postJson('/api/v1/admin/site-design/publish')->assertOk()->assertJsonPath('data.version', 2);

    $restored = $this->postJson('/api/v1/admin/site-design/versions/1/restore')->assertOk()->json('data.draft');

    expect($restored['hero']['show_stats'])->toBeFalse()
        ->and($this->getJson('/api/v1/public/site', siteOf())->json('data.design.hero.show_stats'))->toBeTrue()
        ->and(siteDesignAudit('restaurar')->entity_id)->toBe('v1');
    expect($this->postJson('/api/v1/admin/site-design/versions/99/restore'))->toBeApiError(404);
});

it('valida colores, secciones, enlaces, banners y textos', function (Closure $change, string $field) {
    actingAsSeed('U01');
    $data = siteDesignDraft();

    siteDesignSave($change($data['draft']), $data['lock_version'])->assertStatus(422)->assertJsonValidationErrors($field);
})->with([
    'color sin #' => [fn (array $d) => [...$d, 'theme' => [...$d['theme'], 'brand' => '0f766e']], 'design.theme.brand'],
    'fuente inexistente' => [fn (array $d) => [...$d, 'theme' => [...$d['theme'], 'font' => 'comic']], 'design.theme.font'],
    'imagen de portada faltante' => [fn (array $d) => [...$d, 'hero' => [...$d['hero'], 'style' => 'imagen', 'image_id' => null]], 'design.hero.image_id'],
    'sección repetida' => [fn (array $d) => [...$d, 'sections' => [...array_slice($d['sections'], 0, 7), $d['sections'][0]]], 'design.sections.7.id'],
    'aviso propio vacío' => [fn (array $d) => [...$d, 'announcement' => ['mode' => 'propio', 'text' => '', 'link_label' => '', 'link_href' => '']], 'design.announcement.text'],
    'enlace inseguro' => [fn (array $d) => [...$d, 'announcement' => ['mode' => 'propio', 'text' => 'Hola', 'link_label' => 'Ir', 'link_href' => 'javascript:alert(1)']], 'design.announcement.link_href'],
    'banner con fechas al revés' => [fn (array $d) => [...$d, 'promos' => [['id' => 'p1', 'title' => 'Verano', 'body' => '', 'image_id' => null, 'cta_label' => '', 'cta_href' => '', 'tone' => 'marca', 'starts_on' => '2026-12-10', 'ends_on' => '2026-12-01', 'visible' => true]]], 'design.promos.0.ends_on'],
    'red social sin https' => [fn (array $d) => [...$d, 'footer' => [...$d['footer'], 'social' => [...$d['footer']['social'], 'instagram' => 'http://instagram.com/x']]], 'design.footer.social.instagram'],
    'texto no editable' => [fn (array $d) => [...$d, 'texts' => ['es' => ['checkout.pay' => 'Pagar']]], 'design.texts.es.checkout.pay'],
    'texto muy largo' => [fn (array $d) => [...$d, 'texts' => ['es' => ['header.tagline' => str_repeat('a', 61)]]], 'design.texts.es.header.tagline'],
]);

it('los banners solo se muestran dentro de sus fechas y si están visibles', function () {
    actingAsSeed('U01');
    $data = siteDesignDraft();
    $promo = ['body' => '', 'image_id' => null, 'cta_label' => 'Ver', 'cta_href' => '/ofertas', 'tone' => 'acento', 'starts_on' => null, 'ends_on' => null, 'visible' => true];
    $design = [...$data['draft'], 'promos' => [
        ['id' => 'vigente', 'title' => 'Vigente', ...$promo],
        ['id' => 'oculto', 'title' => 'Oculto', ...$promo, 'visible' => false],
        ['id' => 'pasado', 'title' => 'Pasado', ...$promo, 'starts_on' => '2020-01-01', 'ends_on' => '2020-01-31'],
        ['id' => 'futuro', 'title' => 'Futuro', ...$promo, 'starts_on' => '2099-01-01'],
    ]];
    siteDesignSave($design, $data['lock_version'])->assertOk();
    $this->postJson('/api/v1/admin/site-design/publish')->assertOk();

    expect(array_column($this->getJson('/api/v1/public/site', siteOf())->json('data.design.promos'), 'id'))->toBe(['vigente'])
        ->and(siteDesignDraft()['draft']['promos'])->toHaveCount(4);
});

it('sube imágenes, las sirve en el sitio y no deja borrar las que están en uso', function () {
    Storage::fake((string) config('filesystems.default'));
    actingAsSeed('U01');

    $image = $this->post('/api/v1/admin/site-design/images', ['file' => UploadedFile::fake()->image('portada.jpg', 1600, 900)], ['Accept' => 'application/json'])->assertCreated()->json('data');
    expect($image)->toMatchArray(['name' => 'portada.jpg', 'mime' => 'image/jpeg', 'width' => 1600, 'height' => 900])
        ->and(siteDesignAudit('subir imagen')->after_value)->toBe('portada.jpg');

    $this->get("/api/v1/public/site/images/{$image['id']}", siteOf())->assertOk()->assertHeader('Content-Type', 'image/jpeg');
    $this->get("/api/v1/public/site/images/{$image['id']}", siteOf('selva'))->assertNotFound();

    $data = siteDesignDraft();
    siteDesignSave([...$data['draft'], 'hero' => [...$data['draft']['hero'], 'style' => 'imagen', 'image_id' => $image['id']]], $data['lock_version'])->assertOk();

    expect($this->deleteJson("/api/v1/admin/site-design/images/{$image['id']}"))->toBeApiError(422, 'SITE-BR-05');

    $data = siteDesignDraft();
    siteDesignSave([...$data['draft'], 'hero' => [...$data['draft']['hero'], 'style' => 'noche', 'image_id' => null]], $data['lock_version'])->assertOk();
    $this->deleteJson("/api/v1/admin/site-design/images/{$image['id']}")->assertNoContent();

    $data = siteDesignDraft();
    expect($data['images'])->toBe([])
        ->and(siteDesignSave([...$data['draft'], 'hero' => [...$data['draft']['hero'], 'style' => 'imagen', 'image_id' => $image['id']]], $data['lock_version']))->toBeApiError(422, 'SITE-BR-06');

    expect($this->post('/api/v1/admin/site-design/images', ['file' => UploadedFile::fake()->create('lista.pdf', 20, 'application/pdf')], ['Accept' => 'application/json']))->toBeApiError(422, 'SITE-BR-04');
});

it('el diseño de una agencia no cambia el sitio de otra ni se puede leer desde otra', function () {
    actingAsSeed('U01');
    $data = siteDesignDraft();
    siteDesignSave([...$data['draft'], 'theme' => [...$data['draft']['theme'], 'colors' => 'propios', 'brand' => '#123456'], 'texts' => ['es' => ['header.tagline' => 'Solo Andes']]], $data['lock_version'])->assertOk();
    $this->postJson('/api/v1/admin/site-design/publish')->assertOk();

    expect($this->getJson('/api/v1/public/site', siteOf('selva'))->json('data.design.texts.es'))->toBe([])
        ->and($this->getJson('/api/v1/public/site', siteOf('selva'))->json('data.branding.brand'))->not->toBe('#123456')
        ->and(withinTenant(tenantB(), fn () => DB::table('site_designs')->count()))->toBe(0);

    actingAsTenantBAdmin();
    $other = $this->getJson('/api/v1/admin/site-design');

    if ($other->status() === 200) {
        expect($other->json('data.published'))->toBeNull()->and($other->json('data.draft.texts.es'))->toBe([]);
    } else {
        expect($other->status())->toBe(403);
    }
});

it('solo quien gestiona la configuración edita el sitio y solo con el plan que incluye el sitio web', function () {
    actingAsSeed('U03');
    expect($this->getJson('/api/v1/admin/site-design'))->toBeApiError(403)
        ->and($this->postJson('/api/v1/admin/site-design/publish'))->toBeApiError(403)
        ->and($this->postJson('/api/v1/admin/site-design/discard'))->toBeApiError(403)
        ->and($this->putJson('/api/v1/admin/site-design/draft', []))->toBeApiError(403)
        ->and($this->postJson('/api/v1/admin/site-design/versions/1/restore'))->toBeApiError(403)
        ->and($this->deleteJson('/api/v1/admin/site-design/images/'.Str::uuid()))->toBeApiError(403);

    actingAsSeed('U01');
    siteDesignPlan('starter');

    expect($this->getJson('/api/v1/admin/site-design'))->toBeApiError(403, EnsureFeature::CODE);
    $this->getJson('/api/v1/public/site', siteOf())->assertOk();
});
