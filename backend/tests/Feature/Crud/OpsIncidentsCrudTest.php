<?php

use App\Domain\Operations\Support\EvidenceStore;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

beforeEach(function () {
    Storage::fake(EvidenceStore::diskName());
});

function opsIncAudit(array $where): bool
{
    return withinTenant(tenantA(), fn () => DB::table('audit_events')->where($where)->exists());
}

function opsIncLock(string $code): int
{
    return (int) rowOf('ops_incidents', $code)->lock_version;
}

function opsIncLogs(string $code): array
{
    return withinTenant(tenantA(), fn () => DB::table('ops_incident_logs')->where('incident_id', rowOf('ops_incidents', $code)->id)->orderBy('created_at')->get(['kind', 'message'])->all());
}

function opsIncJpeg(string $seed): UploadedFile
{
    return UploadedFile::fake()->createWithContent("{$seed}.jpg", "\xFF\xD8\xFF\xE0\x00\x10JFIF\x00".str_repeat($seed, 256)."\xFF\xD9");
}

function opsIncPayload(array $extra = []): array
{
    return ['type' => 'Transporte', 'severity' => 'media', 'title' => 'Retraso del bus de traslado', 'description' => 'El bus llegó 40 minutos tarde al hotel.', ...$extra];
}

it('edita y reclasifica una incidencia abierta con su SLA y su bitácora', function () {
    actingAsSeed('U05');
    $assignee = seedUser(rowOf('ops_incidents', 'INC-0087')->assignee_id === seedUser('U06')->getKey() ? 'U02' : 'U06')->getKey();

    $this->patchJson('/api/v1/ops/incidents/INC-0087', opsIncPayload(['severity' => 'critica', 'type' => 'Seguridad', 'title' => 'Robo de equipaje en el bus', 'assignee_id' => $assignee]))->assertOk();

    $row = rowOf('ops_incidents', 'INC-0087');
    $kinds = collect(opsIncLogs('INC-0087'))->pluck('kind');
    expect($row->severity)->toBe('critica')
        ->and($row->type)->toBe('Seguridad')
        ->and($row->title)->toBe('Robo de equipaje en el bus')
        ->and((int) $row->sla_hours)->toBe(4)
        ->and($row->assignee_id)->toBe($assignee)
        ->and($kinds)->toContain('reclasificacion', 'alerta', 'asignacion')
        ->and(opsIncAudit(['entity' => 'Incidencia', 'entity_id' => 'INC-0087', 'action' => 'editar', 'before_value' => 'media', 'after_value' => 'critica']))->toBeTrue();

    $detail = $this->getJson('/api/v1/ops/incidents/INC-0087')->assertOk()->json('data');
    expect($detail['severity'])->toBe('critica')
        ->and($detail['assignee_id'])->toBe($assignee);
    expect(collect($this->getJson('/api/v1/ops/orders/OP-2026-0413')->json('data.incidents'))->firstWhere('code', 'INC-0087')['severity'])->toBe('critica');
});

it('valida la edición y no edita incidencias cerradas', function () {
    actingAsSeed('U05');

    $this->patchJson('/api/v1/ops/incidents/INC-0087', opsIncPayload(['title' => 'x']))->assertStatus(422)->assertJsonValidationErrors('title');
    $this->patchJson('/api/v1/ops/incidents/INC-0087', opsIncPayload(['severity' => 'urgente']))->assertStatus(422)->assertJsonValidationErrors('severity');
    expect($this->patchJson('/api/v1/ops/incidents/INC-0087', opsIncPayload(['assignee_id' => seedUser('U03')->getKey()])))->toBeApiError(422, 'OPS-BR-04');
    expect($this->patchJson('/api/v1/ops/incidents/INC-0086', opsIncPayload()))->toBeApiError(409, 'OPS-BR-05');
    $this->patchJson('/api/v1/ops/incidents/INC-9999', opsIncPayload())->assertNotFound();
    expect(rowOf('ops_incidents', 'INC-0087')->severity)->toBe('media');
});

