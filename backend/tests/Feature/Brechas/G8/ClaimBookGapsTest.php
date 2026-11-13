<?php

use App\Domain\Crm\Support\ClaimBookDirectory;
use App\Jobs\AlertClaimDeadlines;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;

function g8ClaimSede(): string
{
    return (string) withinTenant(tenantA(), fn () => DB::table('iam_sedes')->where('name', 'Lima — Miraflores')->value('id'));
}

function g8ClaimEvents(string $code): array
{
    $id = rowOf('crm_cases', $code)->id;

    return withinTenant(tenantA(), fn () => DB::table('crm_case_events')->where('case_id', $id)->orderBy('created_at')->pluck('message')->all());
}

it('cerrar con un motivo del catálogo guarda el motivo y la observación', function () {
    actingAsSeed('U01');
    $reason = ClaimBookDirectory::CLOSE_REASONS[2];

    $this->postJson('/api/v1/crm/claim-book/REC-0018/close', ['reason' => $reason, 'note' => 'Se le explicó por teléfono.'], critical((int) rowOf('crm_cases', 'REC-0018')->lock_version))->assertOk();

    $claim = rowOf('crm_cases', 'REC-0018');
    expect($claim->book_status)->toBe('closed')
        ->and($claim->close_note)->toBe("{$reason} — Se le explicó por teléfono.");
});

it('un motivo de cierre fuera del catálogo se rechaza', function () {
    actingAsSeed('U01');

    $this->postJson('/api/v1/crm/claim-book/REC-0018/close', ['reason' => 'Porque sí'], critical((int) rowOf('crm_cases', 'REC-0018')->lock_version))
        ->assertStatus(422)->assertJsonValidationErrors('reason');
});

it('la nota interna queda en el historial y en la auditoría sin cambiar el estado', function () {
    actingAsSeed('U01');
    $before = rowOf('crm_cases', 'REC-0020');

    $this->postJson('/api/v1/crm/claim-book/REC-0020/notes', ['note' => 'Pedir a operaciones el reporte del guía.'], critical())->assertCreated();

    expect(rowOf('crm_cases', 'REC-0020')->book_status)->toBe($before->book_status)
        ->and(collect(g8ClaimEvents('REC-0020'))->last())->toBe('Nota interna: Pedir a operaciones el reporte del guía.');

    $audit = $this->getJson('/api/v1/crm/claim-book/REC-0020/audit')->assertOk()->json('data');
    expect(collect($audit)->pluck('action'))->toContain('nota_interna');
    $this->postJson('/api/v1/crm/claim-book/REC-0020/notes', ['note' => ''], critical())->assertStatus(422)->assertJsonValidationErrors('note');
});

it('la auditoría de una hoja inexistente responde 404', function () {
    actingAsSeed('U01');

    $this->getJson('/api/v1/crm/claim-book/REC-9999/audit')->assertNotFound();
});

it('el reporte trae el cumplimiento del plazo y las vencidas sin respuesta', function () {
    actingAsSeed('U01');

    $report = $this->getJson('/api/v1/crm/claim-book/reports')->assertOk()->json('data');
    expect($report['compliance'])->toHaveKeys(['on_time', 'late', 'overdue', 'pending'])
        ->and($report['overdue'])->toHaveCount($report['compliance']['overdue']);
});

it('la respuesta a un menor de edad se dirige al apoderado', function () {
    actingAsSeed('U01');
    $code = $this->postJson('/api/v1/crm/claim-book', [
        'sede_id' => g8ClaimSede(),
        'type' => 'queja',
        'consumer_name' => 'Lucía Flores Ramos',
        'consumer_doc_type' => 'DNI',
        'consumer_doc_number' => '71234567',
        'consumer_email' => 'carmen.ramos@correo.pe',
        'consumer_address' => 'Jr. Lampa 120, Lima',
        'good_kind' => 'Servicio',
        'good_description' => 'Tour escolar a Paracas',
        'detail' => 'No se respetó el horario de recojo acordado con el colegio.',
        'request' => 'Explicación por escrito.',
        'is_minor' => true,
        'guardian_name' => 'Carmen Ramos Díaz',
        'guardian_doc_type' => 'DNI',
        'guardian_doc_number' => '41234567',
        'guardian_relation' => 'Madre',
        'email_consent' => true,
    ], critical())->assertCreated()->json('data.code');

    $this->postJson("/api/v1/crm/claim-book/{$code}/response", ['decision' => 'Procedente', 'text' => 'Revisamos el caso con el conductor y confirmamos el retraso en el recojo del grupo.', 'actions' => 'Se reforzó el control de horarios.'], critical())->assertOk();

    $body = withinTenant(tenantA(), fn () => DB::table('notif_messages')->where('event_code', 'reclamacion.respuesta')->where('source_id', rowOf('crm_cases', $code)->id)->value('body_rendered'));
    expect($body)->toStartWith('Hola, Carmen Ramos Díaz:')
        ->and($body)->toContain('Lucía Flores Ramos (menor de edad)')
        ->and(collect(g8ClaimEvents($code))->last())->toContain('dirigida a Carmen Ramos Díaz, madre');
});

it('alertar vencimientos dispara la revisión del libro y queda auditada', function () {
    Queue::fake();
    actingAsSeed('U01');

    $job = withinTenant(tenantA(), fn () => DB::table('sys_scheduled_jobs')->where('job_class', AlertClaimDeadlines::class)->value('code'));

    if ($job === null) {
        expect($this->postJson('/api/v1/crm/claim-book/deadline-alerts', [], critical()))->toBeApiError(409, 'LR-ALERTS');

        return;
    }

    $this->postJson('/api/v1/crm/claim-book/deadline-alerts', [], critical())->assertStatus(202)->assertJsonPath('data.code', $job);
    expect(withinTenant(tenantA(), fn () => DB::table('audit_events')->where('entity', 'Job')->where('entity_id', $job)->where('action', 'ejecutar')->exists()))->toBeTrue();
    Queue::assertPushed(AlertClaimDeadlines::class);
});

it('sin permiso del libro no se ven la auditoría ni las notas', function () {
    actingAsSeed('U04');

    $this->getJson('/api/v1/crm/claim-book/REC-0020/audit')->assertForbidden()->assertJsonPath('required_permissions', ['crm.claims.manage']);
});
