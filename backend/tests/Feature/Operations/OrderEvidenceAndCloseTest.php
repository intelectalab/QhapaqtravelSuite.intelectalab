<?php

use App\Domain\Operations\Support\EvidenceStore;
use Carbon\Carbon;
use Carbon\CarbonImmutable;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Testing\TestResponse;

const EVIDENCE_ORDER = 'OP-2026-0412';

beforeEach(function () {
    Storage::fake(EvidenceStore::diskName());
});

function evidenceBusinessDay(string $date): void
{
    $now = CarbonImmutable::parse("{$date} 10:00:00", 'America/Lima');
    Carbon::setTestNow($now);
    CarbonImmutable::setTestNow($now);
}

function evidenceService(string $order, string $status, ?string $kind = null): object
{
    return withinTenant(tenantA(), fn () => DB::table('booking_reservation_services as s')->join('ops_orders as o', 'o.reservation_id', '=', 's.reservation_id')
        ->where('o.code', $order)->where('s.status', $status)->when($kind, fn ($query) => $query->where('s.service_kind', $kind))
        ->orderBy('s.service_date')->first(['s.id', 's.code', 's.lock_version', 's.service_date', 's.service_kind']));
}

function evidenceJpeg(string $name = 'llegada.jpg', string $seed = 'a'): UploadedFile
{
    return UploadedFile::fake()->createWithContent($name, "\xFF\xD8\xFF\xE0\x00\x10JFIF\x00".str_repeat($seed, 512)."\xFF\xD9");
}

function evidenceUpload(string $url, UploadedFile $file, array $fields = []): TestResponse
{
    return test()->withHeaders(['Accept' => 'application/json'])->post($url, [...$fields, 'file' => $file]);
}

it('completa un servicio confirmado cuya fecha ya llegó y registra la auditoría', function () {
    actingAsSeed('U05');
    $service = evidenceService(EVIDENCE_ORDER, 'confirmado', 'alojamiento');

    $this->postJson("/api/v1/ops/reservation-services/{$service->code}/complete", ['note' => 'El hotel confirmó la salida del grupo.'], critical((int) $service->lock_version))
        ->assertOk()->assertJsonPath('data.status', 'completado')->assertJsonPath('data.order_code', EVIDENCE_ORDER);

    expect(rowOf('booking_reservation_services', $service->code)->status)->toBe('completado')
        ->and(withinTenant(tenantA(), fn () => DB::table('audit_events')->where('entity', 'Servicio')->where('entity_id', $service->code)->where('action', 'completar')->exists()))->toBeTrue();
});

it('no completa un servicio antes de su fecha ni uno que no está confirmado', function () {
    actingAsSeed('U05');
    $future = evidenceService(EVIDENCE_ORDER, 'confirmado', 'tour');
    expect($future->service_date > BUSINESS_TODAY)->toBeTrue();

    expect($this->postJson("/api/v1/ops/reservation-services/{$future->code}/complete", [], critical((int) $future->lock_version)))->toBeApiError(422, 'OPS-BR-13');

    $done = evidenceService(EVIDENCE_ORDER, 'completado');
    expect($this->postJson("/api/v1/ops/reservation-services/{$done->code}/complete", [], critical((int) $done->lock_version)))->toBeApiError(409, 'OPS-BR-05');

    $requested = evidenceService('OP-2026-0413', 'solicitado');
    expect($this->postJson("/api/v1/ops/reservation-services/{$requested->code}/complete", [], critical((int) $requested->lock_version)))->toBeApiError(409, 'OPS-BR-05');
});

it('exige If-Match vigente para completar un servicio', function () {
    actingAsSeed('U05');
    $service = evidenceService(EVIDENCE_ORDER, 'confirmado', 'alojamiento');

    $this->postJson("/api/v1/ops/reservation-services/{$service->code}/complete", [], ['Accept' => 'application/json'])->assertStatus(428);
    $this->postJson("/api/v1/ops/reservation-services/{$service->code}/complete", [], critical((int) $service->lock_version + 5))->assertStatus(409);
    expect(rowOf('booking_reservation_services', $service->code)->status)->toBe('confirmado');
});

