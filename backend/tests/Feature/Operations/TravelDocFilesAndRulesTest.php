<?php

use Carbon\CarbonImmutable;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;

beforeEach(function () {
    Storage::fake((string) config('filesystems.default'));
});

function docItem(string $reservation, string $type = 'id_doc'): object
{
    return withinTenant(tenantA(), fn () => DB::table('ops_travel_doc_items')->where('reservation_id', reservationRow($reservation)->id)->where('doc_type', $type)->orderBy('doc_number')->first());
}

function docAudit(array $where): bool
{
    return withinTenant(tenantA(), fn () => DB::table('audit_events')->where($where)->exists());
}

it('Operaciones sube y reemplaza el archivo de un documento y lo deja por validar', function () {
    actingAsSeed('U05');
    $item = docItem('RES-2026-000345');
    $url = "/api/v1/reservations/RES-2026-000345/travel-docs/{$item->passenger_id}/id_doc/files";

    $this->post("/api/v1/reservations/RES-2026-000345/travel-docs/{$item->passenger_id}/id_doc/files", ['file' => UploadedFile::fake()->create('pasaporte.exe', 20, 'application/x-msdownload')], ['Accept' => 'application/json'])->assertStatus(422);
    $this->post("/api/v1/reservations/RES-2026-000345/travel-docs/{$item->passenger_id}/id_doc/files", ['file' => UploadedFile::fake()->create('pasaporte.pdf', 120, 'application/pdf'), 'doc_number' => 'PA9981', 'expiry_date' => '2031-05-01'], ['Accept' => 'application/json'])->assertCreated();

    $row = rowOf('ops_travel_doc_items', $item->id, column: 'id');
    expect($row->status)->toBe('recibido')
        ->and($row->file_name)->toBe('pasaporte.pdf')
        ->and($row->doc_number)->toBe('PA9981')
        ->and($row->file_id)->not->toBeNull()
        ->and(docAudit(['entity' => 'Documento de viaje', 'action' => 'cargar']))->toBeTrue();

    $this->post($url, ['file' => UploadedFile::fake()->image('pasaporte.png')], ['Accept' => 'application/json'])->assertCreated();
    $after = rowOf('ops_travel_doc_items', $item->id, column: 'id');
    expect($after->file_name)->toBe('pasaporte.png')
        ->and($after->file_id)->not->toBe($row->file_id)
        ->and(docAudit(['entity' => 'Documento de viaje', 'action' => 'reemplazar_archivo']))->toBeTrue();

    $this->get("/api/v1/reservations/RES-2026-000345/travel-docs/{$item->passenger_id}/id_doc/file")->assertOk();

    actingAsSeed('U03');
    expect($this->post($url, ['file' => UploadedFile::fake()->create('otro.pdf', 10, 'application/pdf')], ['Accept' => 'application/json']))->toBeApiError(403);
});

it('registra el contacto de emergencia y la atención especial sin términos clínicos', function () {
    actingAsSeed('U05');
    $item = docItem('RES-2026-000345');
    $base = "/api/v1/reservations/RES-2026-000345/travel-docs/{$item->passenger_id}";

    $this->putJson("{$base}/emergency-contact", ['name' => 'Ana', 'phone' => 'x', 'relation' => 'Vecino'])->assertStatus(422)->assertJsonValidationErrors(['phone', 'relation']);
    $this->putJson("/api/v1/reservations/RES-2026-000345/travel-docs/{$item->passenger_id}/emergency-contact", ['name' => 'Ana Flores', 'phone' => '+51 984 112 233', 'relation' => 'Familiar'])->assertOk();
    expect(withinTenant(tenantA(), fn () => DB::table('ops_travel_doc_contacts')->where('passenger_id', $item->passenger_id)->value('phone')))->toBe('+51 984 112 233')
        ->and(docAudit(['entity' => 'Documento de viaje', 'action' => 'registrar_contacto']))->toBeTrue();

    expect($this->putJson("{$base}/special-attention", ['requires_attention' => true, 'operational_note' => 'Tiene diabetes tipo 2']))->toBeApiError(422, 'DOC-BR-009');
    $this->putJson("{$base}/special-attention", ['requires_attention' => true])->assertStatus(422)->assertJsonValidationErrors('operational_note');
    $this->putJson("/api/v1/reservations/RES-2026-000345/travel-docs/{$item->passenger_id}/special-attention", ['requires_attention' => true, 'operational_note' => 'Asiento delantero en el bus; dieta sin gluten'])->assertOk();

    $passenger = collect($this->getJson('/api/v1/reservations/RES-2026-000345/travel-docs')->json('data.passengers'))->firstWhere('id', $item->passenger_id);
    expect($passenger['contact']['relation'])->toBe('Familiar')
        ->and($passenger['attention']['flag'])->toBeTrue()
        ->and($passenger['attention']['note'])->toContain('Asiento delantero');
});

