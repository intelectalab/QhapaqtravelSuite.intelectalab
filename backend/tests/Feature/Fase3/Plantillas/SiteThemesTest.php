<?php

use App\Domain\Platform\Models\Tenant;
use App\Domain\Platform\Support\Entitlements;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;

beforeEach(fn () => lockPlatformBilling());

function plantillasTheme(): array
{
    return test()->getJson('/api/v1/cms/theme')->assertOk()->json('data');
}

function plantillasAudit(string $entity, string $action): ?object
{
    return withinTenant(tenantA(), fn () => DB::table('audit_events')->where(['entity' => $entity, 'action' => $action])->orderByDesc('code')->first());
}

function plantillasPublishedStyle(): string
{
    return (string) test()->getJson('/api/v1/public/site', siteOf())->assertOk()->json('data.design.theme.style');
}

function plantillasMakeAvailable(string $code, string $style = 'andes'): void
{
    $db = DB::connection('pgsql_platform');
    $versionId = $db->table('platform_site_templates')->where('code', $code)->value('current_version_id');
    $manifest = json_decode((string) $db->table('platform_site_template_versions')->where('id', $versionId)->value('manifest'), true);
    $db->table('platform_site_template_versions')->where('id', $versionId)->update(['manifest' => json_encode([...$manifest, 'site_style' => $style])]);
}

function plantillasPlan(string $code): void
{
    $db = DB::connection('pgsql_platform');
    $db->table('tenants')->where('id', tenantA()->getKey())->update(['plan_id' => $db->table('plans')->where('code', $code)->value('id')]);
    plantillasGrantCms(tenantA());
}

function plantillasGrantCms(Tenant $tenant): void
{
    DB::connection('pgsql_platform')->table('feature_overrides')->insert(['tenant_id' => $tenant->getKey(), 'feature_key' => 'module.cms', 'value' => true, 'reason' => 'Prueba de plantillas', 'granted_by' => platformUser()->getKey()]);
    Entitlements::flush();
}

it('la galería muestra las plantillas publicadas; Actual es la activa por defecto y las que no tienen diseño llegan pronto', function () {
    actingAsSeed('U01');

    $gallery = collect($this->getJson('/api/v1/cms/templates')->assertOk()->json('data'))->keyBy('code');

    expect($gallery->keys()->all())->toContain('TPL-ACTUAL', 'TPL-ANDES', 'TPL-INTI', 'TPL-NAZCA')
        ->and($gallery->has('TPL-QHAPAQ'))->toBeFalse()
        ->and($gallery['TPL-ACTUAL'])->toMatchArray(['is_default' => true, 'is_active' => true, 'available' => true, 'site_style' => 'actual'])
        ->and($gallery['TPL-ANDES'])->toMatchArray(['available' => true, 'site_style' => 'andes', 'version' => '3.0.0', 'purchased' => true])
        ->and($gallery['TPL-INTI']['available'])->toBeFalse()
        ->and($gallery['TPL-NAZCA'])->toMatchArray(['tier' => 'premium', 'price' => '290.00', 'purchased' => false])
        ->and($gallery['TPL-ANDES']['lighthouse'])->toMatchArray(['performance' => 94, 'accessibility' => 100]);

    $theme = plantillasTheme();
    expect($theme['active']['template']['code'])->toBe('TPL-ACTUAL')
        ->and($theme['active']['chosen_by'])->toBe('alta')
        ->and($theme['site_style'])->toBe('actual')
        ->and($theme['history'])->toBe([]);

    $detail = $this->getJson('/api/v1/cms/templates/TPL-ANDES')->assertOk()->json('data');
    expect($detail['versions'][0]['version'])->toBe('3.0.0')
        ->and($detail['sections'])->toContain('hero_buscador', 'boletin');
    expect($this->getJson('/api/v1/cms/templates/TPL-QHAPAQ'))->toBeApiError(404);
});

it('TPL-03: la vista previa usa un token propio de 24 h, no se indexa y no cambia el sitio publicado', function () {
    actingAsSeed('U01');

    $preview = $this->postJson('/api/v1/cms/templates/TPL-ANDES/preview')->assertOk()->json('data');

    expect($preview['token'])->toHaveLength(48)
        ->and($preview['site_path'])->toBe('/sitio/andes?preview='.$preview['token']);

    $public = $this->getJson('/api/v1/public/site/theme?preview='.$preview['token'], siteOf());
    $public->assertOk()->assertHeader('X-Robots-Tag', 'noindex, nofollow');
    expect($public->json('data'))->toMatchArray(['site_style' => 'andes', 'preview' => true, 'noindex' => true, 'version' => '3.0.0'])
        ->and($this->getJson('/api/v1/public/site/theme', siteOf())->json('data'))->toMatchArray(['site_style' => 'actual', 'preview' => false])
        ->and(plantillasPublishedStyle())->toBe('actual');

    withinTenant(tenantA(), fn () => DB::table('cms_site_themes')->where('preview_token', $preview['token'])->update(['created_at' => now()->subHours(25)]));
    expect($this->getJson('/api/v1/public/site/theme?preview='.$preview['token'], siteOf())->json('data.preview'))->toBeFalse()
        ->and($this->getJson('/api/v1/public/site/theme', siteOf('selva'))->json('data.preview'))->toBeFalse();
});

