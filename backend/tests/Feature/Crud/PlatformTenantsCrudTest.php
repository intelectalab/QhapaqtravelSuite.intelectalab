<?php

use Illuminate\Support\Facades\DB;

beforeEach(fn () => lockPlatformBilling());

function platTenant(string $code): object
{
    return DB::connection('pgsql_platform')->table('tenants')->where('code', $code)->first();
}

function platTenantBody(string $code, array $overrides = []): array
{
    $tenant = platTenant($code);

    return [
        'commercial_name' => $tenant->commercial_name,
        'legal_name' => $tenant->legal_name,
        'ruc' => $tenant->ruc,
        'fiscal_address' => $tenant->fiscal_address,
        'business_type' => $tenant->business_type,
        'subdomain' => $tenant->subdomain,
        ...$overrides,
    ];
}

function platTenantVersion(string $code): array
{
    return ['If-Match' => (string) platTenant($code)->lock_version];
}

it('validate-step valida por partes el alta sin crear nada', function () {
    actingAsPlatform();
    $before = DB::connection('pgsql_platform')->table('tenants')->count();

    $this->postJson('/api/v1/platform/tenants/validate-step', ['commercial_name' => 'Inka Rutas', 'subdomain' => 'Inka-Rutas', 'ruc' => '20123456789'])
        ->assertOk()->assertJsonPath('data.valid', true);
    $this->postJson('/api/v1/platform/tenants/validate-step', [])->assertOk()->assertJsonPath('data.valid', true);

    expect(DB::connection('pgsql_platform')->table('tenants')->count())->toBe($before);
});

it('validate-step rechaza el subdominio, el RUC y el correo del administrador ya usados', function (array $body, string $code) {
    actingAsPlatform();

    expect($this->postJson('/api/v1/platform/tenants/validate-step', $body))->toBeApiError(422, $code);
})->with([
    'subdominio' => [['subdomain' => 'ANDES'], 'TEN-BR-01'],
    'RUC' => [['ruc' => '20609876543'], 'TEN-BR-02'],
    'correo' => [['admin_email' => 'MQUISPE@andeshorizonte.pe'], 'TEN-BR-03'],
]);

it('validate-step aplica el formato de cada campo', function (array $body, string $field) {
    actingAsPlatform();

    $this->postJson('/api/v1/platform/tenants/validate-step', $body)->assertStatus(422)->assertJsonValidationErrors($field);
})->with([
    'RUC corto' => [['ruc' => '2061123'], 'ruc'],
    'RUC con prefijo inválido' => [['ruc' => '30611234567'], 'ruc'],
    'subdominio con espacios' => [['subdomain' => 'mi agencia'], 'subdomain'],
    'tipo de negocio' => [['business_type' => 'Aerolínea'], 'business_type'],
    'correo' => [['admin_email' => 'sin-arroba'], 'admin_email'],
]);

it('edita los datos de la agencia con If-Match, sube su versión y lo audita', function () {
    actingAsPlatform();
    $version = (int) platTenant('TNT-0002')->lock_version;

    $this->patchJson('/api/v1/platform/tenants/TNT-0002', platTenantBody('TNT-0002', ['commercial_name' => 'Selva Viva Expediciones', 'subdomain' => 'SelvaViva', 'business_type' => 'Agencia mayorista']), platTenantVersion('TNT-0002'))
        ->assertOk();
    $tenant = platTenant('TNT-0002');

    expect($tenant->commercial_name)->toBe('Selva Viva Expediciones')
        ->and($tenant->subdomain)->toBe('selvaviva')
        ->and($tenant->business_type)->toBe('Agencia mayorista')
        ->and((int) $tenant->lock_version)->toBe($version + 1)
        ->and(DB::connection('pgsql_platform')->table('audit_events')->whereNull('tenant_id')->where(['entity' => 'Tenant', 'entity_id' => 'TNT-0002', 'action' => 'editar'])->value('after_value'))
        ->toBe('Nombre comercial, Tipo de negocio, Subdominio');
    expect(collect($this->getJson('/api/v1/platform/tenants')->assertOk()->json('data'))->firstWhere('code', 'TNT-0002'))->toMatchArray(['code' => 'TNT-0002'])
        ->and(json_encode($this->getJson('/api/v1/platform/tenants/TNT-0002')->json('data'), JSON_UNESCAPED_UNICODE))->toContain('Selva Viva Expediciones');
});

it('la edición exige If-Match y rechaza una versión vieja', function () {
    actingAsPlatform();
    $stale = platTenantVersion('TNT-0002');

    $this->patchJson('/api/v1/platform/tenants/TNT-0002', platTenantBody('TNT-0002', ['commercial_name' => 'Sin versión']))->assertStatus(428);
    $this->patchJson('/api/v1/platform/tenants/TNT-0002', platTenantBody('TNT-0002', ['commercial_name' => 'Primera']), $stale)->assertOk();

    expect($this->patchJson('/api/v1/platform/tenants/TNT-0002', platTenantBody('TNT-0002', ['commercial_name' => 'Segunda']), $stale)->status())->toBe(409);
    expect(platTenant('TNT-0002')->commercial_name)->toBe('Primera');
});

it('TEN-BR-01/02: la edición no toma el subdominio ni el RUC de otra agencia', function (array $overrides, string $code) {
    actingAsPlatform();
    $before = platTenant('TNT-0002');

    expect($this->patchJson('/api/v1/platform/tenants/TNT-0002', platTenantBody('TNT-0002', $overrides), platTenantVersion('TNT-0002')))->toBeApiError(422, $code);
    expect(platTenant('TNT-0002')->subdomain)->toBe($before->subdomain)
        ->and(platTenant('TNT-0002')->ruc)->toBe($before->ruc);
})->with([
    'subdominio' => [['subdomain' => 'andes'], 'TEN-BR-01'],
    'RUC' => [['ruc' => '20611234567'], 'TEN-BR-02'],
]);

it('la edición exige los datos de la agencia y una agencia existente', function () {
    actingAsPlatform();

    $this->patchJson('/api/v1/platform/tenants/TNT-0002', platTenantBody('TNT-0002', ['commercial_name' => '']), platTenantVersion('TNT-0002'))->assertStatus(422)->assertJsonValidationErrors('commercial_name');
    expect($this->patchJson('/api/v1/platform/tenants/TNT-9999', platTenantBody('TNT-0002'), ['If-Match' => '1']))->toBeApiError(404);
});

it('el Tenant Admin no valida ni edita agencias de la plataforma', function () {
    actingAsSeed('U01');

    expect($this->postJson('/api/v1/platform/tenants/validate-step', ['subdomain' => 'nueva'])->status())->toBeIn([401, 403])
        ->and($this->patchJson('/api/v1/platform/tenants/TNT-0002', platTenantBody('TNT-0002'), platTenantVersion('TNT-0002'))->status())->toBeIn([401, 403]);
});
