<?php

use App\Domain\Shared\Errors\ApiException;
use App\Domain\Tracking\Actions\ConversionWorkflow;
use App\Domain\Tracking\Support\TagScope;
use App\Domain\Tracking\Support\TrackingPlan;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

require_once __DIR__.'/SeguimientoHelpers.php';

beforeEach(fn () => segCleanSlate());

function segCreateTag(array $body = [], string $user = 'U01'): array
{
    actingAsSeed($user);

    return test()->postJson('/api/v1/marketing/tracking/tags', [...['provider' => 'ga4', 'name' => 'Analytics del sitio', 'measurement_id' => 'G-AH7K2M9Q1T'], ...$body], critical())
        ->assertCreated()->json('data');
}

function segScriptBody(array $extra = []): array
{
    return [...[
        'provider' => 'script',
        'name' => 'Widget de reseñas',
        'script_src' => 'https://cdn.resenas.example/widget.js',
        'sri_hash' => 'sha384-oqVuAfXRKap7fdgcCY5uykM6+R9GqQ8K/uxy9rx7HNQlGYl1kPzQho1wx4JwY8wC',
        'csp_domains' => 'cdn.resenas.example, api.resenas.example',
        'consent_category' => 'marketing',
        'submit' => true,
    ], ...$extra];
}

function segPromoteToAdmin(string $code): void
{
    withinTenant(tenantA(), function () use ($code) {
        $user = seedUser($code);
        $role = DB::table('roles')->where('name', 'tenant_admin')->value('id');
        DB::table('model_has_roles')->insertOrIgnore(['role_id' => $role, 'model_type' => $user->getMorphClass(), 'model_id' => $user->getKey()]);
    });
}

it('SEG-02: una etiqueta GA4 queda activa al guardarla y se audita', function () {
    $tag = segCreateTag();

    expect($tag['status'])->toBe('activo')
        ->and($tag['code'])->toStartWith('TAG-')
        ->and($tag['consent_category'])->toBe('analiticas');
    expect(segAudited(['entity' => 'Etiqueta', 'entity_id' => $tag['code'], 'action' => 'crear']))->toBeTrue();

    $list = $this->getJson('/api/v1/marketing/tracking/tags')->assertOk()->json('data');
    expect(collect($list['rows'])->pluck('code'))->toContain($tag['code'])
        ->and($list['kpis']['active'])->toBeGreaterThanOrEqual(1)
        ->and($list['can_approve'])->toBeTrue();
});

it('SEG-02: un ID con formato inválido responde 422 TAG_ID_INVALID y el CHECK lo impide en la base', function () {
    actingAsSeed('U01');

    expect($this->postJson('/api/v1/marketing/tracking/tags', ['provider' => 'ga4', 'name' => 'Universal antiguo', 'measurement_id' => 'UA-12345'], critical()))->toBeApiError(422, 'TAG_ID_INVALID');
    expect(fn () => withinTenant(tenantA(), fn () => DB::table('mkt_tracking_tags')->insert(['code' => 'TAG-9901', 'provider' => 'ga4', 'name' => 'x', 'measurement_id' => 'UA-12345', 'consent_category' => 'analiticas'])))->toThrow(QueryException::class);
});

it('SEG-02: el mismo proveedor e ID dos veces responde 409 TAG_DUPLICATE', function () {
    segCreateTag();

    expect($this->postJson('/api/v1/marketing/tracking/tags', ['provider' => 'ga4', 'name' => 'Duplicada', 'measurement_id' => 'G-AH7K2M9Q1T'], critical()))->toBeApiError(409, 'TAG_DUPLICATE');
});

it('SEG-03: un script externo sin SRI o con eval se rechaza', function () {
    actingAsSeed('U01');

    expect($this->postJson('/api/v1/marketing/tracking/tags', segScriptBody(['sri_hash' => null]), critical()))->toBeApiError(422, 'SCRIPT_SRI_REQUIRED');
    expect($this->postJson('/api/v1/marketing/tracking/tags', segScriptBody(['script_src' => null, 'script_body' => 'eval("alert(1)")']), critical()))->toBeApiError(422, 'SCRIPT_CODE_FORBIDDEN');
    expect(fn () => withinTenant(tenantA(), fn () => DB::table('mkt_tracking_tags')->insert(['code' => 'TAG-9902', 'provider' => 'script', 'name' => 'x', 'script_src' => 'https://x.example/a.js', 'consent_category' => 'marketing'])))->toThrow(QueryException::class);
});

