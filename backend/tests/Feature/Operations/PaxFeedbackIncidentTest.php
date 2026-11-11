<?php

use Illuminate\Support\Facades\DB;

function feedbackRow(): object
{
    return withinTenant(tenantA(), function (): object {
        $row = DB::table('channel_pax_feedback')->orderBy('code')->first();
        DB::table('channel_pax_feedback')->where('id', $row->id)->update(['status' => 'nuevo', 'incident_id' => null]);

        return DB::table('channel_pax_feedback')->where('id', $row->id)->first();
    });
}

it('deriva un comentario del pasajero a una incidencia de Operaciones', function () {
    $feedback = feedbackRow();
    actingAsSeed('U05');

    $this->postJson("/api/v1/pax-feedback/{$feedback->code}/incident", ['title' => 'x', 'type' => 'Nada', 'severity' => 'media', 'description' => ''])->assertStatus(422)->assertJsonValidationErrors(['title', 'type', 'description']);

    $data = $this->postJson("/api/v1/pax-feedback/{$feedback->code}/incident", ['title' => 'Reclamo del pasajero: el bus llegó tarde', 'type' => 'Transporte', 'severity' => 'media', 'description' => $feedback->text])->assertCreated()->json('data');
    $incident = rowOf('ops_incidents', $data['code']);
    $after = rowOf('channel_pax_feedback', $feedback->code);

    expect($incident->reservation_id)->toBe($feedback->reservation_id)
        ->and($incident->severity)->toBe('media')
        ->and($incident->sla_hours)->toBe(24)
        ->and($after->status)->toBe('derivado')
        ->and($after->incident_id)->toBe($incident->id)
        ->and(withinTenant(tenantA(), fn () => DB::table('audit_events')->where(['entity' => 'Comentario pasajero', 'entity_id' => $feedback->code, 'action' => 'derivar'])->exists()))->toBeTrue();

    expect($this->postJson("/api/v1/pax-feedback/{$feedback->code}/incident", ['title' => 'Otra vez el mismo', 'type' => 'Otro', 'severity' => 'baja', 'description' => 'Duplicado']))->toBeApiError(409);
});

it('sin permiso de incidencias no se deriva el comentario', function () {
    $feedback = feedbackRow();
    actingAsSeed('U07');

    expect($this->postJson("/api/v1/pax-feedback/{$feedback->code}/incident", ['title' => 'Reclamo del pasajero', 'type' => 'Otro', 'severity' => 'baja', 'description' => 'Texto']))->toBeApiError(403);
    expect(rowOf('channel_pax_feedback', $feedback->code)->status)->toBe('nuevo');
});
