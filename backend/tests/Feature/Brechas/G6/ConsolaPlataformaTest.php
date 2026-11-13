<?php

use App\Domain\Integrations\Fake\FakeFiscalGateway;
use App\Domain\Platform\Support\FiscalWebhookSecret;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Support\Facades\DB;

beforeEach(fn () => lockPlatformBilling());

function g6Platform(): ConnectionInterface
{
    return DB::connection('pgsql_platform');
}

function g6Tenant(string $code): object
{
    return g6Platform()->table('tenants')->where('code', $code)->first();
}

function g6TenantBody(string $code, array $overrides = []): array
{
    $tenant = g6Tenant($code);

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

it('PUT /platform/settings/fiscal-webhook guarda el secreto cifrado, lo audita, no lo devuelve y firma con él', function () {
    actingAsPlatform();

    $summary = $this->putJson('/api/v1/platform/settings/fiscal-webhook', ['webhook_secret' => 'secreto-del-ose-pruebas'])->assertOk()->json('data');

    expect($summary['secret_set'])->toBeTrue()
        ->and($summary['callback_url'])->toEndWith('/api/v1/integrations/fiscal/sandbox/webhook')
        ->and($summary['signature_header'])->toBe(FakeFiscalGateway::SIGNATURE_HEADER)
        ->and(json_encode($summary))->not->toContain('secreto-del-ose-pruebas')
        ->and(g6Platform()->table('platform_settings')->where('key', FiscalWebhookSecret::KEY)->value('value'))->not->toContain('secreto-del-ose-pruebas')
        ->and(app(FiscalWebhookSecret::class)->secret())->toBe('secreto-del-ose-pruebas')
        ->and(FakeFiscalGateway::sign('{}'))->toBe(hash_hmac('sha256', '{}', 'secreto-del-ose-pruebas'))
        ->and(g6Platform()->table('audit_events')->whereNull('tenant_id')->where('entity_id', 'Secreto del webhook fiscal')->orderByDesc('occurred_at')->value('after_value'))->toBe('cambiado');

    $this->getJson('/api/v1/platform/settings')->assertOk()->assertJsonPath('data.sections.fiscal_webhook.secret_set', true);
    expect($this->putJson('/api/v1/platform/settings/fiscal-webhook', ['webhook_secret' => 'secreto-del-ose-pruebas']))->toBeApiError(422, 'CFG-BR-01');
    $this->putJson('/api/v1/platform/settings/fiscal-webhook', ['webhook_secret' => 'corto'])->assertStatus(422)->assertJsonValidationErrors('webhook_secret');

    $this->putJson('/api/v1/platform/settings/fiscal-webhook', ['clear' => true])->assertOk()->assertJsonPath('data.secret_set', false);
    expect(app(FiscalWebhookSecret::class)->secret())->toBe('')
        ->and($this->putJson('/api/v1/platform/settings/fiscal-webhook', ['clear' => true]))->toBeApiError(422, 'CFG-BR-01');
});

it('un usuario de agencia no puede cambiar el secreto del webhook fiscal', function () {
    actingAsSeed('U01');

    expect($this->putJson('/api/v1/platform/settings/fiscal-webhook', ['webhook_secret' => 'secreto-del-ose-pruebas'])->status())->toBeIn([401, 403]);
});

it('no reactiva un cupón vencido ni uno agotado', function () {
    actingAsPlatform();
    $this->postJson('/api/v1/platform/coupons/QUEDATE20/status', ['active' => false])->assertOk();

    g6Platform()->table('coupons')->where('code', 'QUEDATE20')->update(['valid_to' => '2026-01-31']);
    expect($this->postJson('/api/v1/platform/coupons/QUEDATE20/status', ['active' => true]))->toBeApiError(422, 'COUPON_EXPIRED');

    g6Platform()->table('coupons')->where('code', 'QUEDATE20')->update(['valid_to' => null, 'max_redemptions' => 3, 'redeemed_count' => 3]);
    expect($this->postJson('/api/v1/platform/coupons/QUEDATE20/status', ['active' => true]))->toBeApiError(422, 'COUPON_EXHAUSTED');

    expect(g6Platform()->table('coupons')->where('code', 'QUEDATE20')->value('status'))->toBe('inactive');
});

it('GET /platform/audit-events/export descarga la bitácora en CSV y deja constancia', function () {
    actingAsPlatform();
    $this->postJson('/api/v1/platform/coupons/QUEDATE20/status', ['active' => false])->assertOk();

    $response = $this->get('/api/v1/platform/audit-events/export?days=7', ['Accept' => 'text/csv'])->assertOk();
    $csv = $response->getContent();

    expect($response->headers->get('Content-Type'))->toContain('text/csv')
        ->and($response->headers->get('Content-Disposition'))->toContain('bitacora-plataforma-')
        ->and($csv)->toContain('codigo;fecha;accion;entidad')
        ->and($csv)->toContain('QUEDATE20')
        ->and(g6Platform()->table('audit_events')->whereNull('tenant_id')->where(['entity' => 'Sesión de plataforma', 'action' => 'exportar'])->exists())->toBeTrue();

    $this->getJson('/api/v1/platform/audit-events/export?days=3')->assertStatus(422)->assertJsonValidationErrors('days');
});

it('PATCH /platform/tenants/{id} edita país, idioma, monedas y zona horaria y protege la moneda base con movimientos', function () {
    actingAsPlatform();

    $this->patchJson('/api/v1/platform/tenants/TNT-0001', g6TenantBody('TNT-0001', ['country' => 'Colombia', 'locale' => 'es-419', 'alt_currency' => 'EUR', 'timezone' => 'America/Bogota']), ['If-Match' => (string) g6Tenant('TNT-0001')->lock_version])->assertOk()
        ->assertJsonPath('data.country', 'Colombia')
        ->assertJsonPath('data.locale', 'es-419')
        ->assertJsonPath('data.alt_currency', 'EUR');
    expect($this->patchJson('/api/v1/platform/tenants/TNT-0001', g6TenantBody('TNT-0001', ['base_currency' => 'USD', 'alt_currency' => 'PEN']), ['If-Match' => (string) g6Tenant('TNT-0001')->lock_version]))->toBeApiError(409, 'CFG-BR-05');
    $tenant = g6Tenant('TNT-0001');
    $currency = json_decode((string) withinTenant(tenantByCode('TNT-0001'), fn () => DB::table('sys_settings')->where('section', 'currency')->value('values')), true);

    expect($tenant->timezone)->toBe('America/Bogota')
        ->and($tenant->base_currency)->toBe('PEN')
        ->and($currency['alt_currency'] ?? null)->toBe('EUR')
        ->and(g6Platform()->table('audit_events')->whereNull('tenant_id')->where(['entity' => 'Tenant', 'entity_id' => 'TNT-0001', 'action' => 'editar'])->orderByDesc('occurred_at')->value('after_value'))->toContain('Zona horaria');
});

it('la ficha de la agencia trae su uso contra el plan y sus funciones habilitadas', function () {
    actingAsPlatform();

    $data = $this->getJson('/api/v1/platform/tenants/TNT-0001')->assertOk()->json('data');
    $usage = collect($data['usage'])->keyBy('metric');

    expect($usage->keys()->all())->toContain('users', 'sedes', 'storage_gb', 'reservations_month')
        ->and($usage['users']['used'])->toEqual($data['users'])
        ->and($data['entitlements'])->not->toBeEmpty()
        ->and($data['entitlements'][0])->toHaveKeys(['key', 'label', 'source'])
        ->and($data)->toHaveKeys(['country', 'locale', 'alt_currency']);
});

it('los trials muestran las reservas creadas y la cobranza trae el historial y la recuperación de 90 días', function () {
    actingAsPlatform();
    g6Platform()->table('subscriptions')->where('tenant_id', tenantA()->getKey())->update(['status' => 'trialing', 'trial_ends_at' => now()->addDays(5)->toDateString()]);

    $trial = collect($this->getJson('/api/v1/platform/trials')->assertOk()->json('data.items'))->firstWhere('tenant.code', 'TNT-0001');
    expect($trial['reservations'])->toBe(g6Platform()->table('booking_reservations')->where('tenant_id', tenantA()->getKey())->whereNull('deleted_at')->count());

    $invoice = g6Platform()->table('platform_invoices')->where('tenant_id', tenantA()->getKey())->orderByDesc('issue_date')->first();
    g6Platform()->table('platform_invoices')->where('id', $invoice->id)->update(['status' => 'paid', 'dunning_failed_at' => now()->subDays(10)->toDateString()]);

    $dunning = $this->getJson('/api/v1/platform/dunning')->assertOk()->json('data');
    $row = collect($dunning['history'])->firstWhere('id', $invoice->id);

    expect($row['outcome'])->toBe('recovered')
        ->and($dunning['recovery']['days'])->toBe(90)
        ->and($dunning['recovery']['recovered_count'])->toBeGreaterThanOrEqual(1)
        ->and($dunning['recovery']['recovered_amount'])->toBeGreaterThanOrEqual((float) $invoice->total);
});
