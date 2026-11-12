<?php

use Illuminate\Support\Facades\DB;

function crmOportunidadDatos(array $extra = []): array
{
    return [
        'client_code' => 'CLI-0003',
        'title' => 'Ruta del Sur para dos',
        'amount' => 4200,
        'currency' => 'USD',
        'expected_close_date' => '2026-10-30',
        'destination' => 'Arequipa',
        'pax' => 2,
        ...$extra,
    ];
}

function crmOportunidadEdicion(string $code, array $extra = []): array
{
    $row = rowOf('crm_opportunities', $code);

    return [
        'title' => $row->title,
        'amount' => (float) $row->amount,
        'currency' => $row->currency,
        'expected_close_date' => $row->expected_close_date,
        'probability' => (int) $row->probability,
        'destination' => $row->destination_label,
        'pax' => (int) $row->pax,
        ...$extra,
    ];
}

function crmOportunidadVersion(string $code): int
{
    return (int) rowOf('crm_opportunities', $code)->lock_version;
}

function crmOportunidadAuditada(string $code, string $action): bool
{
    return withinTenant(tenantA(), fn () => DB::table('audit_events')->where('entity', 'Oportunidad')->where('entity_id', $code)->where('action', $action)->exists());
}

it('Ventas crea una oportunidad de su cartera siempre como responsable y aparece en el tablero', function () {
    $seller = actingAsSeed('U03');

    $code = $this->postJson('/api/v1/crm/opportunities', crmOportunidadDatos(['owner_id' => seedUser('U04')->id]))->assertCreated()->json('data.code');

    $row = rowOf('crm_opportunities', $code);
    $card = collect($this->getJson('/api/v1/crm/opportunities')->assertOk()->json('data.items'))->firstWhere('code', $code);

    expect($row->stage)->toBe('descubrimiento')
        ->and($row->owner_id)->toBe($seller->id)
        ->and($row->client_id)->toBe(rowOf('crm_clients', 'CLI-0003')->id)
        ->and($row->origin)->toBe('manual')
        ->and($card['client']['code'])->toBe('CLI-0003')
        ->and(crmOportunidadAuditada($code, 'crear'))->toBeTrue();
});

it('un supervisor crea la oportunidad para otro asesor', function () {
    actingAsSeed('U02');

    $code = $this->postJson('/api/v1/crm/opportunities', crmOportunidadDatos(['client_code' => 'CLI-0001', 'owner_id' => seedUser('U04')->id]))->assertCreated()->json('data.code');

    expect(rowOf('crm_opportunities', $code)->owner_id)->toBe(seedUser('U04')->id);
});

it('crear una oportunidad valida monto, fecha de cierre, cliente y cartera', function () {
    actingAsSeed('U03');

    $this->postJson('/api/v1/crm/opportunities', crmOportunidadDatos(['amount' => 0, 'expected_close_date' => '2026-09-01']))
        ->assertStatus(422)->assertJsonValidationErrors(['amount', 'expected_close_date']);
    expect($this->postJson('/api/v1/crm/opportunities', crmOportunidadDatos(['client_code' => 'CLI-9999'])))->toBeApiError(422, 'CRM-BR-20');
    expect($this->postJson('/api/v1/crm/opportunities', crmOportunidadDatos(['client_code' => 'CLI-0001'])))->toBeApiError(403, 'CRM-BR-21');
});

it('Operaciones no gestiona oportunidades', function () {
    actingAsSeed('U05');

    expect($this->postJson('/api/v1/crm/opportunities', crmOportunidadDatos()))->toBeApiError(403);
});

it('editar una oportunidad guarda los cambios y la probabilidad, y sube la versión', function () {
    actingAsSeed('U04');
    $version = crmOportunidadVersion('OPP-0117');

    $this->patchJson('/api/v1/crm/opportunities/OPP-0117', crmOportunidadEdicion('OPP-0117', ['title' => 'Selva central en familia', 'amount' => 11250.5, 'probability' => 45]), critical($version))->assertOk();

    $this->getJson('/api/v1/crm/opportunities/OPP-0117')->assertOk()
        ->assertJsonPath('data.title', 'Selva central en familia')
        ->assertJsonPath('data.probability', 45)
        ->assertJsonPath('data.amount', '11250.50')
        ->assertJsonPath('data.lock_version', $version + 1);
    expect(crmOportunidadAuditada('OPP-0117', 'editar'))->toBeTrue();
});