it('SEG-04 y SEG-05: los CHECK impiden un script activo sin aprobación o que cargue en el pago', function () {
    expect(fn () => withinTenant(tenantA(), fn () => DB::table('mkt_tracking_tags')->insert(['code' => 'TAG-9903', 'provider' => 'script', 'name' => 'x', 'script_body' => 'console.log(1)', 'consent_category' => 'marketing', 'status' => 'activo'])))->toThrow(QueryException::class);
    expect(fn () => withinTenant(tenantA(), fn () => DB::table('mkt_tracking_tags')->insert(['code' => 'TAG-9904', 'provider' => 'script', 'name' => 'x', 'script_body' => 'console.log(1)', 'consent_category' => 'marketing', 'exclude_checkout' => false])))->toThrow(QueryException::class);
});

it('SEG-04: el script de un Manager queda en revisión, el Manager no aprueba y el Tenant Admin sí', function () {
    $tag = segCreateTag(segScriptBody(), 'U02');
    expect($tag['status'])->toBe('en_revision');

    $denied = $this->postJson("/api/v1/marketing/tracking/tags/{$tag['code']}/decision", ['decision' => 'aprobar']);
    expect($denied)->toBeApiError(403);
    expect($denied->json('required_permissions'))->toContain('marketing.tracking.approve');

    actingAsSeed('U01');
    $approved = $this->postJson("/api/v1/marketing/tracking/tags/{$tag['code']}/decision", ['decision' => 'aprobar'])->assertOk()->json('data');

    expect($approved['status'])->toBe('activo')->and($approved['approved_by_name'])->not->toBeNull();
    expect(segAudited(['entity' => 'Script propio', 'entity_id' => $tag['code'], 'action' => 'aprobar']))->toBeTrue();
});

it('SEG-04: con dos administradores el autor no aprueba su propio script (403 SCRIPT_SELF_APPROVAL)', function () {
    segPromoteToAdmin('U02');
    $tag = segCreateTag(segScriptBody());

    $response = $this->postJson("/api/v1/marketing/tracking/tags/{$tag['code']}/decision", ['decision' => 'aprobar']);
    expect($response)->toBeApiError(403, 'SCRIPT_SELF_APPROVAL');
    expect($response->json('required_permissions'))->toContain('marketing.tracking.approve');

    actingAsSeed('U02');
    expect($this->postJson("/api/v1/marketing/tracking/tags/{$tag['code']}/decision", ['decision' => 'rechazar', 'reason' => 'corto']))->toBeApiError(422);
    $rejected = $this->postJson("/api/v1/marketing/tracking/tags/{$tag['code']}/decision", ['decision' => 'rechazar', 'reason' => 'El dominio no es del proveedor oficial.'])->assertOk()->json('data');
    expect($rejected['status'])->toBe('rechazado');

    actingAsSeed('U01');
    $fixed = $this->patchJson("/api/v1/marketing/tracking/tags/{$tag['code']}", ['script_src' => 'https://cdn.oficial.example/widget.js', 'csp_domains' => 'cdn.oficial.example'], critical($rejected['lock_version']))->assertOk()->json('data');
    expect($fixed['status'])->toBe('borrador');
    $this->postJson("/api/v1/marketing/tracking/tags/{$tag['code']}/submit")->assertOk()->assertJsonPath('data.status', 'en_revision');
});

it('editar un script activo crea una revisión y el código anterior sigue activo hasta aprobarla', function () {
    $tag = segCreateTag(segScriptBody(), 'U02');
    actingAsSeed('U01');
    $active = $this->postJson("/api/v1/marketing/tracking/tags/{$tag['code']}/decision", ['decision' => 'aprobar'])->assertOk()->json('data');

    actingAsSeed('U02');
    $edited = $this->patchJson("/api/v1/marketing/tracking/tags/{$tag['code']}", ['script_src' => 'https://cdn.resenas.example/widget.v2.js'], critical($active['lock_version']));
    $edited->assertOk()->assertJsonPath('meta.pending_revision', true);
    expect($edited->json('data.status'))->toBe('activo')
        ->and($edited->json('data.script_src'))->toBe('https://cdn.resenas.example/widget.js')
        ->and($edited->json('data.pending_revision.script_src'))->toBe('https://cdn.resenas.example/widget.v2.js');

    actingAsSeed('U01');
    $applied = $this->postJson("/api/v1/marketing/tracking/tags/{$tag['code']}/decision", ['decision' => 'aprobar'])->assertOk()->json('data');
    expect($applied['script_src'])->toBe('https://cdn.resenas.example/widget.v2.js')->and($applied['pending_revision'])->toBeNull();
});