it('TPL-02: aplicar otra plantilla cambia el estilo del sitio, deja la anterior en el historial y se puede restaurar', function () {
    actingAsSeed('U01');
    $lock = plantillasTheme()['lock_version'];

    expect($this->putJson('/api/v1/cms/theme', ['template_code' => 'TPL-ANDES']))->toBeApiError(428);
    expect($this->putJson('/api/v1/cms/theme', ['template_code' => 'TPL-ANDES'], ['If-Match' => (string) ($lock + 5)]))->toBeApiError(409);

    $theme = $this->putJson('/api/v1/cms/theme', ['template_code' => 'TPL-ANDES'], ['If-Match' => (string) $lock])->assertOk()->json('data');

    expect($theme['active']['template']['code'])->toBe('TPL-ANDES')
        ->and($theme['active']['chosen_by'])->toBe('agencia')
        ->and($theme['site_style'])->toBe('andes')
        ->and($theme['history'][0])->toMatchArray(['template' => ['code' => 'TPL-ACTUAL', 'name' => 'Actual', 'status' => 'publicado'], 'can_restore' => true])
        ->and(plantillasPublishedStyle())->toBe('andes')
        ->and($this->getJson('/api/v1/admin/site-design')->json('data.draft.theme.style'))->toBe('andes')
        ->and(plantillasAudit('Plantilla del sitio', 'aplicar')->after_value)->toBe('Andes Clásico v3.0.0')
        ->and(withinTenant(tenantA(), fn () => DB::table('cms_site_themes')->where('status', 'activo')->count()))->toBe(1);

    expect($this->putJson('/api/v1/cms/theme', ['template_code' => 'TPL-ANDES'], ['If-Match' => (string) $theme['lock_version']]))->toBeApiError(422, 'THEME_ALREADY_ACTIVE');

    $restored = $this->postJson('/api/v1/cms/theme/restore/'.$theme['history'][0]['id'])->assertOk()->json('data');

    expect($restored['active']['template']['code'])->toBe('TPL-ACTUAL')
        ->and($restored['history'][0]['template']['code'])->toBe('TPL-ANDES')
        ->and(plantillasPublishedStyle())->toBe('actual')
        ->and(plantillasAudit('Plantilla del sitio', 'restaurar'))->not->toBeNull();
    expect($this->postJson('/api/v1/cms/theme/restore/'.$restored['active']['id']))->toBeApiError(422, 'THEME_ALREADY_ACTIVE');
    expect($this->postJson('/api/v1/cms/theme/restore/no-existe'))->toBeApiError(404);
});

it('TPL-02: la base de datos impide dos temas activos para la misma agencia', function () {
    $insert = fn () => withinTenant(tenantA(), function (): void {
        $row = DB::table('cms_site_themes')->where('status', 'activo')->first();
        DB::table('cms_site_themes')->insert(['template_id' => $row->template_id, 'template_version_id' => $row->template_version_id, 'status' => 'activo', 'chosen_by' => 'agencia', 'applied_at' => now()]);
    });

    expect($insert)->toThrow(QueryException::class);
});

it('las plantillas sin diseño propio en el sitio no se previsualizan ni se aplican', function () {
    actingAsSeed('U01');

    expect($this->postJson('/api/v1/cms/templates/TPL-INTI/preview'))->toBeApiError(422, 'TEMPLATE_COMING_SOON');
    expect($this->putJson('/api/v1/cms/theme', ['template_code' => 'TPL-INTI'], ['If-Match' => '1']))->toBeApiError(422, 'TEMPLATE_COMING_SOON');
});

it('TPL-05: no se aplica una plantilla con plan mínimo superior al de la agencia', function () {
    plantillasMakeAvailable('TPL-PACIFICO');
    plantillasPlan('starter');
    actingAsSeed('U01');

    expect($this->putJson('/api/v1/cms/theme', ['template_code' => 'TPL-PACIFICO'], ['If-Match' => (string) plantillasTheme()['lock_version']]))->toBeApiError(422, 'TEMPLATE_PLAN_REQUIRED');
    expect(collect($this->getJson('/api/v1/cms/templates')->json('data'))->firstWhere('code', 'TPL-PACIFICO')['plan_allowed'])->toBeFalse();
});

