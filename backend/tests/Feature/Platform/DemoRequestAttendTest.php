<?php

use Illuminate\Support\Facades\DB;

function demoRequestCode(string $email = 'ana@andesviajes.pe'): string
{
    return (string) DB::connection('pgsql_platform')->table('platform_demo_requests')->insertGetId([
        'kind' => 'demo',
        'full_name' => 'Ana Quispe',
        'email' => $email,
        'phone' => '+51 984 111 222',
        'company' => 'Andes Viajes',
        'business_type' => 'Agencia receptiva',
        'city' => 'Cusco',
        'team_size' => '6-15',
        'message' => 'Queremos ver el módulo de operaciones.',
        'consent_at' => now(),
    ], 'code');
}

it('la consola marca una solicitud como contactada con su nota y queda auditado', function () {
    $code = demoRequestCode();
    actingAsPlatform();

    $data = $this->patchJson("/api/v1/platform/demo-requests/{$code}", ['status' => 'contactada', 'notes' => 'Llamada el lunes, demo el jueves.'])->assertOk()->json('data');

    expect($data['status'])->toBe('contactada')
        ->and($data['notes'])->toBe('Llamada el lunes, demo el jueves.')
        ->and($data['handled_by'])->not->toBeNull()
        ->and($data['next_statuses'])->toBe(['convertida', 'descartada']);

    $list = $this->getJson('/api/v1/platform/demo-requests')->assertOk()->json('data');
    expect(collect($list['items'])->firstWhere('code', $code)['status'])->toBe('contactada')
        ->and($list['kpis']['contacted'])->toBeGreaterThanOrEqual(1);

    expect(DB::connection('pgsql_platform')->table('audit_events')->whereNull('tenant_id')->where(['entity' => 'Solicitud comercial', 'entity_id' => $code, 'action' => 'cambiar_estado'])->exists())->toBeTrue();
});

it('descartar exige el motivo', function () {
    $code = demoRequestCode();
    actingAsPlatform();

    $this->patchJson("/api/v1/platform/demo-requests/{$code}", ['status' => 'descartada'])
        ->assertStatus(422)->assertJsonPath('code', 'DEMO-BR-03');

    $this->patchJson("/api/v1/platform/demo-requests/{$code}", ['status' => 'descartada', 'notes' => 'Ya usa otro sistema.'])->assertOk()
        ->assertJsonPath('data.next_statuses', ['contactada']);
});

it('una solicitud convertida no cambia de estado', function () {
    $code = demoRequestCode();
    actingAsPlatform();

    $this->patchJson("/api/v1/platform/demo-requests/{$code}", ['status' => 'convertida'])->assertOk();

    $this->patchJson("/api/v1/platform/demo-requests/{$code}", ['status' => 'contactada'])
        ->assertStatus(409)->assertJsonPath('code', 'DEMO-BR-02');
});

it('una solicitud que no existe responde 404', function () {
    actingAsPlatform();

    $this->patchJson('/api/v1/platform/demo-requests/SOL-99999', ['status' => 'contactada'])->assertNotFound();
});

it('un usuario de agencia no puede atender solicitudes', function () {
    $code = demoRequestCode();
    actingAsSeed('U01');

    $this->patchJson("/api/v1/platform/demo-requests/{$code}", ['status' => 'contactada'])->assertForbidden();
});
