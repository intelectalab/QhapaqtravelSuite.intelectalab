<?php

use App\Domain\Iam\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Spatie\Permission\PermissionRegistrar;

function plataformaSinReportes(string $code): User
{
    $user = actingAsSeed($code);
    withinTenant(tenantA(), function () use ($user): void {
        foreach ($user->roles as $role) {
            $role->revokePermissionTo('reports.view');
        }
    });
    app(PermissionRegistrar::class)->forgetCachedPermissions();

    return $user;
}

it('Exportaciones: sin reports.view no se crea una exportación de CRM y queda auditado', function () {
    Storage::fake('local');
    plataformaSinReportes('U03');

    $response = $this->postJson('/api/v1/exports', ['resource' => 'crm.leads']);

    expect($response)->toBeApiError(403, 'CRM-EXP-02')
        ->and($response->json('required_permissions'))->toBe(['reports.view'])
        ->and(withinTenant(tenantA(), fn () => DB::table('report_exports')->where('report_key', 'crm_leads')->where('created_at', '>=', now()->subMinute())->exists()))->toBeFalse();
});

it('Exportaciones: sin reports.view no se registra la exportación de una lista del CRM, pero sí la de otras pantallas', function () {
    plataformaSinReportes('U03');
    $body = ['title' => 'Leads', 'format' => 'csv', 'scope' => 'all', 'rows' => 3];

    expect($this->postJson('/api/v1/me/data-exports', [...$body, 'screen' => 'leads']))->toBeApiError(403, 'CRM-EXP-02');
    $this->postJson('/api/v1/me/data-exports', [...$body, 'screen' => 'cotizaciones'])->assertOk();
});

it('Exportaciones: con reports.view Ventas sigue exportando su cartera', function () {
    Storage::fake('local');
    actingAsSeed('U03');

    $this->postJson('/api/v1/exports', ['resource' => 'crm.leads'])->assertStatus(202);
    $this->postJson('/api/v1/me/data-exports', ['screen' => 'leads', 'title' => 'Leads', 'format' => 'csv', 'scope' => 'all', 'rows' => 3])->assertOk();
});

it('LND-08: la consola no da una segunda prueba al mismo RUC o dominio en 12 meses', function () {
    lockPlatformBilling();
    $platform = DB::connection('pgsql_platform');
    $platform->table('subscriptions')->where('tenant_id', tenantA()->getKey())->update(['status' => 'suspended', 'trial_starts_at' => now()->subMonths(3)->toDateString(), 'trial_ends_at' => now()->subMonths(3)->addDays(14)->toDateString()]);
    actingAsPlatform();

    expect(collect($this->getJson('/api/v1/platform/trials')->assertOk()->json('data.eligible'))->pluck('code'))->not->toContain('TNT-0001');

    $response = $this->postJson('/api/v1/platform/trials', ['tenant' => 'TNT-0001', 'reason' => 'Quiere otra prueba']);

    expect($response)->toBeApiError(409, 'TRIAL_ALREADY_USED')
        ->and($response->json('details.available_from'))->toBe(now('America/Lima')->subMonths(3)->addMonths(12)->toDateString());
});

it('LND-08: una prueba de otra agencia con el mismo dominio de correo también cuenta', function () {
    lockPlatformBilling();
    $platform = DB::connection('pgsql_platform');
    $platform->table('tenants')->where('id', tenantA()->getKey())->update(['admin_email' => 'gerencia@andes-hermanos.pe']);
    $other = (string) $platform->table('tenants')->where('id', '<>', tenantA()->getKey())->value('id');
    $platform->table('tenants')->where('id', $other)->update(['admin_email' => 'ventas@andes-hermanos.pe']);
    $copy = (array) $platform->table('subscriptions')->where('tenant_id', tenantA()->getKey())->first();
    $platform->table('subscriptions')->insert([...$copy, 'id' => (string) Str::uuid7(), 'code' => 'SUB-LND08-PRUEBA', 'tenant_id' => $other, 'status' => 'canceled', 'trial_starts_at' => now()->subMonths(2)->toDateString(), 'trial_ends_at' => now()->subMonths(2)->addDays(14)->toDateString()]);
    $platform->table('subscriptions')->where('tenant_id', tenantA()->getKey())->update(['status' => 'canceled', 'trial_starts_at' => null]);
    actingAsPlatform();

    expect($this->postJson('/api/v1/platform/trials', ['tenant' => 'TNT-0001', 'reason' => 'Agencia hermana']))->toBeApiError(409, 'TRIAL_ALREADY_USED');
});