it('cierra una incidencia media con comentario y la orden la ve gestionada', function () {
    actingAsSeed('U05');
    $check = fn () => collect($this->getJson('/api/v1/ops/orders/OP-2026-0413')->json('data.checks'))->firstWhere('id', 'incidents');
    expect($check()['ok'])->toBeFalse();

    expect($this->postJson('/api/v1/ops/incidents/INC-0087/close', [], critical(opsIncLock('INC-0087'))))->toBeApiError(422, 'OPS-BR-62');
    $this->postJson('/api/v1/ops/incidents/INC-0087/close', ['comment' => 'Se coordinó con el cliente.'], ['Accept' => 'application/json'])->assertStatus(428);

    $this->postJson('/api/v1/ops/incidents/INC-0087/close', ['comment' => 'Se coordinó con el cliente.'], critical(opsIncLock('INC-0087')))->assertOk();

    $row = rowOf('ops_incidents', 'INC-0087');
    expect($row->status)->toBe('cerrada')
        ->and($row->resolution)->toBe('Se coordinó con el cliente.')
        ->and($row->closed_at)->not->toBeNull()
        ->and($check()['ok'])->toBeTrue()
        ->and(collect($this->getJson('/api/v1/ops/orders/OP-2026-0413')->json('data.incidents'))->firstWhere('code', 'INC-0087')['status'])->toBe('cerrada')
        ->and(collect($this->getJson('/api/v1/ops/orders')->json('data.items'))->firstWhere('code', 'OP-2026-0413')['open_incidents'])->toBe(0)
        ->and(opsIncAudit(['entity' => 'Incidencia', 'entity_id' => 'INC-0087', 'action' => 'cerrar']))->toBeTrue();

    expect($this->postJson('/api/v1/ops/incidents/INC-0087/close', ['comment' => 'Otra vez.'], critical(opsIncLock('INC-0087'))))->toBeApiError(409, 'OPS-BR-05');
});

it('una incidencia alta o crítica se cierra solo con resolución y la crítica además con evidencia', function () {
    actingAsSeed('U05');

    expect($this->postJson('/api/v1/ops/incidents/INC-0088/close', ['comment' => 'Cerrada sin resolver.'], critical(opsIncLock('INC-0088'))))->toBeApiError(422, 'OPS-BR-62');
    $this->postJson('/api/v1/ops/incidents/INC-0088/resolve', ['resolution' => 'Se cambió el vehículo en ruta.'], critical(opsIncLock('INC-0088')))->assertOk();
    $this->postJson('/api/v1/ops/incidents/INC-0088/close', [], critical(opsIncLock('INC-0088')))->assertOk();
    expect(rowOf('ops_incidents', 'INC-0088')->status)->toBe('cerrada');

    $this->postJson('/api/v1/ops/incidents/INC-0085/resolve', ['resolution' => 'Se envió un bus de reemplazo.'], critical(opsIncLock('INC-0085')))->assertOk();
    foreach ($this->getJson('/api/v1/ops/incidents/INC-0085')->json('data.evidence_files') as $file) {
        $this->deleteJson("/api/v1/ops/evidences/{$file['id']}", ['reason' => 'Foto equivocada de otro grupo.'])->assertNoContent();
    }
    expect($this->postJson('/api/v1/ops/incidents/INC-0085/close', [], critical(opsIncLock('INC-0085'))))->toBeApiError(422, 'OPS-BR-62');

    $this->withHeaders(['Accept' => 'application/json'])->post('/api/v1/ops/incidents/INC-0085/evidences/upload', ['file' => opsIncJpeg('q')])->assertCreated();
    $this->postJson('/api/v1/ops/incidents/INC-0085/close', [], critical(opsIncLock('INC-0085')))->assertOk();
    expect(rowOf('ops_incidents', 'INC-0085')->status)->toBe('cerrada')
        ->and(collect($this->getJson('/api/v1/ops/orders/OP-2026-0412')->json('data.checks'))->firstWhere('id', 'incidents')['ok'])->toBeTrue();
});

