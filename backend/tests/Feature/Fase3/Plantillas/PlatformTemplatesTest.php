<?php

use Illuminate\Support\Facades\DB;

beforeEach(fn () => lockPlatformBilling());

function plantillasTemplateRow(string $code): ?object
{
    return DB::connection('pgsql_platform')->table('platform_site_templates')->where('code', $code)->first();
}

function plantillasPlatformAudit(string $entity, string $id, string $action): ?object
{
    return DB::connection('pgsql_platform')->table('audit_events')->whereNull('tenant_id')->where(['entity' => $entity, 'entity_id' => $id, 'action' => $action])->orderByDesc('occurred_at')->first();
}

function plantillasManifest(array $overrides = []): array
{
    return [
        'id' => 'inti-raymi', 'name' => 'Inti Raymi', 'version' => '1.5.0', 'kipu' => '^2.9', 'category' => 'agencia', 'tier' => 'incluida',
        'author' => ['name' => 'Equipo KipuControl'],
        'tokens' => ['side' => '#7E1526', 'accent' => '#C8102E', 'sun' => '#E3A33B', 'radius' => 18],
        'sections' => ['hero_buscador', 'destinos', 'mas_vendidos'],
        'pages' => ['inicio', 'buscar', 'destino', 'tour', 'carrito', 'checkout', 'blog', 'articulo', 'aventuras', 'contacto', 'legal', 'libro_reclamaciones'],
        'locales' => ['es', 'en', 'pt'], 'darkMode' => true,
        ...$overrides,
    ];
}

it('muestra el catálogo completo con versiones, asignaciones por agencia e indicadores', function () {
    actingAsPlatform();

    $data = $this->getJson('/api/v1/platform/templates')->assertOk()->json('data');
    $templates = collect($data['templates'])->keyBy('code');

    expect($templates->keys()->all())->toContain('TPL-ACTUAL', 'TPL-ANDES', 'TPL-QHAPAQ')
        ->and($templates['TPL-QHAPAQ']['status'])->toBe('en_revision')
        ->and($templates['TPL-ACTUAL']['is_default'])->toBeTrue()
        ->and($templates['TPL-ACTUAL']['lighthouse']['measured'])->toBeFalse()
        ->and($data['kpis'])->toMatchArray(['pending_submissions' => 1, 'available' => 2, 'agencies' => 6])
        ->and(collect($data['assignments'])->firstWhere('tenant.code', 'TNT-0001')['template']['code'])->toBe('TPL-ACTUAL');

    $submissions = $this->getJson('/api/v1/platform/template-submissions')->assertOk()->json();
    expect($submissions['meta']['pending'])->toBe(1)
        ->and(collect($submissions['data'])->firstWhere('code', 'TSB-0005')['reject_reason'])->toContain('Contraste');
});

