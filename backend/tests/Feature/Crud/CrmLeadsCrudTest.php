<?php

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

function crmLeadNuevo(array $extra = []): string
{
    return (string) test()->postJson('/api/v1/crm/leads', [
        'name' => 'Lead de prueba '.Str::random(5),
        'email' => 'lead.'.Str::lower(Str::random(10)).'@prueba.pe',
        'channel' => 'web',
        'source' => 'formulario_web',
        'interest' => 'paquete',
        'destination' => 'Cusco',
        'travel_date' => '2026-10-20',
        'pax' => 2,
        ...$extra,
    ])->assertCreated()->json('data.code');
}

function crmLeadAsignado(string $owner): string
{
    $code = crmLeadNuevo();
    test()->postJson("/api/v1/crm/leads/{$code}/assign", ['owner_id' => seedUser($owner)->id], critical(crmLeadVersion($code)))->assertOk();

    return $code;
}

function crmLeadPayload(string $code, array $extra = []): array
{
    $lead = rowOf('crm_leads', $code);

    return [
        'name' => $lead->full_name,
        'email' => $lead->email,
        'phone' => $lead->phone,
        'channel' => $lead->channel_code,
        'source' => $lead->source_code,
        'interest' => $lead->interest_code,
        'destination' => $lead->destination_label,
        'travel_date' => $lead->travel_date,
        'pax' => (int) $lead->pax,
        ...$extra,
    ];
}

function crmLeadVersion(string $code): int
{
    return (int) rowOf('crm_leads', $code)->lock_version;
}

function crmLeadAuditado(string $code, string $action): bool
{
    return withinTenant(tenantA(), fn () => DB::table('audit_events')->where('entity', 'Lead')->where('entity_id', $code)->where('action', $action)->exists());
}

it('editar un lead guarda los cambios, sube la versión y la ficha muestra los datos nuevos', function () {
    actingAsSeed('U01');
    $code = crmLeadNuevo();
    $version = crmLeadVersion($code);

    $this->patchJson("/api/v1/crm/leads/{$code}", crmLeadPayload($code, ['name' => 'Valentina Cárdenas', 'destination' => 'Arequipa', 'pax' => 4]), critical($version))
        ->assertOk()
        ->assertJsonPath('data.name', 'Valentina Cárdenas')
        ->assertJsonPath('data.destination', 'Arequipa')
        ->assertJsonPath('data.pax', 4)
        ->assertJsonPath('data.lock_version', $version + 1);

    $this->getJson("/api/v1/crm/leads/{$code}")->assertOk()->assertJsonPath('data.name', 'Valentina Cárdenas');
    expect(crmLeadAuditado($code, 'editar'))->toBeTrue();
});

it('editar un lead exige nombre y valores del catálogo', function () {
    actingAsSeed('U01');
    $code = crmLeadNuevo();

    $this->patchJson("/api/v1/crm/leads/{$code}", crmLeadPayload($code, ['name' => '']), critical(crmLeadVersion($code)))
        ->assertStatus(422)->assertJsonValidationErrors('name');

    expect($this->patchJson("/api/v1/crm/leads/{$code}", crmLeadPayload($code, ['channel' => 'paloma']), critical(crmLeadVersion($code))))
        ->toBeApiError(422, 'CRM-BR-01');
});

it('editar con una versión vieja responde 409 y no cambia el lead', function () {
    actingAsSeed('U01');
    $code = crmLeadNuevo();
    $version = crmLeadVersion($code);
    $this->patchJson("/api/v1/crm/leads/{$code}", crmLeadPayload($code, ['pax' => 3]), critical($version))->assertOk();

    expect($this->patchJson("/api/v1/crm/leads/{$code}", crmLeadPayload($code, ['pax' => 9]), critical($version)))->toBeApiError(409, 'STALE_VERSION')
        ->and((int) rowOf('crm_leads', $code)->pax)->toBe(3);
});