it('reabre una incidencia cerrada con motivo y vuelve a contar como abierta en la orden', function () {
    actingAsSeed('U05');

    $this->postJson('/api/v1/ops/incidents/INC-0086/reopen', ['reason' => 'No'], critical(opsIncLock('INC-0086')))->assertStatus(422)->assertJsonValidationErrors('reason');
    $this->postJson('/api/v1/ops/incidents/INC-0086/reopen', ['reason' => 'El cliente volvió a reclamar.'], critical(opsIncLock('INC-0086')))->assertOk();

    $row = rowOf('ops_incidents', 'INC-0086');
    expect($row->status)->toBe('en_proceso')
        ->and($row->resolution)->toBeNull()
        ->and($row->closed_at)->toBeNull()
        ->and(collect(opsIncLogs('INC-0086'))->last()->message)->toBe('Reabierta: El cliente volvió a reclamar.')
        ->and(collect($this->getJson('/api/v1/ops/orders/OP-2026-0411')->json('data.checks'))->firstWhere('id', 'incidents')['ok'])->toBeFalse()
        ->and(opsIncAudit(['entity' => 'Incidencia', 'entity_id' => 'INC-0086', 'action' => 'reabrir']))->toBeTrue();

    expect($this->postJson('/api/v1/ops/incidents/INC-0087/reopen', ['reason' => 'Reabrir una abierta.'], critical(opsIncLock('INC-0087'))))->toBeApiError(409, 'OPS-BR-63');
    $this->postJson('/api/v1/ops/incidents/INC-0086/reopen', ['reason' => 'Versión antigua.'], critical(opsIncLock('INC-0086') + 2))->assertStatus(409);
});

it('agrega comentarios a la bitácora de la incidencia', function () {
    $actor = actingAsSeed('U06');

    $this->postJson('/api/v1/ops/incidents/INC-0087/comments', ['message' => 'Llamé al conductor, está a 10 minutos.'])->assertCreated();

    $log = withinTenant(tenantA(), fn () => DB::table('ops_incident_logs')->where('incident_id', rowOf('ops_incidents', 'INC-0087')->id)->where('kind', 'comentario')->orderByDesc('created_at')->first());
    expect($log->message)->toBe('Llamé al conductor, está a 10 minutos.')
        ->and($log->user_id)->toBe($actor->getKey())
        ->and(collect($this->getJson('/api/v1/ops/incidents/INC-0087')->json('data.logs'))->pluck('message'))->toContain('Llamé al conductor, está a 10 minutos.');

    $this->postJson('/api/v1/ops/incidents/INC-0087/comments', ['message' => ''])->assertStatus(422)->assertJsonValidationErrors('message');
    $this->postJson('/api/v1/ops/incidents/INC-9999/comments', ['message' => 'Sin incidencia.'])->assertNotFound();
});

it('solo quien gestiona incidencias las edita, cierra, reabre o comenta', function (string $user) {
    actingAsSeed($user);

    expect($this->patchJson('/api/v1/ops/incidents/INC-0087', opsIncPayload()))->toBeApiError(403);
    expect($this->postJson('/api/v1/ops/incidents/INC-0087/close', ['comment' => 'Cierre ajeno.'], critical(opsIncLock('INC-0087'))))->toBeApiError(403);
    expect($this->postJson('/api/v1/ops/incidents/INC-0086/reopen', ['reason' => 'Reapertura ajena.'], critical(opsIncLock('INC-0086'))))->toBeApiError(403);
    expect($this->postJson('/api/v1/ops/incidents/INC-0087/comments', ['message' => 'Comentario ajeno.']))->toBeApiError(403);
    expect(rowOf('ops_incidents', 'INC-0087')->status)->toBe('abierta');
})->with(['U03', 'U07']);

it('otra agencia no ve ni toca las incidencias', function () {
    actingAsTenantBAdmin();

    $this->patchJson('/api/v1/ops/incidents/INC-0087', opsIncPayload())->assertNotFound();
    $this->postJson('/api/v1/ops/incidents/INC-0087/comments', ['message' => 'Desde otra agencia.'])->assertNotFound();
    $this->postJson('/api/v1/ops/incidents/INC-0087/close', ['comment' => 'Desde otra agencia.'], critical(opsIncLock('INC-0087')))->assertNotFound();
    expect(rowOf('ops_incidents', 'INC-0087')->status)->toBe('abierta');
});