it('crea una plantilla en borrador, edita tipo y precio, la marca por defecto y la retira', function () {
    actingAsPlatform();

    $created = $this->postJson('/api/v1/platform/templates', ['slug' => 'puna-andina', 'name' => 'Puna Andina', 'description' => 'Altiplano y lagos.', 'category' => 'aventura', 'tier' => 'premium', 'price_once' => 190, 'author_kind' => 'partner', 'author_name' => 'Estudio Wayra', 'tags' => ['Altiplano']])->assertCreated()->json('data');

    expect($created)->toMatchArray(['code' => 'TPL-PUNAANDINA', 'status' => 'borrador', 'price' => '190.00'])
        ->and(plantillasPlatformAudit('Plantilla web', 'TPL-PUNAANDINA', 'crear'))->not->toBeNull();
    expect($this->postJson('/api/v1/platform/templates', ['slug' => 'puna-andina', 'name' => 'Otra', 'description' => 'x', 'category' => 'aventura', 'tier' => 'incluida', 'author_kind' => 'equipo', 'author_name' => 'Equipo']))->toBeApiError(422, 'TEMPLATE_EXISTS');
    expect($this->postJson('/api/v1/platform/templates', ['slug' => 'sin-precio', 'name' => 'Sin precio', 'description' => 'x', 'category' => 'lujo', 'tier' => 'premium', 'author_kind' => 'equipo', 'author_name' => 'Equipo']))->toBeApiError(422, 'TEMPLATE_PRICE');
    expect($this->patchJson('/api/v1/platform/templates/TPL-PUNAANDINA', ['status' => 'publicado']))->toBeApiError(422, 'TEMPLATE_VERSION_UNAVAILABLE');

    $this->patchJson('/api/v1/platform/templates/TPL-INTI', ['tier' => 'premium', 'price_once' => 250, 'min_plan_code' => 'professional'])->assertOk()->assertJsonPath('data.price', '250.00')->assertJsonPath('data.min_plan.code', 'professional');
    expect($this->patchJson('/api/v1/platform/templates/TPL-INTI', ['is_default' => true]))->toBeApiError(422, 'TEMPLATE_DEFAULT');

    $this->patchJson('/api/v1/platform/templates/TPL-ANDES', ['is_default' => true])->assertOk()->assertJsonPath('data.is_default', true);
    expect((bool) plantillasTemplateRow('TPL-ACTUAL')->default_for_new)->toBeFalse()
        ->and(plantillasPlatformAudit('Plantilla web', 'TPL-ANDES', 'por_defecto'))->not->toBeNull();
    expect($this->patchJson('/api/v1/platform/templates/TPL-ANDES', ['status' => 'retirado']))->toBeApiError(422, 'TEMPLATE_DEFAULT');

    $this->patchJson('/api/v1/platform/templates/TPL-CHAKANA', ['status' => 'retirado'])->assertOk()->assertJsonPath('data.status', 'retirado');
    expect(plantillasPlatformAudit('Plantilla web', 'TPL-CHAKANA', 'retirar'))->not->toBeNull();
    $this->patchJson('/api/v1/platform/templates/TPL-CHAKANA', ['status' => 'publicado'])->assertOk()->assertJsonPath('data.status', 'publicado');
});

it('TPL-08: un envío pasa validaciones automáticas y solo se publica con Lighthouse mínimo y revisión visual', function () {
    actingAsPlatform();
    $body = ['template_code' => 'TPL-INTI', 'version' => '1.5.0', 'bundle_path' => 'kipu-site-templates/inti-raymi/inti-raymi-1.5.0.tgz', 'bundle_sha256' => str_repeat('a', 64), 'manifest' => plantillasManifest(), 'lighthouse' => ['performance' => 70, 'accessibility' => 98, 'seo' => 100, 'best_practices' => 96], 'checks' => ['build' => 'ok', 'datos_estructurados' => 'ok', 'seguridad' => 'ok']];

    expect($this->postJson('/api/v1/platform/template-submissions', [...$body, 'version' => '1.4.0'], critical()))->toBeApiError(422, 'TEMPLATE_VERSION_EXISTS');

    $submission = $this->postJson('/api/v1/platform/template-submissions', $body, critical())->assertCreated()->json('data');

    expect($submission['status'])->toBe('validando')
        ->and($submission['checks'])->toMatchArray(['manifest' => 'ok', 'contraste' => 'ok', 'i18n' => 'ok', 'build' => 'ok', 'revision_visual' => 'pendiente'])
        ->and($submission['lighthouse_ok'])->toBeFalse();
    expect($this->postJson("/api/v1/platform/template-submissions/{$submission['code']}/decision", ['decision' => 'aprobar', 'visual_review' => true]))->toBeApiError(422, 'TEMPLATE_LIGHTHOUSE');
    $this->postJson("/api/v1/platform/template-submissions/{$submission['code']}/decision", ['decision' => 'rechazar', 'reason' => 'Lento'])->assertStatus(422)->assertJsonValidationErrors('reason');
    $this->postJson("/api/v1/platform/template-submissions/{$submission['code']}/decision", ['decision' => 'rechazar', 'reason' => 'Rendimiento móvil de 70; el mínimo es 85.'])->assertOk()->assertJsonPath('data.status', 'rechazada');

    $bad = $this->postJson('/api/v1/platform/template-submissions', [...$body, 'version' => '1.6.0', 'manifest' => plantillasManifest(['locales' => ['es'], 'tokens' => ['accent' => '#F6D38B']]), 'lighthouse' => ['performance' => 90, 'accessibility' => 98, 'seo' => 100, 'best_practices' => 96]], critical())->assertCreated()->json('data');
    expect($bad['checks'])->toMatchArray(['contraste' => 'falla', 'i18n' => 'falla']);
    expect($this->postJson("/api/v1/platform/template-submissions/{$bad['code']}/decision", ['decision' => 'aprobar', 'visual_review' => true]))->toBeApiError(422, 'TEMPLATE_CHECKS');
});

