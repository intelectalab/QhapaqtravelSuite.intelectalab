<?php

use App\Domain\Help\Actions\PlatformHelpArticles;
use App\Domain\Platform\Support\Entitlements;
use Database\Seeders\HelpArticleSeeder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

function helpSeeded(string $slug): object
{
    return withinTenant(tenantA(), fn () => DB::table('help_articles')->whereNull('tenant_id')->where('slug', $slug)->first());
}

function helpBody(array $overrides = []): array
{
    return [
        'title' => 'Política de reembolsos de la agencia',
        'module' => 'Ventas',
        'screen' => '/reservas',
        'summary' => 'Cómo aplicamos los reembolsos cuando un cliente cancela su viaje.',
        'steps' => [['title' => 'Revisa la penalidad', 'text' => 'Abre la reserva y mira la penalidad calculada antes de cancelar.']],
        'faqs' => [['question' => '¿Quién aprueba el reembolso?', 'answer' => 'La gerencia, desde la bandeja de aprobaciones.']],
        'keywords' => ['reembolso', 'devolución'],
        'roles' => [],
        ...$overrides,
    ];
}

function helpOwn(string $slug): ?object
{
    return withinTenant(tenantA(), fn () => DB::table('help_articles')->whereNotNull('tenant_id')->where('slug', $slug)->first());
}

function helpSlugs(string $query = ''): array
{
    return collect(test()->getJson('/api/v1/help/articles'.$query)->assertOk()->json('data.articles'))->pluck('slug')->all();
}

function helpAudit(string $slug, string $action): bool
{
    return withinTenant(tenantA(), fn () => DB::table('audit_events')->where(['entity' => 'Artículo de ayuda', 'entity_id' => $slug, 'action' => $action])->exists());
}

function helpPlatformAudit(string $slug, string $action): bool
{
    return DB::connection('pgsql_platform')->table('audit_events')->whereNull('tenant_id')->where(['entity' => 'Artículo de ayuda', 'entity_id' => $slug, 'action' => $action])->exists();
}

it('el contenido sembrado es válido, sin slugs repetidos, y cubre cada pantalla del menú', function () {
    $articles = collect(HelpArticleSeeder::articles());
    $screens = $articles->where('audience', 'agency')->pluck('screen');
    $console = $articles->where('audience', 'platform')->pluck('screen');
    $menu = collect(config('access.routes'))->keys()->reject(fn (string $path): bool => in_array($path, ['/crm', '/catalogo', '/finanzas', '/admin', '/mobile', '/libro-reclamaciones', '/operaciones', '/marketing', '/catalogo/categorias'], true));

    expect($articles->pluck('slug')->duplicates()->all())->toBe([])
        ->and($articles->every(fn (array $a): bool => preg_match('/^\/[a-z0-9\/_-]*$/', $a['screen']) === 1 && trim($a['title']) !== '' && mb_strlen($a['summary']) >= 10 && count($a['steps']) >= 1 && count($a['faqs']) >= 1))->toBeTrue()
        ->and($menu->reject(fn (string $path): bool => $screens->contains(fn (string $screen): bool => $screen === $path || str_starts_with($screen, $path.'/')))->values()->all())->toBe([])
        ->and($console)->toContain('/plataforma/agencias')
        ->and(DB::connection('pgsql_platform')->table('help_articles')->whereNull('tenant_id')->count())->toBe($articles->count());
});

it('la ayuda de la pantalla actual elige el artículo de la ruta más específica', function () {
    actingAsSeed('U01');
    $detail = $this->postJson('/api/v1/help/articles', helpBody(['title' => 'Ficha del cliente CLI-0001', 'screen' => '/crm/clientes/cli-0001', 'module' => 'Comercial · CRM']), critical())->assertCreated()->json('data.slug');

    $onDetail = $this->getJson('/api/v1/help/screen?path=/crm/clientes/cli-0001?tab=reservas')->assertOk()->json('data');
    $onList = $this->getJson('/api/v1/help/screen?path=/crm/clientes/')->assertOk()->json('data');
    $onOther = $this->getJson('/api/v1/help/screen?path=/crm/clientes/cli-0002')->assertOk()->json('data');

    expect($onDetail['path'])->toBe('/crm/clientes/cli-0001')
        ->and($onDetail['article']['slug'])->toBe($detail)
        ->and($onDetail['article']['steps'])->toHaveCount(1)
        ->and($onList['article']['slug'])->toBe('crm-clientes')
        ->and($onList['article']['faqs'])->not->toBeEmpty()
        ->and($onOther['article']['slug'])->toBe('crm-clientes')
        ->and($this->getJson('/api/v1/help/screen?path=/pantalla-inexistente')->assertOk()->json('data.article'))->toBeNull()
        ->and($this->getJson('/api/v1/help/screen'))->toBeApiError(422);
});