it('solo Operaciones o Gerencia completan servicios y suben evidencias', function (string $user) {
    actingAsSeed($user);
    $service = evidenceService(EVIDENCE_ORDER, 'confirmado', 'alojamiento');

    expect($this->postJson("/api/v1/ops/reservation-services/{$service->code}/complete", [], critical((int) $service->lock_version)))->toBeApiError(403);
    expect(evidenceUpload('/api/v1/ops/orders/'.EVIDENCE_ORDER.'/evidences/upload', evidenceJpeg()))->toBeApiError(403);
})->with(['U03', 'U09', 'U07']);

it('sube, lista, muestra y retira evidencias de la orden', function () {
    actingAsSeed('U05');
    $service = evidenceService(EVIDENCE_ORDER, 'completado');
    $before = count($this->getJson('/api/v1/ops/orders/'.EVIDENCE_ORDER.'/evidences')->assertOk()->json('data'));

    $created = evidenceUpload('/api/v1/ops/orders/'.EVIDENCE_ORDER.'/evidences/upload', evidenceJpeg(), ['reservation_service_id' => $service->code])->assertCreated()->json('data');
    $pdf = evidenceUpload('/api/v1/ops/orders/'.EVIDENCE_ORDER.'/evidences/upload', UploadedFile::fake()->createWithContent('acta.pdf', "%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF"))->assertCreated()->json('data');

    expect($created['mime'])->toBe('image/jpeg')->and($pdf['mime'])->toBe('application/pdf');
    $row = rowOf('ops_evidences', $created['id'], column: 'id');
    Storage::disk(EvidenceStore::diskName())->assertExists($row->storage_path);
    expect($row->storage_path)->toStartWith('tenants/'.tenantA()->getKey().'/ops/evidences/')
        ->and($row->source)->toBe('web')
        ->and($row->reservation_service_id)->toBe($service->id);

    $list = collect($this->getJson('/api/v1/ops/orders/'.EVIDENCE_ORDER.'/evidences')->assertOk()->json('data'));
    expect($list)->toHaveCount($before + 2)
        ->and($list->firstWhere('id', $created['id'])['service']['code'])->toBe($service->code)
        ->and(collect($this->getJson('/api/v1/ops/orders/'.EVIDENCE_ORDER)->json('data.evidence_files'))->pluck('id'))->toContain($created['id']);

    $file = $this->get("/api/v1/ops/evidences/{$created['id']}/file")->assertOk();
    expect($file->headers->get('Content-Type'))->toBe('image/jpeg');

    expect($this->deleteJson("/api/v1/ops/evidences/{$created['id']}", []))->toBeApiError(422);
    $this->deleteJson("/api/v1/ops/evidences/{$created['id']}", ['reason' => 'Foto repetida del mismo traslado.'])->assertNoContent();
    expect(rowOf('ops_evidences', $created['id'], column: 'id')->removed_reason)->toBe('Foto repetida del mismo traslado.')
        ->and(collect($this->getJson('/api/v1/ops/orders/'.EVIDENCE_ORDER.'/evidences')->json('data'))->pluck('id'))->not->toContain($created['id']);
    $this->deleteJson("/api/v1/ops/evidences/{$created['id']}", ['reason' => 'Otra vez.'])->assertNotFound();
});

