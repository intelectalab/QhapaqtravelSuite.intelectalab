<?php

use App\Domain\Integrations\Fake\FakeMalwareScanner;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;

beforeEach(function () {
    Storage::fake((string) config('filesystems.default'));
    Queue::fake();
});

function ptdocJpeg(string $name, string $payload = 'foto del documento'): UploadedFile
{
    return UploadedFile::fake()->createWithContent($name, "\xFF\xD8\xFF\xE0\x00\x10JFIF\x00".$payload.str_repeat('z', 256)."\xFF\xD9");
}

function ptdocPending(array $trip): array
{
    foreach ($trip['travel_docs'] as $passenger) {
        foreach ($passenger['documents'] as $document) {
            if ($document['can_upload'] && $document['status'] === 'pendiente') {
                return [$passenger['id'], $document['type']];
            }
        }
    }

    throw new RuntimeException('Sin documentos pendientes en la semilla.');
}

it('DOC-11 §4.4: el cliente ve sus documentos de viaje y sube uno desde el portal; queda recibido y Operaciones lo ve por revisar', function () {
    actingAsSeed('U14');
    $trip = $this->getJson('/api/v1/portal/client/reservations/RES-2026-000344')->assertOk()->json('data');
    expect($trip['travel_docs'])->not->toBeEmpty()
        ->and(collect($trip['travel_docs'])->flatMap(fn (array $row) => $row['documents'])->pluck('type')->intersect(['emergency', 'special']))->toBeEmpty();

    [$passenger, $type] = ptdocPending($trip);

    $this->post("/api/v1/reservations/RES-2026-000344/travel-docs/{$passenger}/{$type}/files", ['file' => ptdocJpeg('pasaporte.jpg'), 'doc_number' => 'PA77120'], ['Accept' => 'application/json'])->assertCreated();

    $row = withinTenant(tenantA(), fn () => DB::table('ops_travel_doc_items')->where('passenger_id', $passenger)->where('doc_type', $type)->first());
    expect($row->status)->toBe('recibido')
        ->and($row->uploaded_by_type)->toBe('client')
        ->and($row->doc_number)->toBe('PA77120')
        ->and(withinTenant(tenantA(), fn () => DB::table('sys_documents')->where('id', $row->file_id)->value('storage_path')))->toStartWith('tenants/')
        ->and(withinTenant(tenantA(), fn () => DB::table('audit_events')->where('entity', 'Documento de viaje')->where('action', 'cargar')->where('after_value', 'like', '%desde el portal%')->exists()))->toBeTrue();

    $mine = collect($this->getJson('/api/v1/portal/client/reservations/RES-2026-000344')->json('data.travel_docs'))->firstWhere('id', $passenger);
    $document = collect($mine['documents'])->firstWhere('type', $type);
    expect($document['status'])->toBe('recibido')->and($document['sent_by_you'])->toBeTrue()->and($document['file'])->toBe('pasaporte.jpg');

    actingAsSeed('U05');
    $detail = collect($this->getJson('/api/v1/reservations/RES-2026-000344/travel-docs')->assertOk()->json('data.passengers'))->firstWhere('id', $passenger);
    $back = collect($detail['documents'])->firstWhere('type', $type);
    expect($back['status'])->toBe('recibido')->and($back['from_client'])->toBeTrue()->and($back['has_file'])->toBeTrue();
});

