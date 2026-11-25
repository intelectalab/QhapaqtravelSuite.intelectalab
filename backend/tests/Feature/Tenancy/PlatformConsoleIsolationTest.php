<?php

use App\Domain\Platform\Models\Tenant;
use App\Domain\Shared\Tenancy\TenantContext;
use App\Jobs\SendPlainMail;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use Tests\Support\TestDatabase;

const CONSOLE_ISOLATION_DEMO = [
    'booking_reservations' => ['/api/v1/reservations', 'RES-2026-000348'],
    'quote_quotes' => ['/api/v1/quotes', 'COT-2026-00191'],
    'crm_clients' => ['/api/v1/crm/clients', 'CLI-0002'],
    'crm_leads' => ['/api/v1/crm/leads', 'LEAD-0231'],
    'catalog_products' => ['/api/v1/catalog/products', 'CUS-PKG-5D4N'],
];

function consoleIsolationAgency(): Tenant
{
    actingAsPlatform();

    $code = test()->postJson('/api/v1/platform/tenants', [
        'commercial_name' => 'Valle Sagrado Tours',
        'subdomain' => 'vallesagrado',
        'plan' => 'enterprise',
        'status' => 'prueba',
        'legal_name' => 'Valle Sagrado Tours S.A.C.',
        'ruc' => '20601112223',
        'fiscal_address' => 'Jr. Grau 120, Urubamba',
        'business_type' => 'Operador turístico',
        'legal_rep' => 'Julia Mamani',
        'country' => 'Perú',
        'locale' => 'es-PE',
        'base_currency' => 'PEN',
        'alt_currency' => 'USD',
        'timezone' => 'America/Lima',
        'sede_name' => 'Urubamba',
        'sede_city' => 'Urubamba',
        'sede_address' => 'Jr. Grau 120',
        'sede_phone' => '084 201 300',
        'admin_name' => 'Julia Mamani',
        'admin_email' => 'julia@vallesagrado.pe',
        'admin_phone' => '984 300 400',
        'admin_mfa' => false,
        'roles' => ['tenant_admin', 'sales'],
        'permission_template' => 'standard',
        'quote_validity_days' => 10,
        'hold_minutes' => 30,
        'markup_pct' => 20,
        'max_discount_pct' => 10,
        'tax_pct' => 18,
        'rounding' => '0.01',
        'advance_pct' => 40,
        'fx_rate' => 3.75,
        'fx_source' => 'Manual diario (SBS referencial)',
        'invoice_series' => 'f003',
        'receipt_series' => 'b003',
        'channels' => ['portal_cliente'],
    ], critical())->assertCreated()->json('data.code');

    return tenantByCode((string) $code);
}

it('E2E-08 en la consola: la agencia creada por el asistente queda aislada de TNT-0001 en ambos sentidos y el Super Admin no entra a sus datos', function () {
    Queue::fake();

    $ran = TestDatabase::committed($this->app, 600, function () {
        $tenant = consoleIsolationAgency();

        $detail = $this->getJson("/api/v1/platform/tenants/{$tenant->code}")->assertOk()->json('data');
        $json = (string) json_encode($detail);
        expect($detail['code'])->toBe($tenant->code)
            ->and(str_contains($json, 'RES-2026-') || str_contains($json, 'COT-2026-') || str_contains($json, 'CLI-0'))->toBeFalse();

        foreach (['/api/v1/reservations', '/api/v1/crm/clients', '/api/v1/iam/users'] as $route) {
            expect($this->getJson($route, ['X-Tenant-Id' => $tenant->getKey()]))->toBeApiError(403);
        }

        $mail = Queue::pushed(SendPlainMail::class, fn (SendPlainMail $job) => $job->to === 'julia@vallesagrado.pe')->last();
        preg_match('#/invitacion/([^\s/?"]+)#', (string) $mail?->body, $match);
        expect($match[1] ?? null)->not->toBeNull();

        app('auth')->forgetGuards();
        app(TenantContext::class)->clear();
        $this->withoutToken()->postJson("/api/v1/auth/invitations/{$match[1]}/accept", ['password' => 'ValleSagrado2026', 'password_confirmation' => 'ValleSagrado2026'], critical())->assertOk();

        $admin = seedUser('U01', $tenant);
        actingAsUser($admin, $tenant);

        foreach (CONSOLE_ISOLATION_DEMO as $table => [$route, $code]) {
            expect(withinTenant(tenantA(), fn () => DB::table($table)->where('code', $code)->exists()))->toBeTrue();
            $this->getJson("{$route}/{$code}", ['X-Tenant-Id' => tenantA()->getKey()])->assertNotFound()->assertJsonPath('error', 'RESOURCE_NOT_FOUND');
            $this->getJson($route.'?page[size]=100', ['X-Tenant-Id' => tenantA()->getKey()])->assertOk()->assertJsonCount(0, 'data');

            expect(auditExists(['action' => 'acceso_denegado', 'entity_id' => "{$route}/{$code}"], $tenant))->toBeTrue();
        }

        expect(collect($this->getJson('/api/v1/iam/users?page[size]=100')->assertOk()->json('data'))->pluck('email')->all())->toBe(['julia@vallesagrado.pe'])
            ->and($this->getJson('/api/v1/platform/tenants'))->toBeApiError(403)
            ->and(withinTenant($tenant, fn () => DB::table('booking_reservations')->count()))->toBe(0)
            ->and(withinTenant($tenant, fn () => DB::table('iam_users')->pluck('email')->all()))->toBe(['julia@vallesagrado.pe']);

        actingAsSeed('U01');

        $this->getJson("/api/v1/iam/users/{$admin->getKey()}")->assertNotFound()->assertJsonPath('error', 'RESOURCE_NOT_FOUND');
        $users = json_encode($this->getJson('/api/v1/iam/users?page[size]=100', ['X-Tenant-Id' => $tenant->getKey()])->assertOk()->json());
        $sedes = json_encode($this->getJson('/api/v1/iam/sedes', ['X-Tenant-Id' => $tenant->getKey()])->assertOk()->json());

        expect($users)->not->toContain('julia@vallesagrado.pe')
            ->and($users)->not->toContain((string) $admin->getKey())
            ->and($sedes)->not->toContain('Urubamba')
            ->and($this->getJson('/api/v1/platform/tenants'))->toBeApiError(403)
            ->and(withinTenant(tenantA(), fn () => DB::table('iam_users')->where('tenant_id', $tenant->getKey())->exists()))->toBeFalse();
    });

    if (! $ran) {
        $this->markTestSkipped('Otras pruebas siguieron usando kipucontrol_test durante 10 minutos; esta prueba necesita la base sola para crear la agencia de verdad.');
    }

    expect(DB::connection('pgsql_platform')->table('tenants')->where('subdomain', 'vallesagrado')->exists())->toBeFalse();
})->group('base-sola');
