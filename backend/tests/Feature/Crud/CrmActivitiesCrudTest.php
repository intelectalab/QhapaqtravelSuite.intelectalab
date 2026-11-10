<?php

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

function crmActividadNueva(array $extra = []): string
{
    return (string) test()->postJson('/api/v1/crm/activities', [
        'type' => 'llamada',
        'subject' => 'Llamar para confirmar fechas',
        'due_at' => '2026-10-05 10:00',
        ...$extra,
    ])->assertCreated()->json('data.code');
}

function crmActividadLead(): string
{
    $code = (string) test()->postJson('/api/v1/crm/leads', [
        'name' => 'Lead de agenda '.Str::random(4),
        'email' => 'agenda.'.Str::lower(Str::random(10)).'@prueba.pe',
        'channel' => 'web',
        'source' => 'formulario_web',
        'interest' => 'tour',
    ])->assertCreated()->json('data.code');
    test()->postJson("/api/v1/crm/leads/{$code}/assign", ['owner_id' => seedUser('U03')->id], critical((int) rowOf('crm_leads', $code)->lock_version))->assertOk();

    return $code;
}

function crmActividadAuditada(string $code, string $action): bool
{
    return withinTenant(tenantA(), fn () => DB::table('audit_events')->where('entity', 'Actividad')->where('entity_id', $code)->where('action', $action)->exists());
}

it('crear una actividad vinculada a un cliente la deja pendiente y aparece en la agenda', function () {
    $actor = actingAsSeed('U03');

    $code = crmActividadNueva(['related_type' => 'client', 'related_code' => 'CLI-0003', 'description' => 'Revisar vuelos']);

    $row = rowOf('crm_activities', $code);
    $item = collect($this->getJson('/api/v1/crm/activities')->assertOk()->json('data.items'))->firstWhere('code', $code);

    expect($row->status)->toBe('pendiente')
        ->and($row->owner_id)->toBe($actor->id)
        ->and($row->related_id)->toBe(rowOf('crm_clients', 'CLI-0003')->id)
        ->and($item['related']['code'])->toBe('CLI-0003')
        ->and(crmActividadAuditada($code, 'crear'))->toBeTrue();
});

it('crear una actividad valida asunto, fecha y relación', function () {
    actingAsSeed('U03');

    $this->postJson('/api/v1/crm/activities', ['type' => 'llamada'])->assertStatus(422)->assertJsonValidationErrors(['subject', 'due_at']);
    $this->postJson('/api/v1/crm/activities', ['type' => 'llamada', 'subject' => 'Sin registro', 'due_at' => '2026-10-05 10:00', 'related_type' => 'client'])
        ->assertStatus(422)->assertJsonValidationErrors('related_code');
    expect($this->postJson('/api/v1/crm/activities', ['type' => 'llamada', 'subject' => 'En el pasado', 'due_at' => '2026-09-20 10:00']))->toBeApiError(422, 'DUE_IN_PAST');
});

it('Ventas no vincula una actividad a un cliente de otra cartera', function () {
    actingAsSeed('U03');

    expect($this->postJson('/api/v1/crm/activities', ['type' => 'llamada', 'subject' => 'Cliente ajeno', 'due_at' => '2026-10-05 10:00', 'related_type' => 'client', 'related_code' => 'CLI-0001']))
        ->toBeApiError(422, 'CRM-BR-28');
});

it('Finanzas no gestiona actividades', function () {
    actingAsSeed('U07');

    expect($this->postJson('/api/v1/crm/activities', ['type' => 'llamada', 'subject' => 'No debería', 'due_at' => '2026-10-05 10:00']))->toBeApiError(403);
});

it('completar una llamada de un lead nuevo lo pasa a contactado y crea la próxima actividad encadenada', function () {
    actingAsSeed('U02');
    $lead = crmActividadLead();
    actingAsSeed('U03');
    $code = crmActividadNueva(['related_type' => 'lead', 'related_code' => $lead]);

    $next = $this->postJson("/api/v1/crm/activities/{$code}/complete", [
        'result' => 'Contestó y pidió propuesta',
        'next' => ['type' => 'email', 'subject' => 'Enviar propuesta', 'due_at' => '2026-10-06 09:00'],
    ], critical())->assertOk()->json('data.next');

    $done = rowOf('crm_activities', $code);
    $following = rowOf('crm_activities', $next);

    expect($done->status)->toBe('completada')
        ->and($done->result)->toBe('Contestó y pidió propuesta')
        ->and($done->completed_at)->not->toBeNull()
        ->and($following->previous_activity_id)->toBe($done->id)
        ->and($following->related_id)->toBe($done->related_id)
        ->and(rowOf('crm_leads', $lead)->status)->toBe('contactado')
        ->and(rowOf('crm_leads', $lead)->first_contact_at)->not->toBeNull()
        ->and(crmActividadAuditada($code, 'completar'))->toBeTrue();
});

it('completar exige resultado y no se repite sobre una actividad completada', function () {
    actingAsSeed('U03');
    $code = crmActividadNueva();

    $this->postJson("/api/v1/crm/activities/{$code}/complete", [], critical())->assertStatus(422)->assertJsonValidationErrors('result');
    $this->postJson("/api/v1/crm/activities/{$code}/complete", ['result' => 'Listo'], critical())->assertOk();

    expect($this->postJson("/api/v1/crm/activities/{$code}/complete", ['result' => 'Otra vez'], critical()))->toBeApiError(409, 'ACTIVITY_DONE');
});