it('editar una oportunidad cerrada conserva su probabilidad', function () {
    actingAsSeed('U03');

    $this->patchJson('/api/v1/crm/opportunities/OPP-0114', crmOportunidadEdicion('OPP-0114', ['title' => 'Cusco ganada (ajuste)', 'probability' => 10]), critical(crmOportunidadVersion('OPP-0114')))->assertOk();

    expect(rowOf('crm_opportunities', 'OPP-0114')->title)->toBe('Cusco ganada (ajuste)')
        ->and((int) rowOf('crm_opportunities', 'OPP-0114')->probability)->toBe(100);
});

it('editar con versión vieja responde 409 y valida la probabilidad', function () {
    actingAsSeed('U04');
    $version = crmOportunidadVersion('OPP-0117');
    $this->patchJson('/api/v1/crm/opportunities/OPP-0117', crmOportunidadEdicion('OPP-0117', ['pax' => 5]), critical($version))->assertOk();

    expect($this->patchJson('/api/v1/crm/opportunities/OPP-0117', crmOportunidadEdicion('OPP-0117', ['pax' => 8]), critical($version)))->toBeApiError(409, 'STALE_VERSION');
    $this->patchJson('/api/v1/crm/opportunities/OPP-0117', crmOportunidadEdicion('OPP-0117', ['probability' => 140]), critical(crmOportunidadVersion('OPP-0117')))
        ->assertStatus(422)->assertJsonValidationErrors('probability');
    expect((int) rowOf('crm_opportunities', 'OPP-0117')->pax)->toBe(5);
});

it('un supervisor reasigna la oportunidad y queda auditado', function () {
    actingAsSeed('U02');

    $this->patchJson('/api/v1/crm/opportunities/OPP-0117', crmOportunidadEdicion('OPP-0117', ['owner_id' => seedUser('U03')->id]), critical(crmOportunidadVersion('OPP-0117')))->assertOk();

    expect(rowOf('crm_opportunities', 'OPP-0117')->owner_id)->toBe(seedUser('U03')->id)
        ->and(crmOportunidadAuditada('OPP-0117', 'reasignar'))->toBeTrue();
});

it('Ventas no edita la oportunidad de otro asesor', function () {
    actingAsSeed('U03');

    expect($this->patchJson('/api/v1/crm/opportunities/OPP-0117', crmOportunidadEdicion('OPP-0117', ['pax' => 9]), critical(crmOportunidadVersion('OPP-0117'))))->toBeApiError(403, 'SEC-BR-09');
});

it('mover de etapa fija la probabilidad por defecto y se audita', function () {
    actingAsSeed('U04');
    $default = (int) withinTenant(tenantA(), fn () => DB::table('crm_pipeline_stages')->where('code', 'negociacion')->value('default_probability'));

    $this->postJson('/api/v1/crm/opportunities/OPP-0117/stage', ['stage' => 'negociacion'], critical(crmOportunidadVersion('OPP-0117')))
        ->assertOk()
        ->assertJsonPath('data.stage', 'negociacion')
        ->assertJsonPath('data.probability', $default);

    expect(rowOf('crm_opportunities', 'OPP-0117')->closed_at)->toBeNull()
        ->and(crmOportunidadAuditada('OPP-0117', 'cambio_etapa'))->toBeTrue();
    expect($this->postJson('/api/v1/crm/opportunities/OPP-0117/stage', ['stage' => 'negociacion'], critical(crmOportunidadVersion('OPP-0117'))))->toBeApiError(422, 'SAME_STAGE');
});