it('cada rol ve solo la ayuda de sus pantallas, de su rol y de los módulos de su plan', function () {
    actingAsSeed('U01');
    $finance = $this->postJson('/api/v1/help/articles', helpBody(['title' => 'Cierre de caja para finanzas', 'screen' => '/dashboard', 'module' => 'General', 'roles' => ['finance']]), critical())->assertCreated()->json('data.slug');
    expect(helpSlugs())->toContain('admin-usuarios')->toContain('marketing-campanas')->toContain($finance);

    actingAsSeed('U03');
    expect(helpSlugs())->not->toContain('admin-usuarios')->not->toContain($finance)->toContain('crm-clientes')
        ->and($this->getJson('/api/v1/help/articles/admin-usuarios'))->toBeApiError(404)
        ->and($this->getJson('/api/v1/help/articles')->json('data.can_manage'))->toBeFalse()
        ->and($this->getJson('/api/v1/help/screen?path=/admin/usuarios')->json('data.article'))->toBeNull();

    actingAsSeed('U07');
    expect(helpSlugs())->toContain($finance);

    DB::connection('pgsql_platform')->table('feature_overrides')->insert(['tenant_id' => tenantA()->getKey(), 'feature_key' => 'module.marketing_campaigns', 'value' => false, 'reason' => 'Prueba de ayuda por plan', 'valid_until' => Carbon::today()->addDays(30)->toDateString(), 'granted_by' => platformUser()->getKey()]);
    Entitlements::flush();

    actingAsSeed('U01');
    expect(helpSlugs())->not->toContain('marketing-campanas');
});

it('busca sin importar tildes ni mayúsculas y filtra por módulo', function () {
    actingAsSeed('U01');
    $slug = $this->postJson('/api/v1/help/articles', helpBody(['title' => 'Conciliación de depósitos en dólares', 'module' => 'Finanzas', 'screen' => '/finanzas/conciliacion', 'keywords' => ['extracto']]), critical())->assertCreated()->json('data.slug');

    $module = $this->getJson('/api/v1/help/articles?module='.urlencode('Comercial · CRM'))->assertOk()->json('data');

    expect(helpSlugs('?q=CONCILIACION%20dolares%20extracto')[0])->toBe($slug)
        ->and(helpSlugs('?q=zzzz-sin-resultados'))->toBe([])
        ->and(collect($module['articles'])->pluck('module')->unique()->values()->all())->toBe(['Comercial · CRM'])
        ->and(collect($module['modules'])->pluck('module'))->toContain('Finanzas');
});

it('la administración crea un artículo propio, lo audita y valida el contenido', function () {
    actingAsSeed('U01');

    $created = $this->postJson('/api/v1/help/articles', helpBody(), critical())->assertCreated()->json('data');
    $again = $this->postJson('/api/v1/help/articles', helpBody(), critical())->assertCreated()->json('data');

    expect($created['slug'])->toBe('politica-de-reembolsos-de-la-agencia')
        ->and($created['origin'])->toBe('propio')
        ->and($created['has_original'])->toBeFalse()
        ->and($created['keywords'])->toBe(['reembolso', 'devolución'])
        ->and($again['slug'])->toBe('politica-de-reembolsos-de-la-agencia-2')
        ->and(helpOwn($created['slug'])->tenant_id)->toBe(tenantA()->getKey())
        ->and(helpAudit($created['slug'], 'crear'))->toBeTrue()
        ->and(helpSlugs('?q=reembolso'))->toContain($created['slug']);

    $this->postJson('/api/v1/help/articles', helpBody(['title' => 'x', 'screen' => 'reservas', 'steps' => [['title' => '']], 'roles' => ['customer']]), critical())->assertStatus(422)->assertJsonValidationErrors(['title', 'screen', 'steps.0.title', 'steps.0.text', 'roles.0']);

    actingAsTenantBAdmin();
    expect($this->getJson("/api/v1/help/articles/{$created['slug']}"))->toBeApiError(404);
});

it('ventas no puede crear, editar, archivar ni restaurar artículos', function () {
    actingAsSeed('U03');

    expect($this->postJson('/api/v1/help/articles', helpBody(), critical()))->toBeApiError(403)
        ->and($this->putJson('/api/v1/help/articles/crm-clientes', helpBody(), critical(0)))->toBeApiError(403)
        ->and($this->postJson('/api/v1/help/articles/crm-clientes/archive', [], critical(0)))->toBeApiError(403)
        ->and($this->postJson('/api/v1/help/articles/crm-clientes/restore', [], critical(0)))->toBeApiError(403)
        ->and($this->deleteJson('/api/v1/help/articles/crm-clientes/adaptation', [], critical()))->toBeApiError(403);
});

