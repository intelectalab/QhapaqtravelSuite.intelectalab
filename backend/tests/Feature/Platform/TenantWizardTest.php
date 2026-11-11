<?php

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;

beforeEach(function () {
    lockPlatformBilling();
    Queue::fake();
});

function wizardBody(array $overrides = []): array
{
    return [
        'commercial_name' => 'Inka Rutas',
        'subdomain' => 'inkarutas',
        'plan' => 'starter',
        'status' => 'prueba',
        'legal_name' => 'Inka Rutas S.A.C.',
        'ruc' => '20555666777',
        'fiscal_address' => 'Av. El Sol 820, Cusco',
        'business_type' => 'Operador turístico',
        'legal_rep' => 'Rosa Ccori',
        'country' => 'Perú',
        'locale' => 'es-PE',
        'base_currency' => 'PEN',
        'alt_currency' => 'USD',
        'timezone' => 'America/Lima',
        'sede_name' => 'Cusco — El Sol',
        'sede_city' => 'Cusco',
        'sede_address' => 'Av. El Sol 820',
        'sede_phone' => '084 222 333',
        'admin_name' => 'Rosa Ccori',
        'admin_email' => 'rosa@inkarutas.pe',
        'admin_phone' => '984 111 222',
        'admin_mfa' => false,
        'roles' => ['tenant_admin', 'sales'],
        'permission_template' => 'minimal',
        'quote_validity_days' => 12,
        'hold_minutes' => 45,
        'markup_pct' => 22,
        'max_discount_pct' => 8,
        'tax_pct' => 18,
        'rounding' => '0.01',
        'advance_pct' => 30,
        'fx_rate' => 3.761,
        'fx_source' => 'Manual diario (SBS referencial)',
        'invoice_series' => 'f002',
        'receipt_series' => 'b002',
        'channels' => ['portal_cliente'],
        ...$overrides,
    ];
}

it('las opciones del asistente traen roles con su plantilla, canales por plan y valores por defecto', function () {
    actingAsPlatform();
    $options = $this->getJson('/api/v1/platform/tenants/provision-options')->assertOk()->json('data');

    $sales = collect($options['roles'])->firstWhere('id', 'sales');
    expect($sales['templates']['minimal']['permissions'])->toBeLessThan($sales['templates']['standard']['permissions'])
        ->and(collect($options['roles'])->firstWhere('id', 'tenant_admin')['required'])->toBeTrue()
        ->and(collect($options['channels'])->firstWhere('key', 'ecommerce')['plan_rank'])->toBe(3)
        ->and($options['defaults'])->toHaveKeys(['timezone', 'roles', 'fx_rate', 'invoice_series'])
        ->and($options['plans'])->not->toBeEmpty();
});

it('validate-step exige los campos del paso, distingue las monedas y bloquea canales fuera del plan', function () {
    actingAsPlatform();

    $this->postJson('/api/v1/platform/tenants/validate-step', ['step' => 1, 'subdomain' => 'nueva'])->assertStatus(422)->assertJsonValidationErrors(['commercial_name', 'plan']);
    $this->postJson('/api/v1/platform/tenants/validate-step', ['step' => 3, 'base_currency' => 'USD', 'alt_currency' => 'USD'])->assertStatus(422)->assertJsonValidationErrors('alt_currency');
    expect($this->postJson('/api/v1/platform/tenants/validate-step', ['step' => 10, 'plan' => 'starter', 'channels' => ['ecommerce']]))->toBeApiError(422, 'TEN-BR-04');
    expect($this->postJson('/api/v1/platform/tenants/validate-step', ['step' => 6, 'roles' => ['tenant_admin', 'inventado']]))->toBeApiError(422, 'TEN-BR-05');
    $this->postJson('/api/v1/platform/tenants/validate-step', ['step' => 9, 'invoice_series' => 'X001'])->assertStatus(422)->assertJsonValidationErrors('invoice_series');
});

it('el alta completa guarda empresa, moneda y zona, sede, administrador, roles con su plantilla y la configuración inicial', function () {
    actingAsPlatform();

    $code = $this->postJson('/api/v1/platform/tenants', wizardBody(), critical())->assertCreated()->json('data.code');
    $db = DB::connection('pgsql_platform');
    $tenant = $db->table('tenants')->where('code', $code)->first();

    expect($tenant)->legal_rep->toBe('Rosa Ccori')->country->toBe('Perú')->alt_currency->toBe('USD')->timezone->toBe('America/Lima')->locale->toBe('es-PE');
    expect($db->table('iam_sedes')->where('tenant_id', $tenant->id)->value('phone'))->toBe('084 222 333');
    $admin = $db->table('iam_users')->where('tenant_id', $tenant->id)->where('code', 'U01')->first();
    expect((bool) $admin->mfa_required)->toBeFalse()->and($admin->phone)->toBe('984 111 222');

    $roles = $db->table('roles')->where('tenant_id', $tenant->id)->pluck('id', 'name');
    expect($roles->keys()->sort()->values()->all())->toBe(['sales', 'tenant_admin']);
    $salesPermissions = $db->table('role_has_permissions as rp')->join('permissions as p', 'p.id', '=', 'rp.permission_id')->where('rp.role_id', $roles['sales'])->pluck('p.name');
    expect($salesPermissions)->not->toBeEmpty()->and($salesPermissions->every(fn (string $name) => str_ends_with($name, '.view')))->toBeTrue();

    $settings = $db->table('sys_settings')->where('tenant_id', $tenant->id)->pluck('values', 'section')->map(fn ($values) => json_decode($values, true));
    expect($settings->keys()->sort()->values()->all())->toBe(['channels', 'currency', 'general', 'operations', 'policies'])
        ->and($settings['policies']['quote_validity_days'])->toBe(12)
        ->and($settings['policies']['max_discount_pct'])->toEqual(8)
        ->and($settings['currency']['rounding'])->toBe('0.01')
        ->and($settings['channels']['portal_cliente'])->toBeTrue()
        ->and($settings['channels']['ecommerce'])->toBeFalse();

    expect($db->table('fin_document_series')->where('tenant_id', $tenant->id)->pluck('doc_type', 'series')->all())->toMatchArray(['F002' => '01', 'B002' => '03']);
    expect((float) $db->table('fin_fx_rates')->where('tenant_id', $tenant->id)->where('currency_code', 'USD')->value('rate_pen'))->toBe(3.761);
});
