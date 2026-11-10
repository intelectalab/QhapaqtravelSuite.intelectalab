<?php

use Illuminate\Support\Facades\DB;

function crmClienteEdicion(string $code, array $extra = []): array
{
    $row = rowOf('crm_clients', $code);

    return [
        'kind' => $row->kind,
        'name' => $row->name,
        'doc_type' => $row->doc_type,
        'doc_number' => $row->doc_number,
        'email' => $row->email,
        'phone' => $row->phone,
        'country' => $row->country,
        'city' => $row->city,
        'segment' => $row->segment_code,
        'tags' => str_replace('"', '', trim((string) $row->tags, '{}')),
        ...$extra,
    ];
}

function crmClienteAuditado(string $code, string $action): bool
{
    return withinTenant(tenantA(), fn () => DB::table('audit_events')->where('entity', 'Cliente')->where('entity_id', $code)->where('action', $action)->exists());
}

it('editar un cliente guarda los datos y la ficha 360 los muestra', function () {
    actingAsSeed('U03');

    $this->patchJson('/api/v1/crm/clients/CLI-0006', crmClienteEdicion('CLI-0006', ['city' => 'Lyon', 'phone' => '+33 6 99 88 77 66', 'segment' => 'VIP', 'tags' => 'Aventura, Gastronomía']))
        ->assertOk();

    $this->getJson('/api/v1/crm/clients/CLI-0006')->assertOk()
        ->assertJsonPath('data.city', 'Lyon')
        ->assertJsonPath('data.segment', 'VIP')
        ->assertJsonPath('data.tags', ['Aventura', 'Gastronomía']);

    expect(rowOf('crm_clients', 'CLI-0006')->phone_norm)->toBe('699887766')
        ->and(crmClienteAuditado('CLI-0006', 'editar'))->toBeTrue();
});

it('Ventas no puede cambiar el responsable de su cliente', function () {
    $seller = actingAsSeed('U03');

    $this->patchJson('/api/v1/crm/clients/CLI-0006', crmClienteEdicion('CLI-0006', ['owner_id' => seedUser('U04')->id, 'city' => 'París']))->assertOk();

    expect(rowOf('crm_clients', 'CLI-0006')->owner_id)->toBe($seller->id)
        ->and(rowOf('crm_clients', 'CLI-0006')->city)->toBe('París');
});

it('un supervisor reasigna el cliente y queda auditado', function () {
    actingAsSeed('U02');

    $this->patchJson('/api/v1/crm/clients/CLI-0006', crmClienteEdicion('CLI-0006', ['owner_id' => seedUser('U04')->id]))->assertOk();

    expect(rowOf('crm_clients', 'CLI-0006')->owner_id)->toBe(seedUser('U04')->id)
        ->and(crmClienteAuditado('CLI-0006', 'reasignar'))->toBeTrue();
    expect($this->patchJson('/api/v1/crm/clients/CLI-0006', crmClienteEdicion('CLI-0006', ['owner_id' => seedUser('U07')->id])))->toBeApiError(422, 'CRM-BR-31');
});

it('editar un cliente valida nombre, documento y segmento', function () {
    actingAsSeed('U01');

    $this->patchJson('/api/v1/crm/clients/CLI-0008', crmClienteEdicion('CLI-0008', ['name' => '', 'email' => '', 'phone' => '']))
        ->assertStatus(422)->assertJsonValidationErrors(['name', 'email']);
    expect($this->patchJson('/api/v1/crm/clients/CLI-0008', crmClienteEdicion('CLI-0008', ['doc_number' => '7011204'])))->toBeApiError(422, 'CRM-BR-15');
    expect($this->patchJson('/api/v1/crm/clients/CLI-0008', crmClienteEdicion('CLI-0008', ['segment' => 'Platino'])))->toBeApiError(422, 'CRM-BR-01');
    expect(rowOf('crm_clients', 'CLI-0008')->doc_number)->toBe('70112045');
});

it('no se repite el documento de otro cliente y el correo repetido pide confirmación', function () {
    actingAsSeed('U01');

    expect($this->patchJson('/api/v1/crm/clients/CLI-0008', crmClienteEdicion('CLI-0008', ['doc_number' => '45781236'])))->toBeApiError(409, 'CRM-BR-16');
    expect($this->patchJson('/api/v1/crm/clients/CLI-0008', crmClienteEdicion('CLI-0008', ['email' => 'gabriela.rios@correo.pe'])))->toBeApiError(409, 'CRM-BR-17');

    $this->patchJson('/api/v1/crm/clients/CLI-0008', crmClienteEdicion('CLI-0008', ['email' => 'gabriela.rios@correo.pe', 'confirm_duplicate' => true]))->assertOk();
    expect(rowOf('crm_clients', 'CLI-0008')->email)->toBe('gabriela.rios@correo.pe');
});

it('Ventas no edita un cliente de otra cartera y Finanzas no edita clientes', function () {
    actingAsSeed('U03');
    expect($this->patchJson('/api/v1/crm/clients/CLI-0001', crmClienteEdicion('CLI-0001', ['city' => 'Tacna'])))->toBeApiError(403, 'SCOPE_OWNERSHIP');

    actingAsSeed('U07');
    expect($this->patchJson('/api/v1/crm/clients/CLI-0001', crmClienteEdicion('CLI-0001', ['city' => 'Tacna'])))->toBeApiError(403);
    expect(rowOf('crm_clients', 'CLI-0001')->city)->not->toBe('Tacna');
});

it('archivar un cliente sin movimientos es lógico: sale de la lista y conserva el registro', function () {
    actingAsSeed('U03');

    $this->postJson('/api/v1/crm/clients/CLI-0011/archive', ['reason' => 'Registro duplicado'])->assertOk();

    $row = withinTenant(tenantA(), fn () => DB::table('crm_clients')->where('code', 'CLI-0011')->first());
    expect($row)->not->toBeNull()
        ->and($row->deleted_at)->not->toBeNull()
        ->and(collect($this->getJson('/api/v1/crm/clients')->assertOk()->json('data'))->pluck('code'))->not->toContain('CLI-0011')
        ->and($this->getJson('/api/v1/crm/clients/CLI-0011')->status())->toBe(404)
        ->and(crmClienteAuditado('CLI-0011', 'archivar'))->toBeTrue();
    expect($this->postJson('/api/v1/crm/clients/CLI-0011/archive'))->toBeApiError(404);
});

it('no se archiva un cliente con reservas en curso, oportunidades abiertas o cobros pendientes', function () {
    actingAsSeed('U01');

    $response = $this->postJson('/api/v1/crm/clients/CLI-0005/archive');

    expect($response)->toBeApiError(409, 'CLIENT_IN_USE')
        ->and($response->json('message'))->toContain('reservas en curso')
        ->and($response->json('message'))->toContain('oportunidades abiertas')
        ->and($response->json('message'))->toContain('cobros pendientes')
        ->and(rowOf('crm_clients', 'CLI-0005')->deleted_at)->toBeNull();
});

it('Ventas no archiva un cliente de otra cartera', function () {
    actingAsSeed('U04');

    expect($this->postJson('/api/v1/crm/clients/CLI-0011/archive'))->toBeApiError(403, 'SCOPE_OWNERSHIP')
        ->and(rowOf('crm_clients', 'CLI-0011')->deleted_at)->toBeNull();
});
