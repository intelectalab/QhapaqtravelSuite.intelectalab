<?php

use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;

function cupService(string $ref): object
{
    return withinTenant(tenantA(), fn () => DB::table('catalog_services')->where('ref', $ref)->first(['id', 'provider_id']));
}

function cupPayload(array $overrides = []): array
{
    $service = cupService('SRV-011');

    return [
        'provider_id' => $service->provider_id,
        'service_id' => $service->id,
        'name' => 'Boleto turístico, cupo de prueba',
        'contract_ref' => 'Convenio de prueba',
        'valid_from' => '2026-10-05',
        'valid_to' => '2026-10-31',
        'base_qty' => 10,
        'release_days' => 5,
        'net_rate' => '130.00',
        'currency' => 'PEN',
        'penalty_pct' => '50',
        ...$overrides,
    ];
}

function cupCreate(array $overrides = []): string
{
    return (string) test()->postJson('/api/v1/catalog/allotments', cupPayload($overrides), critical())->assertCreated()->json('data.code');
}

function cupAudit(array $where): bool
{
    return withinTenant(tenantA(), fn () => DB::table('audit_events')->where($where)->exists());
}

function cupRow(string $code): object
{
    return rowOf('catalog_allotments', $code);
}

function cupDay(string $code, string $date): object
{
    return withinTenant(tenantA(), fn () => DB::table('catalog_allotment_days')->where('allotment_id', cupRow($code)->id)->where('service_date', $date)->first());
}

beforeEach(function () {
    lockSeededBookings();
    lockCatalogProducts();
    Queue::fake();
    $this->withoutMiddleware(ThrottleRequests::class);
});

it('registra un contrato de cupo con un día por fecha y queda en la auditoría', function () {
    actingAsSeed('U05');

    $code = cupCreate();
    $row = cupRow($code);
    $days = withinTenant(tenantA(), fn () => DB::table('catalog_allotment_days')->where('allotment_id', $row->id)->orderBy('service_date')->get());

    expect($code)->toStartWith('CUP-2026-')
        ->and($row->kind)->toBe('entrada')
        ->and($row->status)->toBe('activo')
        ->and($days)->toHaveCount(27)
        ->and((int) $days[0]->blocked_qty)->toBe(10)
        ->and($days[0]->release_deadline)->toBe('2026-09-30')
        ->and(cupAudit(['entity' => 'Cupo', 'entity_id' => $code, 'action' => 'crear']))->toBeTrue();

    $this->getJson("/api/v1/catalog/allotments/{$code}")->assertOk()
        ->assertJsonPath('data.contract.code', $code)
        ->assertJsonPath('data.contract.unit', 'cupo/día')
        ->assertJsonCount(27, 'data.days');
});

it('CUP-BR-002 y CUP-BR-003: el servicio debe ser del proveedor y no se solapan contratos vigentes', function () {
    actingAsSeed('U01');
    $other = cupService('SRV-008');

    expect($this->postJson('/api/v1/catalog/allotments', cupPayload(['provider_id' => $other->provider_id]), critical()))->toBeApiError(422, 'CUP-BR-002');
    $code = cupCreate();
    expect($this->postJson('/api/v1/catalog/allotments', cupPayload(['valid_from' => '2026-10-20', 'valid_to' => '2026-11-10']), critical()))->toBeApiError(409, 'CUP-BR-003');
    $this->postJson('/api/v1/catalog/allotments', cupPayload(['valid_to' => '2026-09-01']), critical())->assertStatus(422)->assertJsonValidationErrors('valid_to');
    expect(cupRow($code)->status)->toBe('activo');
});

it('finanzas consulta en lectura y ventas no entra', function () {
    actingAsSeed('U01');
    $code = cupCreate();

    actingAsSeed('U07');
    $this->getJson('/api/v1/catalog/allotments')->assertOk()->assertJsonPath('data.can.manage', false);
    $this->getJson("/api/v1/catalog/allotments/{$code}")->assertOk();
    expect($this->postJson('/api/v1/catalog/allotments', cupPayload(['valid_from' => '2026-12-01', 'valid_to' => '2026-12-10']), critical()))->toBeApiError(403);
    expect($this->postJson("/api/v1/catalog/allotments/{$code}/release", ['reason' => 'Prueba'], critical()))->toBeApiError(403);

    actingAsSeed('U03');
    expect($this->getJson('/api/v1/catalog/allotments'))->toBeApiError(403);
});