it('pausa, reanuda, verifica, edita con If-Match y elimina con borrado lógico', function () {
    $tag = segCreateTag(['provider' => 'meta_pixel', 'name' => 'Pixel de Meta', 'measurement_id' => '738201945563120']);

    $this->postJson("/api/v1/marketing/tracking/tags/{$tag['code']}/pause")->assertOk()->assertJsonPath('data.status', 'pausado');
    expect($this->postJson("/api/v1/marketing/tracking/tags/{$tag['code']}/verify"))->toBeApiError(409, 'TAG_NOT_ACTIVE');
    $resumed = $this->postJson("/api/v1/marketing/tracking/tags/{$tag['code']}/pause")->assertOk()->json('data');
    expect($resumed['status'])->toBe('activo');

    $this->postJson("/api/v1/marketing/tracking/tags/{$tag['code']}/verify")->assertStatus(202);
    $verified = $this->getJson("/api/v1/marketing/tracking/tags/{$tag['code']}")->assertOk()->json('data');
    expect($verified['verify_result'])->toBe('ok')->and($verified['history'])->not->toBeEmpty();

    expect($this->patchJson("/api/v1/marketing/tracking/tags/{$tag['code']}", ['name' => 'Pixel viejo'], critical($verified['lock_version'] + 5)))->toBeApiError(409);
    $this->patchJson("/api/v1/marketing/tracking/tags/{$tag['code']}", ['name' => 'Pixel de campañas', 'pages' => '/tours/*, /', 'exclude' => '/cuenta/*'], critical($verified['lock_version']))
        ->assertOk()->assertJsonPath('data.name', 'Pixel de campañas')->assertJsonPath('data.exclude', '/cuenta/*');

    $this->deleteJson("/api/v1/marketing/tracking/tags/{$tag['code']}")->assertNoContent();
    $this->getJson("/api/v1/marketing/tracking/tags/{$tag['code']}")->assertNotFound();
    expect(segAudited(['entity' => 'Etiqueta', 'entity_id' => $tag['code'], 'action' => 'eliminar']))->toBeTrue();
    segCreateTag(['provider' => 'meta_pixel', 'name' => 'Pixel nuevo', 'measurement_id' => '738201945563120']);
});

it('mapea conversiones: Google Ads exige la etiqueta de conversión y el mapeo se puede quitar', function () {
    $ads = segCreateTag(['provider' => 'google_ads', 'name' => 'Google Ads · Cusco', 'measurement_id' => 'AW-11872034561']);

    expect($this->putJson("/api/v1/marketing/tracking/conversions/{$ads['code']}/compra", ['provider_event' => 'conversion']))->toBeApiError(422);
    $this->putJson("/api/v1/marketing/tracking/conversions/{$ads['code']}/compra", ['provider_event' => 'conversion', 'conversion_label' => 'kQ3nCPvT9YgZEJ2o', 'send_value' => true])
        ->assertOk()->assertJsonPath('data.conversion_label', 'kQ3nCPvT9YgZEJ2o');
    expect($this->putJson("/api/v1/marketing/tracking/conversions/{$ads['code']}/inventado", ['provider_event' => 'x']))->toBeApiError(404);

    $matrix = $this->getJson('/api/v1/marketing/tracking/conversions')->assertOk()->json('data');
    $column = collect($matrix['tags'])->firstWhere('code', $ads['code']);
    expect($column['mappings']['compra']['provider_event'])->toBe('conversion')->and($matrix['events'])->toHaveCount(10);
    expect(segAudited(['entity' => 'Conversión', 'entity_id' => "{$ads['code']}/compra", 'action' => 'configurar']))->toBeTrue();

    $this->deleteJson("/api/v1/marketing/tracking/conversions/{$ads['code']}/compra")->assertNoContent();
    expect($this->deleteJson("/api/v1/marketing/tracking/conversions/{$ads['code']}/compra"))->toBeApiError(404);
});