it('Ventas no completa la actividad de otro asesor', function () {
    actingAsSeed('U03');

    expect($this->postJson('/api/v1/crm/activities/ACT-0512/complete', ['result' => 'Intento ajeno'], critical()))->toBeApiError(403, 'SEC-BR-09')
        ->and(rowOf('crm_activities', 'ACT-0512')->status)->toBe('pendiente');
});

it('reprogramar cambia la fecha, vuelve a pendiente y se audita', function () {
    actingAsSeed('U03');

    $this->postJson('/api/v1/crm/activities/ACT-0509/reschedule', ['due_at' => '2026-10-08 11:30'])->assertOk();

    $row = rowOf('crm_activities', 'ACT-0509');
    expect($row->status)->toBe('pendiente')
        ->and(Carbon::parse($row->due_at)->setTimezone('America/Lima')->format('Y-m-d H:i'))->toBe('2026-10-08 11:30')
        ->and(crmActividadAuditada('ACT-0509', 'reprogramar'))->toBeTrue();
});

it('reprogramar exige fecha futura y no aplica a actividades completadas', function () {
    actingAsSeed('U03');

    $this->postJson('/api/v1/crm/activities/ACT-0505/reschedule', [])->assertStatus(422)->assertJsonValidationErrors('due_at');
    expect($this->postJson('/api/v1/crm/activities/ACT-0505/reschedule', ['due_at' => '2026-09-01 10:00']))->toBeApiError(422, 'DUE_IN_PAST');
    expect($this->postJson('/api/v1/crm/activities/ACT-0506/reschedule', ['due_at' => '2026-10-08 11:30']))->toBeApiError(409, 'ACTIVITY_DONE');
});

it('editar una actividad guarda tipo, asunto y detalle', function () {
    actingAsSeed('U03');

    $this->patchJson('/api/v1/crm/activities/ACT-0505', ['type' => 'whatsapp', 'subject' => 'Coordinar reunión por WhatsApp', 'description' => 'Enviar ubicación'])->assertOk();

    $row = rowOf('crm_activities', 'ACT-0505');
    expect($row->type)->toBe('whatsapp')
        ->and($row->subject)->toBe('Coordinar reunión por WhatsApp')
        ->and($row->description)->toBe('Enviar ubicación')
        ->and(crmActividadAuditada('ACT-0505', 'editar'))->toBeTrue();
});

it('un supervisor reasigna la actividad y Ventas no puede hacerlo', function () {
    actingAsSeed('U02');
    $ops = seedUser('U05');

    $this->patchJson('/api/v1/crm/activities/ACT-0510', ['type' => 'whatsapp', 'subject' => 'Confirmar traslado', 'owner_id' => $ops->id])->assertOk();
    expect(rowOf('crm_activities', 'ACT-0510')->owner_id)->toBe($ops->id)
        ->and(crmActividadAuditada('ACT-0510', 'reasignar'))->toBeTrue();

    expect($this->patchJson('/api/v1/crm/activities/ACT-0511', ['type' => 'reunion', 'subject' => 'Reunión', 'owner_id' => seedUser('U07')->id]))->toBeApiError(422, 'CRM-BR-31');

    actingAsSeed('U03');
    expect($this->patchJson('/api/v1/crm/activities/ACT-0505', ['type' => 'reunion', 'subject' => 'Reunión', 'owner_id' => seedUser('U04')->id]))->toBeApiError(403, 'CRM-BR-31');
});

it('editar valida el asunto y una actividad completada ya no se edita', function () {
    actingAsSeed('U03');

    $this->patchJson('/api/v1/crm/activities/ACT-0505', ['type' => 'reunion', 'subject' => ''])->assertStatus(422)->assertJsonValidationErrors('subject');
    expect($this->patchJson('/api/v1/crm/activities/ACT-0506', ['type' => 'postventa', 'subject' => 'Cambiar']))->toBeApiError(409, 'ACTIVITY_DONE');
});

it('eliminar una actividad pendiente la quita de la agenda y queda auditada', function () {
    actingAsSeed('U03');
    $code = crmActividadNueva();

    $this->deleteJson("/api/v1/crm/activities/{$code}", ['reason' => 'Duplicada'])->assertOk();

    expect(rowOf('crm_activities', $code))->toBeNull()
        ->and(collect($this->getJson('/api/v1/crm/activities')->json('data.items'))->pluck('code'))->not->toContain($code)
        ->and(crmActividadAuditada($code, 'eliminar'))->toBeTrue();
});

it('una actividad completada es historial y no se elimina', function () {
    actingAsSeed('U03');
    $code = crmActividadNueva();
    $this->postJson("/api/v1/crm/activities/{$code}/complete", ['result' => 'Hecho', 'next' => ['type' => 'llamada', 'subject' => 'Volver a llamar', 'due_at' => '2026-10-07 10:00']], critical())->assertOk();

    expect($this->deleteJson("/api/v1/crm/activities/{$code}"))->toBeApiError(409, 'ACTIVITY_DONE');
    expect($this->deleteJson('/api/v1/crm/activities/ACT-0506'))->toBeApiError(409, 'ACTIVITY_DONE')
        ->and(rowOf('crm_activities', 'ACT-0506'))->not->toBeNull();
});