it('CUP-BR-005: libera solo lo disponible de una fecha y lo audita', function () {
    actingAsSeed('U05');
    $code = cupCreate();
    $day = cupDay($code, '2026-10-10');

    expect($this->postJson("/api/v1/catalog/allotments/{$code}/days/2026-10-10/release", ['qty' => 11], critical((int) $day->lock_version)))->toBeApiError(422, 'CUP-BR-005');
    expect($this->postJson("/api/v1/catalog/allotments/{$code}/days/2026-10-10/release", ['qty' => 2], critical(9)))->toBeApiError(409, 'STALE_VERSION');
    $this->postJson("/api/v1/catalog/allotments/{$code}/days/2026-10-10/release", ['qty' => 4], critical((int) $day->lock_version))->assertOk();
    expect($this->postJson("/api/v1/catalog/allotments/{$code}/days/2026-09-20/release", ['qty' => 1], critical()))->toBeApiError(404);

    expect((int) cupDay($code, '2026-10-10')->released_qty)->toBe(4)
        ->and(cupAudit(['entity' => 'Cupo', 'entity_id' => $code, 'action' => 'liberar']))->toBeTrue();
});

it('retiene una fecha con motivo y quita la retención', function () {
    actingAsSeed('U05');
    $code = cupCreate();

    $this->putJson("/api/v1/catalog/allotments/{$code}/days/2026-10-06/retention", [], critical())->assertStatus(422)->assertJsonValidationErrors('reason');
    $this->putJson("/api/v1/catalog/allotments/{$code}/days/2026-10-06/retention", ['reason' => 'Grupo en negociación'], critical())->assertOk();
    expect(cupDay($code, '2026-10-06')->retained_reason)->toBe('Grupo en negociación')
        ->and(cupAudit(['entity' => 'Cupo', 'entity_id' => $code, 'action' => 'retener']))->toBeTrue();

    $this->deleteJson("/api/v1/catalog/allotments/{$code}/days/2026-10-06/retention", [], critical())->assertOk();
    expect(cupDay($code, '2026-10-06')->retained_at)->toBeNull();
    expect($this->deleteJson("/api/v1/catalog/allotments/{$code}/days/2026-10-06/retention", [], critical()))->toBeApiError(409, 'CUP-BR-007');
});

it('el contrato pasa a en release cuando una fecha futura vence su release sin retención', function () {
    actingAsSeed('U05');
    $code = cupCreate(['valid_from' => '2026-09-29', 'valid_to' => '2026-10-15']);

    expect(cupRow($code)->status)->toBe('en_release');
    $this->getJson('/api/v1/catalog/allotments')->assertOk()
        ->assertJsonFragment(['contract' => $code, 'type' => 'vencido', 'date' => '2026-09-29']);
});

it('CUP-BR-004: la ampliación aceptada suma cupo y la rechazada no', function () {
    actingAsSeed('U05');
    $code = cupCreate();

    expect($this->postJson("/api/v1/catalog/allotments/{$code}/requests", ['date_from' => '2026-11-05', 'date_to' => '2026-11-06', 'extra_qty' => 2, 'note' => 'Fuera de vigencia'], critical()))->toBeApiError(422, 'CUP-BR-004');
    $accepted = $this->postJson("/api/v1/catalog/allotments/{$code}/requests", ['date_from' => '2026-10-10', 'date_to' => '2026-10-12', 'extra_qty' => 3, 'note' => 'Grupo corporativo'], critical())->assertCreated()->json('data.code');
    $rejected = $this->postJson("/api/v1/catalog/allotments/{$code}/requests", ['date_from' => '2026-10-20', 'date_to' => '2026-10-20', 'extra_qty' => 5, 'note' => 'Feria'], critical())->assertCreated()->json('data.code');

    $this->postJson("/api/v1/catalog/allotments/{$code}/requests/{$accepted}/respond", ['accepted' => true, 'response' => 'Aceptada por el proveedor'], critical())->assertOk();
    $this->postJson("/api/v1/catalog/allotments/{$code}/requests/{$rejected}/respond", ['accepted' => false, 'response' => 'Sin disponibilidad'], critical())->assertOk();
    expect($this->postJson("/api/v1/catalog/allotments/{$code}/requests/{$accepted}/respond", ['accepted' => false, 'response' => 'Otra vez'], critical()))->toBeApiError(409, 'CUP-BR-004');

    expect((int) cupDay($code, '2026-10-11')->blocked_qty)->toBe(13)
        ->and((int) cupDay($code, '2026-10-20')->blocked_qty)->toBe(10)
        ->and(cupAudit(['entity' => 'Cupo', 'entity_id' => $code, 'action' => 'ampliacion_aceptada']))->toBeTrue()
        ->and(cupAudit(['entity' => 'Cupo', 'entity_id' => $code, 'action' => 'ampliacion_rechazada']))->toBeTrue();
});