it('ganar sin cotización aprobada cierra la oportunidad al 100 % con advertencia', function () {
    actingAsSeed('U04');

    $response = $this->postJson('/api/v1/crm/opportunities/OPP-0117/stage', ['stage' => 'ganada'], critical(crmOportunidadVersion('OPP-0117')))->assertOk();

    $row = rowOf('crm_opportunities', 'OPP-0117');
    expect($response->json('meta.warnings'))->toHaveCount(1)
        ->and((int) $row->probability)->toBe(100)
        ->and($row->closed_at)->toBe(BUSINESS_TODAY);
});

it('perder exige motivo y detalle cuando es otro, y guarda la etapa donde se perdió', function () {
    actingAsSeed('U04');

    expect($this->postJson('/api/v1/crm/opportunities/OPP-0116/stage', ['stage' => 'perdida'], critical(crmOportunidadVersion('OPP-0116'))))->toBeApiError(422, 'CRM-BR-24');
    expect($this->postJson('/api/v1/crm/opportunities/OPP-0116/stage', ['stage' => 'perdida', 'lost_reason' => 'otro'], critical(crmOportunidadVersion('OPP-0116'))))->toBeApiError(422, 'CRM-BR-24');

    $this->postJson('/api/v1/crm/opportunities/OPP-0116/stage', ['stage' => 'perdida', 'lost_reason' => 'precio'], critical(crmOportunidadVersion('OPP-0116')))
        ->assertOk()
        ->assertJsonPath('data.lost_reason', 'Precio')
        ->assertJsonPath('data.lost_at_stage', 'negociacion');

    $row = rowOf('crm_opportunities', 'OPP-0116');
    expect((int) $row->probability)->toBe(0)->and($row->closed_at)->toBe(BUSINESS_TODAY);
});

it('una oportunidad ganada pasa a perdida con motivo y vuelve a ganada sin reabrirla', function () {
    actingAsSeed('U04');
    $this->postJson('/api/v1/crm/opportunities/OPP-0117/stage', ['stage' => 'ganada'], critical(crmOportunidadVersion('OPP-0117')))->assertOk();

    expect($this->postJson('/api/v1/crm/opportunities/OPP-0117/stage', ['stage' => 'perdida', 'lost_reason' => 'precio', 'confirm_reopen' => true], critical(crmOportunidadVersion('OPP-0117')))->assertOk()->json('data.stage'))->toBe('perdida');
    expect((int) rowOf('crm_opportunities', 'OPP-0117')->probability)->toBe(0);

    $this->postJson('/api/v1/crm/opportunities/OPP-0117/stage', ['stage' => 'ganada', 'confirm_reopen' => true], critical(crmOportunidadVersion('OPP-0117')))->assertOk();
    $row = rowOf('crm_opportunities', 'OPP-0117');
    expect($row->stage)->toBe('ganada')->and($row->lost_reason_code)->toBeNull()->and((int) $row->probability)->toBe(100);
});

it('reabrir una oportunidad cerrada pide confirmación y limpia el cierre', function () {
    actingAsSeed('U04');

    expect($this->postJson('/api/v1/crm/opportunities/OPP-0113/stage', ['stage' => 'negociacion'], critical(crmOportunidadVersion('OPP-0113'))))->toBeApiError(409, 'CRM-BR-26');

    $this->postJson('/api/v1/crm/opportunities/OPP-0113/stage', ['stage' => 'negociacion', 'confirm_reopen' => true], critical(crmOportunidadVersion('OPP-0113')))->assertOk();

    $row = rowOf('crm_opportunities', 'OPP-0113');
    expect($row->stage)->toBe('negociacion')
        ->and($row->closed_at)->toBeNull()
        ->and($row->lost_reason_code)->toBeNull()
        ->and(crmOportunidadAuditada('OPP-0113', 'reabrir'))->toBeTrue();
});

it('Ventas no mueve la oportunidad de otro asesor', function () {
    actingAsSeed('U03');

    expect($this->postJson('/api/v1/crm/opportunities/OPP-0117/stage', ['stage' => 'cotizacion'], critical(crmOportunidadVersion('OPP-0117'))))->toBeApiError(403, 'SEC-BR-09')
        ->and(rowOf('crm_opportunities', 'OPP-0117')->stage)->toBe('descubrimiento');
});