it('registra evidencias prefirmadas en la incidencia y en la orden', function () {
    actingAsSeed('U05');
    Storage::disk(EvidenceStore::diskName())->buildTemporaryUploadUrlsUsing(fn (string $path) => ['url' => "https://storage.test/{$path}?signature=x", 'headers' => []]);
    $upload = function (string $bytes): array {
        $sha = hash('sha256', $bytes);
        $signed = $this->postJson('/api/v1/ops/evidences/presign', ['file_name' => 'acta.pdf', 'mime' => 'application/pdf', 'size' => strlen($bytes), 'sha256' => $sha])->assertOk()->json('data');
        Storage::disk(EvidenceStore::diskName())->put(ltrim((string) parse_url($signed['url'], PHP_URL_PATH), '/'), $bytes);

        return ['upload_id' => $signed['upload_id'], 'sha256' => $sha];
    };

    $this->postJson('/api/v1/ops/incidents/INC-0087/evidences', ['uploads' => []], critical())->assertStatus(422)->assertJsonValidationErrors('uploads');
    $created = $this->postJson('/api/v1/ops/incidents/INC-0087/evidences', ['uploads' => [$upload("%PDF-1.4\nacta incidencia\n%%EOF")], 'source' => 'app_operador'], critical())->assertCreated()->json('data');
    $row = rowOf('ops_evidences', $created[0]['id'], column: 'id');
    expect($row->incident_id)->toBe(rowOf('ops_incidents', 'INC-0087')->id)
        ->and($row->order_id)->toBe(rowOf('ops_orders', 'OP-2026-0413')->id)
        ->and($row->source)->toBe('app_operador')
        ->and(collect(opsIncLogs('INC-0087'))->pluck('kind'))->toContain('evidencia')
        ->and(collect($this->getJson('/api/v1/ops/incidents/INC-0087')->json('data.evidence_files'))->pluck('id'))->toContain($created[0]['id']);

    $order = 'OP-2026-0413';
    $forOrder = $this->postJson("/api/v1/ops/orders/{$order}/evidences", ['uploads' => [$upload("%PDF-1.4\nacta orden\n%%EOF")], 'reservation_service_id' => 'RS-3483'], critical())->assertCreated()->json('data');
    expect(rowOf('ops_evidences', $forOrder[0]['id'], column: 'id')->reservation_service_id)->toBe(serviceRow('RS-3483')->id)
        ->and(collect($this->getJson("/api/v1/ops/orders/{$order}")->json('data.evidence_files'))->pluck('id'))->toContain($forOrder[0]['id'])
        ->and(opsIncAudit(['entity' => 'Evidencia', 'entity_id' => $order, 'action' => 'registrar_evidencia']))->toBeTrue();

    expect($this->postJson("/api/v1/ops/orders/{$order}/evidences", ['uploads' => [$upload("%PDF-1.4\notra\n%%EOF")], 'reservation_service_id' => 'RS-3501'], critical()))->toBeApiError(422);
    expect($this->postJson('/api/v1/ops/orders/OP-2026-0411/evidences', ['uploads' => [$upload("%PDF-1.4\ncerrada\n%%EOF")]], critical()))->toBeApiError(409, 'OPS-BR-05');
    expect($this->postJson('/api/v1/ops/incidents/INC-0086/evidences', ['uploads' => [$upload("%PDF-1.4\nincidencia cerrada\n%%EOF")]], critical()))->toBeApiError(409, 'OPS-BR-05');
});

it('sube archivos a la incidencia y rechaza los no permitidos o de incidencias cerradas', function () {
    actingAsSeed('U05');
    $code = 'INC-0088';

    $this->withHeaders(['Accept' => 'application/json'])->post("/api/v1/ops/incidents/{$code}/evidences/upload", ['file' => UploadedFile::fake()->createWithContent('nota.txt', 'Texto')])->assertStatus(422)->assertJsonValidationErrors('file');
    $created = $this->withHeaders(['Accept' => 'application/json'])->post("/api/v1/ops/incidents/{$code}/evidences/upload", ['file' => opsIncJpeg('w')])->assertCreated()->json('data');
    expect(rowOf('ops_evidences', $created['id'], column: 'id')->incident_id)->toBe(rowOf('ops_incidents', $code)->id);
    expect($this->withHeaders(['Accept' => 'application/json'])->post("/api/v1/ops/incidents/{$code}/evidences/upload", ['file' => opsIncJpeg('w')]))->toBeApiError(409, 'OPS-BR-71');
    expect($this->withHeaders(['Accept' => 'application/json'])->post('/api/v1/ops/incidents/INC-0086/evidences/upload', ['file' => opsIncJpeg('z')]))->toBeApiError(409, 'OPS-BR-05');

    actingAsSeed('U07');
    expect($this->withHeaders(['Accept' => 'application/json'])->post("/api/v1/ops/incidents/{$code}/evidences/upload", ['file' => opsIncJpeg('y')]))->toBeApiError(403);
});