it('aprueba el envío TSB-0007 y publica Qhapaq Ñan en la galería', function () {
    actingAsPlatform();

    expect($this->postJson('/api/v1/platform/template-submissions/TSB-0007/decision', ['decision' => 'aprobar']))->toBeApiError(422, 'TEMPLATE_VISUAL_REVIEW');

    $this->postJson('/api/v1/platform/template-submissions/TSB-0007/decision', ['decision' => 'aprobar', 'visual_review' => true])->assertOk()->assertJsonPath('data.status', 'aprobada')->assertJsonPath('data.checks.revision_visual', 'ok');

    $template = plantillasTemplateRow('TPL-QHAPAQ');
    expect($template->status)->toBe('publicado')
        ->and(DB::connection('pgsql_platform')->table('platform_site_template_versions')->where('id', $template->current_version_id)->value('status'))->toBe('publicada')
        ->and(plantillasPlatformAudit('Envío de plantilla', 'TSB-0007', 'aprobar'))->not->toBeNull();
    expect($this->postJson('/api/v1/platform/template-submissions/TSB-0007/decision', ['decision' => 'rechazar', 'reason' => 'Ya no corresponde revisar']))->toBeApiError(422, 'SUBMISSION_DECIDED');
});

it('TPL-07: el Super Admin asigna una plantilla a una agencia y la premium queda como cortesía', function () {
    actingAsPlatform();

    expect($this->postJson('/api/v1/platform/tenants/TNT-0002/theme', ['template_code' => 'TPL-INTI']))->toBeApiError(422, 'TEMPLATE_COMING_SOON');
    expect($this->postJson('/api/v1/platform/tenants/TNT-9999/theme', ['template_code' => 'TPL-ANDES']))->toBeApiError(404);

    $result = $this->postJson('/api/v1/platform/tenants/TNT-0002/theme', ['template_code' => 'TPL-ANDES', 'note' => 'Alta asistida'])->assertOk()->json('data');

    expect($result['tenant']['code'])->toBe('TNT-0002')
        ->and($result['theme'])->toMatchArray(['template' => 'TPL-ANDES', 'site_style' => 'andes']);

    [$theme, $published, $previous] = withinTenant(tenantB(), fn () => [
        DB::table('cms_site_themes')->where('status', 'activo')->first(),
        json_decode((string) DB::table('site_designs')->value('published'), true),
        DB::table('cms_site_themes')->where('status', 'anterior')->count(),
    ]);
    expect($theme->chosen_by)->toBe('admin_plataforma')
        ->and($published['theme']['style'])->toBe('andes')
        ->and($previous)->toBe(1)
        ->and(plantillasPlatformAudit('Plantilla web', 'TPL-ANDES', 'asignar')->before_value)->toBe('TNT-0002');
});

it('edita precio, créditos y estado de los paquetes de IA', function () {
    actingAsPlatform();

    expect(collect($this->getJson('/api/v1/platform/ai/packs')->assertOk()->json('data'))->pluck('code'))->toContain('IA-PRO', 'IA-IMG-60');

    $this->patchJson('/api/v1/platform/ai/packs/IA-IMG-60', ['price' => 89, 'credits' => 70])->assertOk()->assertJsonPath('data.price', '89.00')->assertJsonPath('data.credits', 70);
    $this->patchJson('/api/v1/platform/ai/packs/IA-IMG-60', ['active' => false])->assertOk()->assertJsonPath('data.active', false);
    expect(plantillasPlatformAudit('Paquete de IA', 'IA-IMG-60', 'desactivar'))->not->toBeNull();
    expect($this->patchJson('/api/v1/platform/ai/packs/IA-IMG-60', []))->toBeApiError(422, 'AI_PACK_EMPTY');
    $this->patchJson('/api/v1/platform/ai/packs/IA-IMG-60', ['credits' => 0])->assertStatus(422)->assertJsonValidationErrors('credits');
});

it('solo la consola de plataforma administra el catálogo', function () {
    actingAsSeed('U01');

    expect($this->getJson('/api/v1/platform/templates'))->toBeApiError(403);
});