it('SEG-07 y SEG-10: el envío del servidor deduplica por event_id, respeta el consentimiento y se reintenta', function () {
    $meta = segCreateTag(['provider' => 'meta_pixel', 'name' => 'Pixel con CAPI', 'measurement_id' => '738201945563120', 'server_side' => true, 'secret' => 'EAAB-token-de-prueba']);
    expect($meta['server_side'])->toBeTrue()->and($meta['secret_saved'])->toBeTrue();
    $this->putJson("/api/v1/marketing/tracking/conversions/{$meta['code']}/compra", ['provider_event' => 'Purchase', 'send_value' => true, 'server_side' => true])->assertOk();

    $event = (string) Str::uuid7();
    $first = withinTenant(tenantA(), fn () => app(ConversionWorkflow::class)->record(TagScope::tenant(), 'compra', $event, '2380.00', 'PEN', true, ['reference' => 'WEB-simular-fallo']));
    $again = withinTenant(tenantA(), fn () => app(ConversionWorkflow::class)->record(TagScope::tenant(), 'compra', $event, '2380.00', 'PEN', true));
    $denied = withinTenant(tenantA(), fn () => app(ConversionWorkflow::class)->record(TagScope::tenant(), 'compra', (string) Str::uuid7(), '100.00', 'PEN', false));

    expect($first[0]['status'])->toBe('fallido')->and($again[0]['status'])->toBe('duplicado')->and($denied[0]['status'])->toBe('sin_consentimiento');

    $dispatches = $this->getJson('/api/v1/marketing/tracking/dispatches?status=fallido')->assertOk()->json('data');
    expect($dispatches['rows'])->toHaveCount(1)->and($dispatches['kpis']['sin_consentimiento'])->toBe(1);
    $failed = $dispatches['rows'][0];

    $this->postJson("/api/v1/marketing/tracking/dispatches/{$failed['id']}/retry")->assertOk()->assertJsonPath('data.status', 'enviado');
    expect($this->postJson("/api/v1/marketing/tracking/dispatches/{$failed['id']}/retry"))->toBeApiError(409, 'DISPATCH_NOT_FAILED');
    expect(segAudited(['entity' => 'Conversión', 'entity_id' => (string) $failed['id'], 'action' => 'reintentar']))->toBeTrue();

    expect(fn () => withinTenant(tenantA(), function () use ($event) {
        $row = DB::table('mkt_conversion_dispatches')->where('event_id', $event)->first();
        DB::table('mkt_conversion_dispatches')->insert(['event_id' => $event, 'mapping_id' => $row->mapping_id, 'internal_event' => 'compra', 'channel' => 'servidor']);
    }))->toThrow(QueryException::class);
});

it('el envío desde el servidor exige el token del proveedor', function () {
    actingAsSeed('U01');

    expect($this->postJson('/api/v1/marketing/tracking/tags', ['provider' => 'meta_pixel', 'name' => 'Sin token', 'measurement_id' => '738201945563121', 'server_side' => true], critical()))->toBeApiError(422);
});

it('TRACKING_PLAN_REQUIRED: Starter solo usa GA4, GTM y Meta sin el complemento Marketing Pro', function () {
    $starter = tenantByCode('TNT-0005');

    withinTenant($starter, function () {
        $plan = app(TrackingPlan::class);
        expect($plan->rank())->toBe(1)->and($plan->allows('ga4'))->toBeTrue()->and($plan->allows('tiktok'))->toBeFalse();
        expect(fn () => $plan->assert('tiktok', false))->toThrow(ApiException::class);
        expect(fn () => $plan->assert('meta_pixel', true))->toThrow(ApiException::class);
    });
});

it('Ventas no gestiona etiquetas y la agencia B no ve las etiquetas de A', function () {
    $tag = segCreateTag();

    actingAsSeed('U03');
    $denied = $this->getJson('/api/v1/marketing/tracking/tags');
    expect($denied)->toBeApiError(403);
    expect($denied->json('required_permissions'))->toContain('marketing.tracking.manage');

    actingAsTenantBAdmin();
    expect(json_encode($this->getJson('/api/v1/marketing/tracking/tags')->assertOk()->json()))->not->toContain('G-AH7K2M9Q1T');
    $this->getJson("/api/v1/marketing/tracking/tags/{$tag['code']}")->assertNotFound();
});