it('TPL-04: una plantilla premium se compra una sola vez antes de aplicarla', function () {
    plantillasMakeAvailable('TPL-NAZCA');
    actingAsSeed('U01');
    $lock = plantillasTheme()['lock_version'];

    expect($this->putJson('/api/v1/cms/theme', ['template_code' => 'TPL-NAZCA'], ['If-Match' => (string) $lock]))->toBeApiError(422, 'TEMPLATE_PURCHASE_REQUIRED');
    expect($this->postJson('/api/v1/cms/templates/TPL-ANDES/purchase', [], critical()))->toBeApiError(422, 'TEMPLATE_NOT_PREMIUM');

    $this->postJson('/api/v1/cms/templates/TPL-NAZCA/purchase', [], critical())->assertOk()->assertJsonPath('data.price', '290.00');
    expect($this->postJson('/api/v1/cms/templates/TPL-NAZCA/purchase', [], critical()))->toBeApiError(409, 'TEMPLATE_ALREADY_PURCHASED')
        ->and(plantillasAudit('Plantilla del sitio', 'comprar')->after_value)->toBe('PEN 290.00')
        ->and(withinTenant(tenantA(), fn () => DB::table('cms_template_purchases')->value('source')))->toBe('compra');

    $this->putJson('/api/v1/cms/theme', ['template_code' => 'TPL-NAZCA'], ['If-Match' => (string) $lock])->assertOk()->assertJsonPath('data.active.template.code', 'TPL-NAZCA');
});

it('TPL-06: personaliza colores, redondeo y secciones con contraste mínimo y lo refleja en el diseño del sitio', function () {
    actingAsSeed('U01');
    $theme = plantillasTheme();

    expect($this->patchJson('/api/v1/cms/theme/tokens', ['accent' => '#F6D38B'], ['If-Match' => (string) $theme['lock_version']]))->toBeApiError(422, 'THEME_CONTRAST');
    $this->patchJson('/api/v1/cms/theme/tokens', ['radius' => 30], ['If-Match' => (string) $theme['lock_version']])->assertStatus(422)->assertJsonValidationErrors('radius');

    $sections = array_reverse($theme['tokens']['sections']);
    $saved = $this->patchJson('/api/v1/cms/theme/tokens', ['side' => '#0F2747', 'accent' => '#0E5DB5', 'sun' => '#F2B33D', 'radius' => 24, 'sections' => $sections], ['If-Match' => (string) $theme['lock_version']])->assertOk()->json('data');

    expect($saved['tokens'])->toMatchArray(['side' => '#0f2747', 'accent' => '#0e5db5', 'sun' => '#f2b33d', 'radius' => 24])
        ->and($saved['lock_version'])->toBe($theme['lock_version'] + 1)
        ->and(plantillasAudit('Plantilla del sitio', 'personalizar'))->not->toBeNull();

    $public = $this->getJson('/api/v1/public/site', siteOf())->json('data.design');
    expect($public['theme'])->toMatchArray(['colors' => 'propios', 'brand' => '#0e5db5', 'menu' => '#0f2747', 'corners' => 'redondeadas', 'style' => 'actual'])
        ->and($public['sections'][0]['id'])->toBe($sections[0]['id']);
    expect($this->patchJson('/api/v1/cms/theme/tokens', ['radius' => 8], ['If-Match' => (string) $theme['lock_version']]))->toBeApiError(409);
});

it('Ventas no administra la plantilla del sitio', function () {
    actingAsSeed('U03');

    expect($this->getJson('/api/v1/cms/templates'))->toBeApiError(403);
    expect($this->getJson('/api/v1/cms/theme')->json('required_permissions'))->toContain('cms.templates.manage');
});

it('la agencia B no ve el tema ni el historial de la agencia A', function () {
    actingAsSeed('U01');
    $this->putJson('/api/v1/cms/theme', ['template_code' => 'TPL-ANDES'], ['If-Match' => (string) plantillasTheme()['lock_version']])->assertOk();
    plantillasGrantCms(tenantB());
    actingAsTenantBAdmin();

    $theme = plantillasTheme();
    expect($theme['active']['template']['code'])->toBe('TPL-ACTUAL')
        ->and($theme['history'])->toBe([])
        ->and($this->getJson('/api/v1/public/site/theme', siteOf('selva'))->json('data.site_style'))->toBe('actual');
});
