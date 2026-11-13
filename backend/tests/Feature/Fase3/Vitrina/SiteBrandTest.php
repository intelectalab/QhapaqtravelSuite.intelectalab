<?php

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

beforeEach(fn () => lockShowcase());

if (! function_exists('vitrinaTenantAudit')) {
    function vitrinaTenantAudit(array $where): bool
    {
        return withinTenant(tenantA(), fn () => DB::table('audit_events')->where($where)->exists());
    }
}

it('agrega un dominio con sus registros TXT y CNAME, lo verifica y emite el SSL', function () {
    actingAsSeed('U02');

    $domain = $this->postJson('/api/v1/cms/domains', ['host' => 'Tours.AndesHorizonte.pe', 'purpose' => 'reservas'])->assertOk()->json('data');
    expect($domain['host'])->toBe('tours.andeshorizonte.pe')
        ->and(collect($domain['dns'])->pluck('type')->all())->toBe(['TXT', 'CNAME']);

    $this->postJson("/api/v1/cms/domains/{$domain['id']}/verify")->assertOk()->assertJsonPath('data.status', 'verificado')->assertJsonPath('data.ssl_status', 'emitido');
    $row = withinTenant(tenantA(), fn () => DB::table('cms_site_domains')->where('id', $domain['id'])->first());

    expect($row->verified_at)->not->toBeNull()->and($row->ssl_expires_at)->not->toBeNull()
        ->and(vitrinaTenantAudit(['entity' => 'Dominio', 'entity_id' => 'tours.andeshorizonte.pe', 'action' => 'verificar']))->toBeTrue();
    expect($this->postJson("/api/v1/cms/domains/{$domain['id']}/verify"))->toBeApiError(409, 'VT-11');
});

it('VT-11: un dominio sin DNS queda en error, un host pertenece a una sola agencia y retirar lo libera', function () {
    withinTenant(tenantB(), fn () => DB::table('cms_site_domains')->insert(['id' => (string) Str::uuid7(), 'tenant_id' => tenantB()->getKey(), 'host' => 'www.selvaviva.pe', 'verify_token' => 'tok-selva']));
    actingAsSeed('U01');
    expect($this->postJson('/api/v1/cms/domains', ['host' => 'www.selvaviva.pe']))->toBeApiError(409, 'VT-11');

    $failing = $this->postJson('/api/v1/cms/domains', ['host' => 'sin-dns.andeshorizonte.pe'])->assertOk()->json('data.id');
    $this->postJson("/api/v1/cms/domains/{$failing}/verify")->assertOk()->assertJsonPath('data.status', 'error');
    expect(withinTenant(tenantA(), fn () => DB::table('cms_site_domains')->where('id', $failing)->value('last_error')))->toContain('kipu-verify=');

    $this->deleteJson("/api/v1/cms/domains/{$failing}")->assertNoContent();
    expect($this->deleteJson("/api/v1/cms/domains/{$failing}"))->toBeApiError(409, 'VT-11');
    $this->postJson('/api/v1/cms/domains', ['host' => 'sin-dns.andeshorizonte.pe'])->assertOk();
});

it('editar el SEO de una página recalcula el puntaje y la reauditoría suma las historias publicadas', function () {
    actingAsSeed('U02');
    $pages = collect($this->getJson('/api/v1/cms/seo/pages')->assertOk()->json('data.items'));
    $weak = $pages->firstWhere('path', '/ofertas-old');

    $result = $this->patchJson("/api/v1/cms/seo/pages/{$weak['id']}", ['title' => 'Ofertas de tours por el Perú con precio web', 'meta_description' => 'Descuentos vigentes en tours y paquetes por el Perú, con disponibilidad en línea y pago seguro.', 'focus_keyword' => 'ofertas tours perú', 'schema_types' => ['OfferCatalog'], 'canonical_url' => '/ofertas'])->assertOk()->json('data');
    expect($result['score'])->toBeGreaterThan($weak['score'])
        ->and(vitrinaTenantAudit(['entity' => 'SEO', 'entity_id' => '/ofertas-old', 'action' => 'editar']))->toBeTrue();

    $audit = $this->postJson('/api/v1/cms/seo/audit')->assertOk()->json('data');
    expect($audit['pages'])->toBeGreaterThan($pages->count() - 1)
        ->and(collect($this->getJson('/api/v1/cms/seo/pages')->json('data.items'))->pluck('path'))->toContain('/aventuras/familia-rios-peru-clasico');
});

it('las redirecciones no forman cadenas y se desactivan sin borrarse', function () {
    actingAsSeed('U02');

    expect($this->postJson('/api/v1/cms/redirects', ['from_path' => '/promo', 'to_path' => '/ofertas-old']))->toBeApiError(422, 'VT-REDIRECT-CHAIN');
    expect($this->postJson('/api/v1/cms/redirects', ['from_path' => '/ofertas-old', 'to_path' => '/nuevas']))->toBeApiError(409, 'VT-REDIRECT');

    $created = $this->postJson('/api/v1/cms/redirects', ['from_path' => '/paquetes-2025', 'to_path' => '/paquetes', 'code' => 301])->assertOk()->json('data');
    $this->deleteJson("/api/v1/cms/redirects/{$created['id']}")->assertNoContent();

    $list = collect($this->getJson('/api/v1/cms/redirects')->assertOk()->json('data.items'));
    expect($list->firstWhere('id', $created['id'])['active'])->toBeFalse()
        ->and(vitrinaTenantAudit(['entity' => 'Redirección', 'entity_id' => '/paquetes-2025', 'action' => 'desactivar']))->toBeTrue();
});

it('sin cms.seo.manage el dominio y el SEO responden 403', function () {
    actingAsSeed('U07');

    expect($this->getJson('/api/v1/cms/domains'))->toBeApiError(403)
        ->and($this->getJson('/api/v1/cms/seo/pages')->json('required_permissions'))->toContain('cms.seo.manage');
});