it('edita condiciones con control de versión y regenera las fechas', function () {
    actingAsSeed('U05');
    $code = cupCreate();
    $lock = (int) cupRow($code)->lock_version;
    $body = collect(cupPayload(['valid_to' => '2026-11-05', 'base_qty' => 12, 'release_days' => 3]))->except(['provider_id', 'service_id'])->all();

    expect($this->patchJson("/api/v1/catalog/allotments/{$code}", $body, critical($lock + 5)))->toBeApiError(409, 'STALE_VERSION');
    $this->patchJson("/api/v1/catalog/allotments/{$code}", [...$body, 'service_id' => cupService('SRV-008')->id], critical($lock))->assertStatus(422)->assertJsonValidationErrors('service_id');
    $this->patchJson("/api/v1/catalog/allotments/{$code}", $body, critical($lock))->assertOk();

    expect((int) cupDay($code, '2026-10-05')->blocked_qty)->toBe(12)
        ->and(cupDay($code, '2026-10-05')->release_deadline)->toBe('2026-10-02')
        ->and(cupDay($code, '2026-11-05'))->not->toBeNull()
        ->and(cupAudit(['entity' => 'Cupo', 'entity_id' => $code, 'action' => 'editar_contrato']))->toBeTrue();
});

it('liberar el contrato devuelve lo disponible y lo cierra a cambios', function () {
    actingAsSeed('U05');
    $code = cupCreate();

    $this->postJson("/api/v1/catalog/allotments/{$code}/release", [], critical((int) cupRow($code)->lock_version))->assertStatus(422)->assertJsonValidationErrors('reason');
    $free = collect($this->getJson("/api/v1/catalog/allotments/{$code}")->assertOk()->json('data.days'))->sum('available');
    $this->postJson("/api/v1/catalog/allotments/{$code}/release", ['reason' => 'Baja demanda'], critical((int) cupRow($code)->lock_version))->assertOk()->assertJsonPath('data.released', $free);

    expect(cupRow($code)->status)->toBe('liberado')
        ->and($free)->toBeGreaterThan(200)
        ->and(cupAudit(['entity' => 'Cupo', 'entity_id' => $code, 'action' => 'liberar_contrato']))->toBeTrue();
    expect($this->postJson("/api/v1/catalog/allotments/{$code}/days/2026-10-15/release", ['qty' => 1], critical()))->toBeApiError(409, 'CUP-BR-011');
});

it('elimina un contrato sin consumo y deja de verse', function () {
    actingAsSeed('U05');
    $code = cupCreate(['valid_from' => '2026-12-01', 'valid_to' => '2026-12-10']);

    $this->deleteJson("/api/v1/catalog/allotments/{$code}", ['reason' => 'Cargado por error'], critical())->assertOk();
    $this->getJson("/api/v1/catalog/allotments/{$code}")->assertNotFound();
    expect(cupAudit(['entity' => 'Cupo', 'entity_id' => $code, 'action' => 'eliminar']))->toBeTrue();
});

it('la grilla y el pick-up devuelven las fechas pedidas', function () {
    actingAsSeed('U05');
    $code = cupCreate();

    $grid = $this->getJson('/api/v1/catalog/allotments/grid?from=2026-10-05&days=7&kind=entrada')->assertOk()->json('data');
    $row = collect($grid['rows'])->firstWhere('code', $code);
    expect($grid['dates'])->toHaveCount(7)
        ->and($row['cells'][0]['available'])->toBe(10)
        ->and(collect($grid['rows'])->pluck('kind')->unique()->all())->toBe(['entrada']);

    $pickup = $this->getJson('/api/v1/catalog/allotments/pickup')->assertOk()->json('data');
    expect(collect($pickup['rows'])->firstWhere('code', $code)['curve'])->toHaveCount(9);
});

it('ejecuta el job de release desde la pantalla', function () {
    lockScheduledJobs();
    actingAsSeed('U05');

    $this->postJson('/api/v1/catalog/allotments/jobs/release', [], critical())->assertStatus(202)->assertJsonPath('data.code', 'JOB-10');
});

it('otra agencia no ve los contratos de cupo', function () {
    actingAsSeed('U05');
    $code = cupCreate();

    actingAsTenantBAdmin();
    $this->getJson("/api/v1/catalog/allotments/{$code}")->assertNotFound();
    expect(json_encode($this->getJson('/api/v1/catalog/allotments')->assertOk()->json()))->not->toContain($code);
});
