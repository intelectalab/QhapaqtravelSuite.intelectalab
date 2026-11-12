<?php

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

function crmPostventaAuditada(string $entity, string $code, string $action): bool
{
    return withinTenant(tenantA(), fn () => DB::table('audit_events')->where('entity', $entity)->where('entity_id', $code)->where('action', $action)->exists());
}

function crmCasoEventos(string $code): array
{
    $id = rowOf('crm_cases', $code)->id;

    return withinTenant(tenantA(), fn () => DB::table('crm_case_events')->where('case_id', $id)->orderBy('created_at')->pluck('event')->all());
}

function crmCasoDatos(array $extra = []): array
{
    return ['client' => 'CLI-0003', 'type' => 'reclamo', 'priority' => 'media', 'subject' => 'Traslado llegó tarde', 'description' => 'El traslado al aeropuerto llegó 40 minutos tarde.', ...$extra];
}

it('registrar una encuesta de promotor actualiza el NPS del cliente sin abrir caso', function () {
    actingAsSeed('U02');
    $cases = withinTenant(tenantA(), fn () => DB::table('crm_cases')->count());

    $code = $this->postJson('/api/v1/crm/surveys', ['client' => 'CLI-0002', 'reservation' => 'RES-2026-000348', 'score' => 10, 'channel' => 'email', 'comment' => 'Todo excelente'], critical())
        ->assertCreated()->json('data.code');

    $survey = rowOf('crm_surveys', $code);
    expect($survey->reservation_id)->toBe(reservationRow('RES-2026-000348')->id)
        ->and((int) $survey->score)->toBe(10)
        ->and((int) rowOf('crm_clients', 'CLI-0002')->nps_last)->toBe(10)
        ->and(withinTenant(tenantA(), fn () => DB::table('crm_cases')->count()))->toBe($cases)
        ->and(crmPostventaAuditada('Cliente', 'CLI-0002', 'actualizar_nps'))->toBeTrue();
});

it('una encuesta de detractor abre el caso y la actividad de postventa para el responsable del cliente', function () {
    actingAsSeed('U02');

    $code = $this->postJson('/api/v1/crm/surveys', ['client' => 'CLI-0002', 'reservation' => 'RES-2026-000348', 'score' => 3, 'channel' => 'llamada'], critical())
        ->assertCreated()->json('data.code');

    $survey = rowOf('crm_surveys', $code);
    $client = rowOf('crm_clients', 'CLI-0002');
    $case = withinTenant(tenantA(), fn () => DB::table('crm_cases')->where('survey_id', $survey->id)->first());
    $activity = withinTenant(tenantA(), fn () => DB::table('crm_activities')->where('related_type', 'client')->where('related_id', $client->id)->where('type', 'postventa')->where('status', 'pendiente')->first());

    expect($case)->not->toBeNull()
        ->and($case->origin)->toBe('nps_auto')
        ->and($case->priority)->toBe('alta')
        ->and($case->status)->toBe('abierta')
        ->and($case->owner_id)->toBe($client->owner_id)
        ->and($case->reservation_id)->toBe($survey->reservation_id)
        ->and((int) $client->nps_last)->toBe(3)
        ->and($activity)->not->toBeNull()
        ->and($activity->subject)->toContain($case->code)
        ->and($activity->owner_id)->toBe($client->owner_id)
        ->and(Carbon::parse($activity->due_at)->setTimezone('America/Lima')->format('Y-m-d H:i'))->toBe('2026-09-30 10:00');

    expect(collect($this->getJson('/api/v1/crm/after-sales')->assertOk()->json('data.cases'))->pluck('code'))->toContain($case->code);
});

it('un detractor de 4 a 6 abre el caso con prioridad media', function () {
    actingAsSeed('U02');

    $code = $this->postJson('/api/v1/crm/surveys', ['client' => 'CLI-0007', 'score' => 6, 'channel' => 'whatsapp', 'comment' => 'Demoras en el hotel'], critical())->assertCreated()->json('data.code');

    $case = withinTenant(tenantA(), fn () => DB::table('crm_cases')->where('survey_id', rowOf('crm_surveys', $code)->id)->first());
    expect($case->priority)->toBe('media')->and($case->description)->toBe('Demoras en el hotel');
});