it('editar un artículo de KipuControl crea la versión de la agencia sin tocar la original y exige la versión', function () {
    $global = helpSeeded('crm-clientes');
    actingAsSeed('U01');
    $body = helpBody(['title' => 'Clientes en nuestra agencia', 'screen' => '/crm/clientes', 'module' => 'Comercial · CRM']);

    expect($this->putJson('/api/v1/help/articles/crm-clientes', $body, critical()))->toBeApiError(428, 'IF_MATCH_REQUIRED')
        ->and($this->putJson('/api/v1/help/articles/crm-clientes', $body, critical(99)))->toBeApiError(409, 'STALE_VERSION');

    $adapted = $this->putJson('/api/v1/help/articles/crm-clientes', $body, critical((int) $global->lock_version))->assertOk()->json('data');

    expect($adapted['origin'])->toBe('adaptado')
        ->and($adapted['title'])->toBe('Clientes en nuestra agencia')
        ->and($adapted['has_original'])->toBeTrue()
        ->and(helpSeeded('crm-clientes')->title)->toBe($global->title)
        ->and(helpAudit('crm-clientes', 'adaptar'))->toBeTrue()
        ->and($this->putJson('/api/v1/help/articles/crm-clientes', $body, critical($adapted['lock_version'])))->toBeApiError(422, 'CFG-BR-01');

    $edited = $this->putJson('/api/v1/help/articles/crm-clientes', [...$body, 'summary' => 'Resumen propio de la agencia para sus clientes.'], critical($adapted['lock_version']))->assertOk()->json('data');
    expect($edited['lock_version'])->toBe($adapted['lock_version'] + 1)
        ->and($edited['summary'])->toBe('Resumen propio de la agencia para sus clientes.')
        ->and(helpAudit('crm-clientes', 'editar'))->toBeTrue()
        ->and($this->getJson('/api/v1/help/screen?path=/crm/clientes')->json('data.article.title'))->toBe('Clientes en nuestra agencia');

    actingAsTenantBAdmin();
    expect($this->getJson('/api/v1/help/articles/crm-clientes')->assertOk()->json('data.title'))->toBe($global->title);
});

it('archivar oculta el artículo, reactivar lo devuelve y la versión de KipuControl se puede restaurar', function () {
    $global = helpSeeded('crm-leads');
    actingAsSeed('U01');

    $archived = $this->postJson('/api/v1/help/articles/crm-leads/archive', [], critical((int) $global->lock_version))->assertOk()->json('data');

    expect($archived['status'])->toBe('archived')
        ->and(helpOwn('crm-leads')->status)->toBe('archived')
        ->and(helpAudit('crm-leads', 'archivar'))->toBeTrue()
        ->and(helpSlugs())->not->toContain('crm-leads')
        ->and(helpSlugs('?status=archived'))->toContain('crm-leads')
        ->and($this->postJson('/api/v1/help/articles/crm-leads/archive', [], critical($archived['lock_version'])))->toBeApiError(409, 'HLP-BR-02');

    actingAsSeed('U03');
    expect($this->getJson('/api/v1/help/articles/crm-leads'))->toBeApiError(404)
        ->and($this->getJson('/api/v1/help/screen?path=/crm/leads')->json('data.article'))->toBeNull();

    actingAsSeed('U01');
    $restored = $this->postJson('/api/v1/help/articles/crm-leads/restore', [], critical($archived['lock_version']))->assertOk()->json('data');
    expect($restored['status'])->toBe('published')
        ->and(helpAudit('crm-leads', 'reactivar'))->toBeTrue()
        ->and($this->postJson('/api/v1/help/articles/crm-leads/restore', [], critical($restored['lock_version'])))->toBeApiError(409, 'HLP-BR-03');

    $original = $this->deleteJson('/api/v1/help/articles/crm-leads/adaptation', [], critical())->assertOk()->json('data');
    expect($original['origin'])->toBe('kipucontrol')
        ->and(helpOwn('crm-leads'))->toBeNull()
        ->and(helpAudit('crm-leads', 'restaurar_original'))->toBeTrue()
        ->and($this->deleteJson('/api/v1/help/articles/crm-leads/adaptation', [], critical()))->toBeApiError(409, 'HLP-BR-04');
});