it('DOC-BR-013: el portal rechaza archivos con malware o de otro formato y no deja subir a viajes ajenos', function () {
    actingAsSeed('U14');
    [$passenger, $type] = ptdocPending($this->getJson('/api/v1/portal/client/reservations/RES-2026-000344')->json('data'));
    $url = "/api/v1/reservations/RES-2026-000344/travel-docs/{$passenger}/{$type}/files";

    expect($this->post($url, ['file' => ptdocJpeg('pasaporte.jpg', FakeMalwareScanner::marker())], ['Accept' => 'application/json']))->toBeApiError(422, 'FILE_INFECTED')
        ->and(Storage::disk((string) config('filesystems.default'))->allFiles())->toBe([]);
    $this->post("/api/v1/reservations/RES-2026-000344/travel-docs/{$passenger}/{$type}/files", ['file' => UploadedFile::fake()->create('pasaporte.exe', 20, 'application/x-msdownload')], ['Accept' => 'application/json'])->assertStatus(422);
    expect(withinTenant(tenantA(), fn () => DB::table('ops_travel_doc_items')->where('passenger_id', $passenger)->where('doc_type', $type)->value('status')))->toBe('pendiente');

    $other = withinTenant(tenantA(), fn () => DB::table('ops_travel_doc_items as i')->join('booking_reservations as r', 'r.id', '=', 'i.reservation_id')->where('r.code', 'RES-2026-000345')->where('i.doc_type', 'id_doc')->value('i.passenger_id'));
    expect($this->post("/api/v1/reservations/RES-2026-000345/travel-docs/{$other}/id_doc/files", ['file' => ptdocJpeg('dni.jpg')], ['Accept' => 'application/json']))->toBeApiError(404);

    actingAsSeed('U15');
    expect($this->post("/api/v1/reservations/RES-2026-000344/travel-docs/{$passenger}/{$type}/files", ['file' => ptdocJpeg('dni.jpg')], ['Accept' => 'application/json']))->toBeApiError(404);
});

it('DOC-11 §8: el correo de documento observado invita a subirlo desde el portal si el cliente tiene acceso', function () {
    actingAsSeed('U05');
    $own = withinTenant(tenantA(), fn () => DB::table('ops_travel_doc_items as i')->join('booking_reservations as r', 'r.id', '=', 'i.reservation_id')->where('r.code', 'RES-2026-000344')->whereIn('i.doc_type', ['id_doc', 'insurance'])->first(['i.id', 'i.passenger_id', 'i.doc_type']));
    $this->postJson("/api/v1/reservations/RES-2026-000344/travel-docs/{$own->passenger_id}/{$own->doc_type}/observe", ['reason' => 'La foto está borrosa, envía una más nítida.'])->assertOk();

    $body = withinTenant(tenantA(), fn () => DB::table('notif_messages')->where('event_code', 'documentos.observado')->where('source_id', $own->id)->value('body_rendered'));
    expect($body)->toContain('/portal/viajes/RES-2026-000344')->not->toContain('respondiendo este correo');

    $foreign = withinTenant(tenantA(), fn () => DB::table('ops_travel_doc_items as i')->join('booking_reservations as r', 'r.id', '=', 'i.reservation_id')->where('r.code', 'RES-2026-000345')->where('i.doc_type', 'id_doc')->first(['i.id', 'i.passenger_id']));
    $this->postJson("/api/v1/reservations/RES-2026-000345/travel-docs/{$foreign->passenger_id}/id_doc/observe", ['reason' => 'El pasaporte está vencido, envía el vigente.'])->assertOk();
    $plain = withinTenant(tenantA(), fn () => DB::table('notif_messages')->where('event_code', 'documentos.observado')->where('source_id', $foreign->id)->value('body_rendered'));
    expect($plain)->toContain('respondiendo este correo')->not->toContain('/portal/viajes/');
});

it('DOC-BR-011: Ventas no carga documentos aunque la ruta acepte al portal', function () {
    actingAsSeed('U03');
    $item = withinTenant(tenantA(), fn () => DB::table('ops_travel_doc_items as i')->join('booking_reservations as r', 'r.id', '=', 'i.reservation_id')->where('r.code', 'RES-2026-000344')->where('i.doc_type', 'id_doc')->value('i.passenger_id'));
    $response = $this->post("/api/v1/reservations/RES-2026-000344/travel-docs/{$item}/id_doc/files", ['file' => ptdocJpeg('dni.jpg')], ['Accept' => 'application/json']);

    expect($response)->toBeApiError(403)->and($response->json('required_permissions'))->toContain('operations.travel_docs');
});