it('una reserva admite una sola encuesta y debe ser del mismo cliente y no cancelada', function () {
    actingAsSeed('U01');

    expect($this->postJson('/api/v1/crm/surveys', ['client' => 'CLI-0006', 'reservation' => 'RES-2026-000346', 'score' => 8, 'channel' => 'email'], critical()))->toBeApiError(409, 'CRM-BR-41');
    expect($this->postJson('/api/v1/crm/surveys', ['client' => 'CLI-0002', 'reservation' => 'RES-2026-000346', 'score' => 8, 'channel' => 'email'], critical()))->toBeApiError(422, 'CRM-BR-38');
    expect($this->postJson('/api/v1/crm/surveys', ['client' => 'CLI-0006', 'reservation' => 'RES-2026-000343', 'score' => 8, 'channel' => 'email'], critical()))->toBeApiError(422, 'CRM-BR-38');
});

it('registrar una encuesta valida puntaje, canal y cartera', function () {
    actingAsSeed('U03');
    detachFromPortfolio('CLI-0001', 'U03');

    $this->postJson('/api/v1/crm/surveys', ['client' => 'CLI-0003', 'score' => 11, 'channel' => 'paloma'], critical())->assertStatus(422)->assertJsonValidationErrors(['score', 'channel']);
    expect($this->postJson('/api/v1/crm/surveys', ['client' => 'CLI-0001', 'score' => 8, 'channel' => 'email'], critical()))->toBeApiError(422, 'VALIDATION_ERROR');
});

it('Finanzas no registra encuestas', function () {
    actingAsSeed('U07');

    expect($this->postJson('/api/v1/crm/surveys', ['client' => 'CLI-0003', 'score' => 8, 'channel' => 'email'], critical()))->toBeApiError(403);
});

it('editar la última encuesta del cliente actualiza su NPS; editar una anterior no', function () {
    actingAsSeed('U01');

    $this->patchJson('/api/v1/crm/surveys/ENC-0095', ['score' => 4, 'channel' => 'email', 'comment' => 'Corregido'])->assertOk();
    expect((int) rowOf('crm_surveys', 'ENC-0095')->score)->toBe(4)
        ->and((int) rowOf('crm_clients', 'CLI-0001')->nps_last)->toBe(9);

    $this->patchJson('/api/v1/crm/surveys/ENC-0096', ['score' => 7, 'channel' => 'llamada'])->assertOk();
    expect((int) rowOf('crm_surveys', 'ENC-0096')->score)->toBe(7)
        ->and(rowOf('crm_surveys', 'ENC-0096')->channel_code)->toBe('llamada')
        ->and((int) rowOf('crm_clients', 'CLI-0001')->nps_last)->toBe(7)
        ->and(crmPostventaAuditada('Encuesta', 'ENC-0096', 'editar'))->toBeTrue();
});

it('editar una encuesta valida el puntaje y respeta la cartera de Ventas', function () {
    actingAsSeed('U03');

    $this->patchJson('/api/v1/crm/surveys/ENC-0099', ['score' => -1, 'channel' => 'email'])->assertStatus(422)->assertJsonValidationErrors('score');
    expect($this->patchJson('/api/v1/crm/surveys/ENC-0096', ['score' => 2, 'channel' => 'email']))->toBeApiError(404)
        ->and((int) rowOf('crm_surveys', 'ENC-0096')->score)->toBe(9);
});

it('registrar un caso lo abre con su bitácora y aparece en postventa', function () {
    $seller = actingAsSeed('U03');

    $code = $this->postJson('/api/v1/crm/cases', crmCasoDatos(['reservation' => 'RES-2026-000347', 'owner_id' => seedUser('U04')->id]), critical())->assertCreated()->json('data.code');

    $case = rowOf('crm_cases', $code);
    expect($case->status)->toBe('abierta')
        ->and($case->origin)->toBe('manual')
        ->and($case->owner_id)->toBe($seller->id)
        ->and($case->reservation_id)->toBe(reservationRow('RES-2026-000347')->id)
        ->and(crmCasoEventos($code))->toBe(['registro'])
        ->and(collect($this->getJson('/api/v1/crm/after-sales')->json('data.cases'))->pluck('code'))->toContain($code)
        ->and(crmPostventaAuditada('Reclamo (caso)', $code, 'crear'))->toBeTrue();
});

