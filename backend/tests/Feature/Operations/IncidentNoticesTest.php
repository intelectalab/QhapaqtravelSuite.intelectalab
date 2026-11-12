<?php

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;

function incidentNotices(string $code, string $event): array
{
    $id = rowOf('ops_incidents', $code)->id;

    return withinTenant(tenantA(), fn () => DB::table('notif_messages')->where('source_type', 'ops_incident')->where('source_id', $id)->where('event_code', $event)->pluck('recipient_user_id')->map(fn ($user) => (string) $user)->all());
}

it('una incidencia crítica registrada en la web avisa a gerencia y a operaciones (OPS-BR-61)', function () {
    Queue::fake();
    actingAsSeed('U05');

    $code = $this->postJson('/api/v1/ops/incidents', [
        'order_code' => 'OP-2026-0413',
        'type' => 'Horario',
        'severity' => 'critica',
        'title' => 'Pasajero extraviado en la ruta',
        'description' => 'El guía reporta un pasajero que no regresó al punto de encuentro.',
    ], critical())->assertCreated()->json('data.code');

    expect(incidentNotices($code, 'incidencia.critica'))->toContain(idOf('iam_users', 'U02'))->toContain(idOf('iam_users', 'U05'));
});

it('una incidencia normal avisa a operaciones y escalarla a crítica avisa a gerencia', function () {
    Queue::fake();
    actingAsSeed('U05');

    $code = $this->postJson('/api/v1/ops/incidents', [
        'order_code' => 'OP-2026-0413',
        'type' => 'Horario',
        'severity' => 'media',
        'title' => 'Retraso en el recojo',
        'description' => 'El bus llegó veinte minutos tarde al hotel del grupo.',
    ], critical())->assertCreated()->json('data.code');

    expect(incidentNotices($code, 'incidencia.creada'))->toContain(idOf('iam_users', 'U05'))->not->toContain(idOf('iam_users', 'U02'));

    $this->patchJson("/api/v1/ops/incidents/{$code}", ['type' => 'Horario', 'severity' => 'critica', 'title' => 'Retraso en el recojo', 'description' => 'El bus llegó veinte minutos tarde al hotel del grupo.'], critical((int) rowOf('ops_incidents', $code)->lock_version))->assertOk();

    expect(incidentNotices($code, 'incidencia.critica'))->toContain(idOf('iam_users', 'U02'));
});