it('un artículo propio no tiene versión de KipuControl que restaurar y uno inexistente responde 404', function () {
    actingAsSeed('U01');
    $slug = $this->postJson('/api/v1/help/articles', helpBody(), critical())->assertCreated()->json('data.slug');

    expect($this->deleteJson("/api/v1/help/articles/{$slug}/adaptation", [], critical()))->toBeApiError(409, 'HLP-BR-04')
        ->and($this->putJson('/api/v1/help/articles/no-existe', helpBody(), critical(0)))->toBeApiError(404)
        ->and($this->postJson('/api/v1/help/articles/no-existe/archive', [], critical(0)))->toBeApiError(404);
});

it('la plataforma crea, edita, archiva y reactiva los artículos de KipuControl', function () {
    actingAsPlatform();

    $created = $this->postJson('/api/v1/platform/help/articles', [...helpBody(['title' => 'Cómo leer el panel de control', 'screen' => '/dashboard', 'module' => 'General']), 'audience' => 'agency'], critical())->assertCreated()->json('data');
    $slug = $created['slug'];

    expect($slug)->toBe('como-leer-el-panel-de-control')
        ->and(DB::connection('pgsql_platform')->table('help_articles')->where('slug', $slug)->value('tenant_id'))->toBeNull()
        ->and(helpPlatformAudit($slug, 'crear'))->toBeTrue()
        ->and(collect($this->getJson('/api/v1/platform/help/articles?audience=agency&q=panel')->assertOk()->json('data.articles'))->pluck('slug'))->toContain($slug);

    $this->postJson('/api/v1/platform/help/articles', helpBody(), critical())->assertStatus(422)->assertJsonValidationErrors(['audience']);

    expect($this->putJson("/api/v1/platform/help/articles/{$slug}", helpBody(['title' => 'Cómo leer el panel']), critical()))->toBeApiError(428, 'IF_MATCH_REQUIRED')
        ->and($this->putJson("/api/v1/platform/help/articles/{$slug}", helpBody(['title' => 'Cómo leer el panel']), critical(5)))->toBeApiError(409, 'STALE_VERSION');
    $edited = $this->putJson("/api/v1/platform/help/articles/{$slug}", helpBody(['title' => 'Cómo leer el panel', 'screen' => '/dashboard', 'module' => 'General']), critical($created['lock_version']))->assertOk()->json('data');
    expect($edited['title'])->toBe('Cómo leer el panel')->and(helpPlatformAudit($slug, 'editar'))->toBeTrue();

    $archived = $this->postJson("/api/v1/platform/help/articles/{$slug}/archive", [], critical($edited['lock_version']))->assertOk()->json('data');
    expect($archived['status'])->toBe('archived')
        ->and(helpPlatformAudit($slug, 'archivar'))->toBeTrue()
        ->and(collect($this->getJson('/api/v1/platform/help/articles')->json('data.articles'))->pluck('slug'))->not->toContain($slug)
        ->and($this->postJson("/api/v1/platform/help/articles/{$slug}/archive", [], critical($archived['lock_version'])))->toBeApiError(409, 'HLP-BR-02');

    $restored = $this->postJson("/api/v1/platform/help/articles/{$slug}/restore", [], critical($archived['lock_version']))->assertOk()->json('data');
    expect($restored['status'])->toBe('published')
        ->and(helpPlatformAudit($slug, 'reactivar'))->toBeTrue()
        ->and($this->postJson("/api/v1/platform/help/articles/{$slug}/restore", [], critical($restored['lock_version'])))->toBeApiError(409, 'HLP-BR-03')
        ->and($this->getJson('/api/v1/platform/help/articles/no-existe'))->toBeApiError(404);
});

it('la consola tiene su propia ayuda por pantalla y cuenta las agencias que adaptaron cada artículo', function () {
    actingAsSeed('U01');
    $this->postJson('/api/v1/help/articles/crm-clientes/archive', [], critical((int) helpSeeded('crm-clientes')->lock_version))->assertOk();
    expect(helpSlugs())->not->toContain('plataforma-agencias');

    actingAsPlatform();
    $screen = $this->getJson('/api/v1/platform/help/screen?path=/plataforma/agencias/TNT-0001')->assertOk()->json('data');
    $counts = withPlatformSeeingTenant(fn () => collect(app(PlatformHelpArticles::class)->index(['status' => 'all'])['articles'])->pluck('adaptations', 'slug'));

    expect($screen['article']['slug'])->toBe('plataforma-agencias')
        ->and($screen['article']['audience'])->toBe('platform')
        ->and($counts['crm-clientes'])->toBe(1)
        ->and($counts['crm-leads'])->toBe(0);
});