it('las reglas guardan los valores del kit y cambian la aplicabilidad y la vigencia del pasaporte', function () {
    actingAsSeed('U05');

    $defaults = $this->getJson('/api/v1/settings/travel-docs')->assertOk()->json('data');
    expect($defaults['passport_months'])->toBe(6)
        ->and($defaults['visa_nationalities'])->toBe(['China', 'India', 'Vietnamita'])
        ->and($defaults['insurance_trekking'])->toBeTrue()
        ->and($defaults['channels'])->toBe(['Email', 'WhatsApp']);

    $this->putJson('/api/v1/settings/travel-docs', ['reminder_days' => [10], 'passport_months' => 30])->assertStatus(422)->assertJsonValidationErrors('passport_months');
    $this->putJson('/api/v1/settings/travel-docs', ['reminder_days' => [10], 'channels' => ['Fax']])->assertStatus(422)->assertJsonValidationErrors('channels.0');
    $saved = $this->putJson('/api/v1/settings/travel-docs', ['reminder_days' => [10, 3], 'passport_months' => 3, 'visa_nationalities' => ['China', ' India '], 'insurance_trekking' => false, 'channels' => ['Email']])->assertOk()->json('data');
    expect($saved['passport_months'])->toBe(3)
        ->and($saved['visa_nationalities'])->toBe(['China', 'India'])
        ->and($saved['insurance_trekking'])->toBeFalse()
        ->and($saved['channels'])->toBe(['Email'])
        ->and(collect($this->getJson('/api/v1/settings/travel-docs')->json('data.rules'))->firstWhere('code', 'DOC-BR-001')['text'])->toContain('3 meses')
        ->and(docAudit(['entity' => 'Documentos de viaje', 'entity_id' => 'reglas', 'action' => 'editar_reglas']))->toBeTrue();

    $foreign = withinTenant(tenantA(), function (): ?object {
        return DB::table('ops_travel_doc_items as i')->join('booking_passengers as p', 'p.id', '=', 'i.passenger_id')->join('booking_reservations as r', 'r.id', '=', 'i.reservation_id')
            ->where('i.doc_type', 'id_doc')->where('p.nationality', '!~*', 'peru')->whereNotNull('p.nationality')->whereNull('r.deleted_at')->where('r.status', '<>', 'cancelada')
            ->first(['i.id', 'i.passenger_id', 'r.code', 'r.travel_to']);
    });

    if ($foreign !== null) {
        withinTenant(tenantA(), fn () => DB::table('ops_travel_doc_items')->where('id', $foreign->id)->update(['file_id' => null]));
        expect($this->postJson("/api/v1/reservations/{$foreign->code}/travel-docs/{$foreign->passenger_id}/id_doc/validate", ['doc_number' => 'X1234567', 'expiry_date' => '2040-01-01'], critical()))->toBeApiError(422, 'DOC-BR-013');
        withinTenant(tenantA(), fn () => DB::table('ops_travel_doc_items')->where('id', $foreign->id)->update(['file_id' => DB::table('sys_documents')->insertGetId(['doc_type' => 'travel_doc', 'storage_path' => 'pruebas/pasaporte.pdf', 'file_name' => 'pasaporte.pdf', 'mime_type' => 'application/pdf', 'sha256' => str_repeat('a', 64)])]));
        $expiry = CarbonImmutable::parse($foreign->travel_to)->addMonths(2)->toDateString();
        expect($this->postJson("/api/v1/reservations/{$foreign->code}/travel-docs/{$foreign->passenger_id}/id_doc/validate", ['doc_number' => 'X1234567', 'expiry_date' => $expiry], critical()))->toBeApiError(422, 'DOC-BR-001');
    }
});

it('el asesor solicita los documentos pendientes al cliente por correo y queda en el historial', function () {
    Queue::fake();
    $row = withinTenant(tenantA(), fn () => DB::table('booking_reservations as r')->join('iam_users as u', 'u.id', '=', 'r.owner_id')->join('crm_clients as c', 'c.id', '=', 'r.client_id')->whereNull('r.deleted_at')->where('r.status', '<>', 'cancelada')->whereNotNull('c.email')
        ->whereExists(fn ($query) => $query->from('ops_travel_doc_items as i')->whereColumn('i.reservation_id', 'r.id')->whereIn('i.status', ['pendiente', 'observado']))->orderBy('r.code')->first(['r.code', 'u.code as owner']));
    expect($row)->not->toBeNull();
    $reservation = $row->code;
    actingAsSeed($row->owner);

    $result = $this->postJson("/api/v1/reservations/{$reservation}/travel-docs/requests", ['channels' => ['Email', 'WhatsApp']])->assertCreated()->json('data');
    expect($result['items'])->toBeGreaterThan(0)
        ->and($result['not_sent'])->toBe(['WhatsApp'])
        ->and(withinTenant(tenantA(), fn () => DB::table('ops_travel_doc_reminders')->where('reservation_id', reservationRow($reservation)->id)->where('trigger', 'manual')->exists()))->toBeTrue()
        ->and(docAudit(['entity' => 'Documento de viaje', 'entity_id' => $reservation, 'action' => 'solicitar_documentos']))->toBeTrue();

    expect($this->postJson("/api/v1/reservations/{$reservation}/travel-docs/requests", ['channels' => ['WhatsApp']]))->toBeApiError(422, 'DOC-BR-012');
});