it('una felicitación nace cerrada y un supervisor asigna el responsable', function () {
    actingAsSeed('U02');

    $praise = $this->postJson('/api/v1/crm/cases', crmCasoDatos(['type' => 'felicitacion', 'subject' => 'Guía excelente', 'description' => 'El guía fue muy atento.']), critical())->assertCreated()->json('data.code');
    $assigned = $this->postJson('/api/v1/crm/cases', crmCasoDatos(['owner_id' => seedUser('U03')->id]), critical())->assertCreated()->json('data.code');

    expect(rowOf('crm_cases', $praise)->status)->toBe('cerrada')
        ->and(rowOf('crm_cases', $praise)->closed_at)->not->toBeNull()
        ->and(rowOf('crm_cases', $assigned)->owner_id)->toBe(seedUser('U03')->id);
});

it('registrar un caso valida sus datos y la reserva del cliente', function () {
    actingAsSeed('U02');

    $this->postJson('/api/v1/crm/cases', crmCasoDatos(['type' => 'chisme', 'priority' => 'urgente', 'subject' => 'No', 'description' => '']), critical())
        ->assertStatus(422)->assertJsonValidationErrors(['type', 'priority', 'subject', 'description']);
    expect($this->postJson('/api/v1/crm/cases', crmCasoDatos(['reservation' => 'RES-2026-000348']), critical()))->toBeApiError(422, 'CRM-BR-38');
});

it('editar un caso guarda prioridad y asunto, sube la versión y se audita', function () {
    actingAsSeed('U02');
    $version = (int) rowOf('crm_cases', 'REC-0014')->lock_version;

    $this->patchJson('/api/v1/crm/cases/REC-0014', ['type' => 'reclamo', 'priority' => 'critica', 'subject' => 'Reclamo escalado', 'description' => 'Se escala por demora en la respuesta.', 'owner_id' => seedUser('U03')->id])->assertOk();

    $case = rowOf('crm_cases', 'REC-0014');
    expect($case->priority)->toBe('critica')
        ->and($case->subject)->toBe('Reclamo escalado')
        ->and($case->owner_id)->toBe(seedUser('U03')->id)
        ->and((int) $case->lock_version)->toBe($version + 1)
        ->and(crmPostventaAuditada('Reclamo (caso)', 'REC-0014', 'editar'))->toBeTrue();
});

it('un caso cerrado no se edita y Ventas no edita casos de otra cartera', function () {
    actingAsSeed('U02');
    expect($this->patchJson('/api/v1/crm/cases/REC-0010', ['type' => 'queja', 'priority' => 'baja', 'subject' => 'Cambio tardío', 'description' => 'No debería guardarse.']))->toBeApiError(409, 'CRM-CASE-CLOSED');

    actingAsSeed('U03');
    expect($this->patchJson('/api/v1/crm/cases/REC-0014', ['type' => 'reclamo', 'priority' => 'baja', 'subject' => 'Cambio ajeno', 'description' => 'No debería guardarse.']))->toBeApiError(404)
        ->and(rowOf('crm_cases', 'REC-0014')->priority)->not->toBe('baja');
});

it('un caso cerrado es final: no existe la ruta para reabrirlo', function () {
    actingAsSeed('U01');

    expect($this->postJson('/api/v1/crm/cases/REC-0010/reopen', ['note' => 'El cliente volvió a escribir'])->status())->toBe(404)
        ->and(rowOf('crm_cases', 'REC-0010')->status)->toBe('cerrada');
});

it('solo se cierra un caso resuelto', function () {
    actingAsSeed('U01');

    foreach (['REC-0013' => 'abierta', 'REC-0014' => 'en_proceso'] as $code => $status) {
        expect($this->postJson("/api/v1/crm/cases/{$code}/close", [], critical((int) rowOf('crm_cases', $code)->lock_version)))->toBeApiError(409, 'CRM-CASE-STATE')
            ->and(rowOf('crm_cases', $code)->status)->toBe($status);
    }
});