it('un lead convertido ya no se edita', function () {
    actingAsSeed('U01');

    expect($this->patchJson('/api/v1/crm/leads/LEAD-0225', crmLeadPayload('LEAD-0225', ['pax' => 7]), critical(crmLeadVersion('LEAD-0225'))))
        ->toBeApiError(409, 'LEAD_CLOSED');
});

it('Ventas no edita el lead de otro asesor', function () {
    actingAsSeed('U03');

    expect($this->patchJson('/api/v1/crm/leads/LEAD-0223', crmLeadPayload('LEAD-0223', ['pax' => 5]), critical(crmLeadVersion('LEAD-0223'))))
        ->toBeApiError(403, 'SCOPE_OWNERSHIP');
});

it('asignar un lead de la cola le pone responsable y agenda el primer contacto para ese asesor', function () {
    actingAsSeed('U02');
    $code = crmLeadNuevo();
    $seller = seedUser('U03');

    $this->postJson("/api/v1/crm/leads/{$code}/assign", ['owner_id' => $seller->id, 'schedule_first_contact' => true], critical(crmLeadVersion($code)))
        ->assertOk()
        ->assertJsonPath('data.owner_id', $seller->id);

    $lead = rowOf('crm_leads', $code);
    $activity = withinTenant(tenantA(), fn () => DB::table('crm_activities')->where('related_type', 'lead')->where('related_id', $lead->id)->first());

    expect($lead->assigned_at)->not->toBeNull()
        ->and($activity)->not->toBeNull()
        ->and($activity->owner_id)->toBe($seller->id)
        ->and($activity->status)->toBe('pendiente')
        ->and(crmLeadAuditado($code, 'asignar'))->toBeTrue();
});

it('reasignar un lead mueve sus actividades pendientes al nuevo asesor', function () {
    actingAsSeed('U02');
    $code = crmLeadNuevo();
    $first = seedUser('U04');
    $second = seedUser('U03');
    $this->postJson("/api/v1/crm/leads/{$code}/assign", ['owner_id' => $first->id, 'schedule_first_contact' => true], critical(crmLeadVersion($code)))->assertOk();

    $this->postJson("/api/v1/crm/leads/{$code}/assign", ['owner_id' => $second->id, 'reason' => 'Vacaciones'], critical(crmLeadVersion($code)))->assertOk();

    $leadId = rowOf('crm_leads', $code)->id;
    $owners = withinTenant(tenantA(), fn () => DB::table('crm_activities')->where('related_type', 'lead')->where('related_id', $leadId)->pluck('owner_id')->unique()->values()->all());

    expect(rowOf('crm_leads', $code)->owner_id)->toBe($second->id)
        ->and($owners)->toBe([$second->id])
        ->and(crmLeadAuditado($code, 'reasignar'))->toBeTrue();
});

it('asignar exige un asesor distinto del actual y valida el campo', function () {
    actingAsSeed('U02');
    $code = crmLeadAsignado('U04');

    $this->postJson("/api/v1/crm/leads/{$code}/assign", [], critical(crmLeadVersion($code)))->assertStatus(422)->assertJsonValidationErrors('owner_id');
    expect($this->postJson("/api/v1/crm/leads/{$code}/assign", ['owner_id' => seedUser('U04')->id], critical(crmLeadVersion($code))))->toBeApiError(422, 'CRM-BR-09');
    expect($this->postJson("/api/v1/crm/leads/{$code}/assign", ['owner_id' => seedUser('U07')->id], critical(crmLeadVersion($code))))->toBeApiError(422, 'CRM-BR-09');
});

it('Ventas no puede asignar ni reasignar leads', function () {
    actingAsSeed('U03');

    expect($this->postJson('/api/v1/crm/leads/LEAD-0232/assign', ['owner_id' => seedUser('U03')->id], critical(crmLeadVersion('LEAD-0232'))))->toBeApiError(403)
        ->and(rowOf('crm_leads', 'LEAD-0232')->owner_id)->toBeNull();
});