it('rechaza archivos que no son imagen o PDF, los que superan 10 MB y los repetidos', function () {
    actingAsSeed('U05');
    $url = '/api/v1/ops/orders/'.EVIDENCE_ORDER.'/evidences/upload';

    evidenceUpload($url, UploadedFile::fake()->createWithContent('notas.txt', 'Texto plano'))->assertStatus(422)->assertJsonValidationErrors('file');
    evidenceUpload($url, UploadedFile::fake()->create('macro.docx', 20, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'))->assertStatus(422)->assertJsonValidationErrors('file');
    evidenceUpload($url, UploadedFile::fake()->create('acta.pdf', 10 * 1024 + 1, 'application/pdf'))->assertStatus(422)->assertJsonValidationErrors('file');

    evidenceUpload($url, evidenceJpeg('salida.jpg', 'z'))->assertCreated();
    expect(evidenceUpload($url, evidenceJpeg('salida-copia.jpg', 'z')))->toBeApiError(409, 'OPS-BR-71');
    expect(Storage::disk(EvidenceStore::diskName())->allFiles())->toHaveCount(1);
});

it('no deja ver ni tocar evidencias de otra agencia', function () {
    actingAsSeed('U05');
    $created = evidenceUpload('/api/v1/ops/orders/'.EVIDENCE_ORDER.'/evidences/upload', evidenceJpeg())->assertCreated()->json('data');

    actingAsTenantBAdmin();
    expect(evidenceUpload('/api/v1/ops/orders/'.EVIDENCE_ORDER.'/evidences/upload', evidenceJpeg('otra.jpg', 'b')))->toBeApiError(404);
    $this->getJson('/api/v1/ops/orders/'.EVIDENCE_ORDER.'/evidences')->assertNotFound();
    $this->get("/api/v1/ops/evidences/{$created['id']}/file", ['Accept' => 'application/json'])->assertNotFound();
    $this->deleteJson("/api/v1/ops/evidences/{$created['id']}", ['reason' => 'Intento desde otra agencia.'])->assertNotFound();
    $service = evidenceService(EVIDENCE_ORDER, 'confirmado', 'alojamiento');
    $this->postJson("/api/v1/ops/reservation-services/{$service->code}/complete", [], critical((int) $service->lock_version))->assertNotFound();

    expect(rowOf('ops_evidences', $created['id'], column: 'id')->removed_at)->toBeNull()
        ->and(rowOf('booking_reservation_services', $service->code)->status)->toBe('confirmado');
});

it('registra evidencias subidas con URL prefirmada', function () {
    actingAsSeed('U05');
    Storage::disk(EvidenceStore::diskName())->buildTemporaryUploadUrlsUsing(fn (string $path) => ['url' => "https://storage.test/{$path}?signature=x", 'headers' => []]);
    $bytes = "%PDF-1.4\nacta de entrega\n%%EOF";
    $sha = hash('sha256', $bytes);

    expect($this->postJson('/api/v1/ops/evidences/presign', ['file_name' => 'acta.exe', 'mime' => 'application/x-msdownload', 'size' => 10, 'sha256' => $sha]))->toBeApiError(422, 'OPS-BR-70');
    expect($this->postJson('/api/v1/ops/evidences/presign', ['file_name' => 'acta.pdf', 'mime' => 'application/pdf', 'size' => EvidenceStore::MAX_BYTES + 1, 'sha256' => $sha]))->toBeApiError(422, 'OPS-BR-70');

    $signed = $this->postJson('/api/v1/ops/evidences/presign', ['file_name' => 'acta.pdf', 'mime' => 'application/pdf', 'size' => strlen($bytes), 'sha256' => $sha])->assertOk()->json('data');
    expect($signed['method'])->toBe('PUT');
    $path = (string) parse_url($signed['url'], PHP_URL_PATH);

    expect($this->postJson('/api/v1/ops/orders/'.EVIDENCE_ORDER.'/evidences', ['uploads' => [['upload_id' => $signed['upload_id'], 'sha256' => $sha]]], critical()))->toBeApiError(422, 'OPS-BR-70');

    Storage::disk(EvidenceStore::diskName())->put(ltrim($path, '/'), $bytes);
    $created = $this->postJson('/api/v1/ops/orders/'.EVIDENCE_ORDER.'/evidences', ['uploads' => [['upload_id' => $signed['upload_id'], 'sha256' => $sha]]], critical())->assertCreated()->json('data');

    expect($created)->toHaveCount(1)
        ->and(rowOf('ops_evidences', $created[0]['id'], column: 'id')->sha256)->toBe($sha);
});

it('adjunta evidencias a una incidencia y queda en su bitácora', function () {
    actingAsSeed('U05');
    $incident = withinTenant(tenantA(), fn () => DB::table('ops_incidents as i')->join('ops_orders as o', 'o.id', '=', 'i.order_id')->where('o.code', EVIDENCE_ORDER)->where('i.severity', 'critica')->value('i.code'));

    $created = evidenceUpload("/api/v1/ops/incidents/{$incident}/evidences/upload", evidenceJpeg('bus-varado.jpg', 'k'))->assertCreated()->json('data');
    $row = rowOf('ops_evidences', $created['id'], column: 'id');

    expect($row->incident_id)->toBe(rowOf('ops_incidents', $incident)->id)
        ->and($row->order_id)->toBe(rowOf('ops_orders', EVIDENCE_ORDER)->id)
        ->and(collect($this->getJson("/api/v1/ops/incidents/{$incident}")->json('data.evidence_files'))->pluck('id'))->toContain($created['id'])
        ->and(withinTenant(tenantA(), fn () => DB::table('ops_incident_logs')->where('incident_id', $row->incident_id)->where('kind', 'evidencia')->exists()))->toBeTrue();
});

it('cierra la orden solo con las rutas de la API', function () {
    evidenceBusinessDay('2026-10-03');
    $actor = actingAsSeed('U01');
    $order = $this->getJson('/api/v1/ops/orders/'.EVIDENCE_ORDER)->assertOk()->json('data');

    foreach ($order['assignments'] as $assignment) {
        if ($assignment['status'] === 'pendiente') {
            $kind = rowOf('booking_reservation_services', $assignment['service_code'])->service_kind;
            $candidates = $kind === 'traslado'
                ? collect($order['options']['drivers'])->crossJoin($order['options']['vehicles'])->map(fn (array $pair) => ['driver_id' => $pair[0]['value'], 'vehicle_id' => $pair[1]['value']])
                : collect($order['options']['guides'])->map(fn (array $guide) => ['guide_id' => $guide['value']]);
            expect($candidates->first(fn (array $resources) => $this->putJson("/api/v1/ops/assignments/{$assignment['id']}/resources", [...$resources, 'ack_warnings' => true], critical((int) rowOf('ops_assignments', $assignment['id'], column: 'id')->lock_version))->status() === 200))->not->toBeNull();
        }
    }

    foreach ($this->getJson('/api/v1/ops/orders/'.EVIDENCE_ORDER)->json('data.assignments') as $assignment) {
        if ($assignment['status'] === 'asignada') {
            $this->postJson("/api/v1/ops/assignments/{$assignment['id']}/confirm", [], critical((int) rowOf('ops_assignments', $assignment['id'], column: 'id')->lock_version))->assertOk();
        }
    }

    $close = fn () => $this->postJson('/api/v1/ops/orders/'.EVIDENCE_ORDER.'/close', [], critical((int) rowOf('ops_orders', EVIDENCE_ORDER)->lock_version));
    expect($close())->toBeApiError(422, 'OPS-BR-80');

    $services = collect($this->getJson('/api/v1/ops/orders/'.EVIDENCE_ORDER)->json('data.services'))->whereIn('status', ['confirmado', 'en_curso']);
    expect($services)->not->toBeEmpty();
    foreach ($services as $service) {
        $this->postJson("/api/v1/ops/reservation-services/{$service['code']}/complete", [], critical($service['lock_version']))->assertOk();
    }

    foreach ($this->getJson('/api/v1/ops/orders/'.EVIDENCE_ORDER)->json('data.incidents') as $incident) {
        if (in_array($incident['severity'], ['alta', 'critica'], true)) {
            evidenceUpload("/api/v1/ops/incidents/{$incident['code']}/evidences/upload", evidenceJpeg("{$incident['code']}.jpg", $incident['code']))->assertCreated();
        }
        if (in_array($incident['status'], ['abierta', 'en_proceso'], true)) {
            $this->postJson("/api/v1/ops/incidents/{$incident['code']}/resolve", ['resolution' => 'Se resolvió en ruta con el proveedor.'], critical((int) rowOf('ops_incidents', $incident['code'])->lock_version))->assertOk();
        }
    }

    evidenceUpload('/api/v1/ops/orders/'.EVIDENCE_ORDER.'/evidences/upload', evidenceJpeg('cierre.jpg', 'c'))->assertCreated();

    $checks = collect($this->getJson('/api/v1/ops/orders/'.EVIDENCE_ORDER)->json('data.checks'));
    expect($checks->every(fn (array $check) => $check['ok']))->toBeTrue();

    $close()->assertOk()->assertJsonPath('data.status', 'completada');
    expect(rowOf('ops_orders', EVIDENCE_ORDER)->closed_by)->toBe($actor->getKey())
        ->and(collect($this->getJson('/api/v1/ops/orders/'.EVIDENCE_ORDER)->json('data.services'))->where('status', 'confirmado'))->toBeEmpty();

    expect(evidenceUpload('/api/v1/ops/orders/'.EVIDENCE_ORDER.'/evidences/upload', evidenceJpeg('tarde.jpg', 't')))->toBeApiError(409, 'OPS-BR-05');
});