it('cambiar el estado a contactado exige responsable y fija el primer contacto', function () {
    actingAsSeed('U02');
    $code = crmLeadNuevo();

    expect($this->postJson("/api/v1/crm/leads/{$code}/status", ['status' => 'contactado'], critical(crmLeadVersion($code))))->toBeApiError(409, 'CRM-BR-11');

    $this->postJson("/api/v1/crm/leads/{$code}/assign", ['owner_id' => seedUser('U03')->id], critical(crmLeadVersion($code)))->assertOk();
    $this->postJson("/api/v1/crm/leads/{$code}/status", ['status' => 'contactado'], critical(crmLeadVersion($code)))
        ->assertOk()
        ->assertJsonPath('data.status', 'contactado');

    expect(rowOf('crm_leads', $code)->first_contact_at)->not->toBeNull()
        ->and(crmLeadAuditado($code, 'cambio_estado'))->toBeTrue();
});

it('pasar a calificado exige puntaje 50 o más y convertido no se elige en cambiar estado', function () {
    actingAsSeed('U02');
    $code = crmLeadAsignado('U03');
    expect((int) rowOf('crm_leads', $code)->score)->toBeLessThan(50);

    expect($this->postJson("/api/v1/crm/leads/{$code}/status", ['status' => 'calificado'], critical(crmLeadVersion($code))))->toBeApiError(409, 'CRM-BR-10');
    $this->postJson("/api/v1/crm/leads/{$code}/status", ['status' => 'convertido'], critical(crmLeadVersion($code)))->assertStatus(422)->assertJsonValidationErrors('status');

    $this->postJson('/api/v1/crm/leads/LEAD-0230/status', ['status' => 'calificado'], critical(crmLeadVersion('LEAD-0230')))->assertOk()->assertJsonPath('data.status', 'calificado');
});

it('descartar exige motivo del catálogo', function () {
    actingAsSeed('U02');
    $code = crmLeadNuevo();

    $this->postJson("/api/v1/crm/leads/{$code}/discard", [], critical(crmLeadVersion($code)))->assertStatus(422)->assertJsonValidationErrors('reason');
    expect($this->postJson("/api/v1/crm/leads/{$code}/discard", ['reason' => 'aburrido'], critical(crmLeadVersion($code))))->toBeApiError(422, 'CRM-BR-14');
});

it('descartar conserva el lead, guarda el motivo y cierra sus actividades pendientes', function () {
    actingAsSeed('U02');
    $code = crmLeadNuevo();
    $this->postJson("/api/v1/crm/leads/{$code}/assign", ['owner_id' => seedUser('U03')->id, 'schedule_first_contact' => true], critical(crmLeadVersion($code)))->assertOk();

    $this->postJson("/api/v1/crm/leads/{$code}/discard", ['reason' => 'sin_interes_real', 'detail' => 'Solo cotizaba precios'], critical(crmLeadVersion($code)))
        ->assertOk()
        ->assertJsonPath('data.status', 'descartado')
        ->assertJsonPath('data.discard_reason', 'Sin interés real')
        ->assertJsonPath('data.discarded_from', 'nuevo');

    $lead = rowOf('crm_leads', $code);
    $activities = withinTenant(tenantA(), fn () => DB::table('crm_activities')->where('related_type', 'lead')->where('related_id', $lead->id)->get());

    expect($lead->deleted_at)->toBeNull()
        ->and($lead->discard_reason_code)->toBe('sin_interes_real')
        ->and((int) $lead->discarded_at_step)->toBe(2)
        ->and($activities)->not->toBeEmpty()
        ->and($activities->every(fn (object $activity) => $activity->status === 'completada' && $activity->auto_closed && $activity->result !== null))->toBeTrue()
        ->and(crmLeadAuditado($code, 'descartar'))->toBeTrue();

    expect($this->postJson("/api/v1/crm/leads/{$code}/discard", ['reason' => 'otro'], critical(crmLeadVersion($code))))->toBeApiError(409, 'LEAD_CLOSED');
});
