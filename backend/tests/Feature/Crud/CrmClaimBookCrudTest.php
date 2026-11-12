<?php

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

function crmHojaSede(string $name = 'Lima — Miraflores'): string
{
    return (string) withinTenant(tenantA(), fn () => DB::table('iam_sedes')->where('name', $name)->value('id'));
}

function crmHojaDatos(array $extra = []): array
{
    return [
        'type' => 'reclamo',
        'consumer_name' => 'Rocío Valdivia Paz',
        'consumer_doc_type' => 'DNI',
        'consumer_doc_number' => '41553200',
        'consumer_email' => 'rocio.valdivia@correo.pe',
        'consumer_phone' => '988 112 334',
        'consumer_address' => 'Av. Larco 345, Miraflores',
        'good_kind' => 'Servicio',
        'good_description' => 'City tour Lima colonial',
        'good_amount' => 180,
        'good_currency' => 'PEN',
        'detail' => 'El tour salió una hora tarde y no se visitó la Catedral.',
        'request' => 'Devolución parcial del servicio.',
        'email_consent' => true,
        ...$extra,
    ];
}

function crmHojaEdicion(string $code, array $extra = []): array
{
    $row = rowOf('crm_cases', $code);
    $consumer = json_decode((string) $row->consumer, true);
    $good = json_decode((string) $row->good, true);

    return [
        'type' => $row->type_code,
        'consumer_name' => $consumer['name'],
        'consumer_doc_type' => $consumer['doc_type'] ?? $consumer['docType'],
        'consumer_doc_number' => $consumer['doc_number'] ?? $consumer['docNumber'],
        'consumer_email' => $consumer['email'] ?? null,
        'consumer_phone' => $consumer['phone'] ?? null,
        'consumer_address' => $consumer['address'] ?? null,
        'good_kind' => $good['kind'],
        'good_description' => $good['description'],
        'good_amount' => $good['amount'] ?? 0,
        'good_currency' => $good['currency'] ?? 'PEN',
        'detail' => $row->detail,
        'request' => $row->request,
        ...$extra,
    ];
}

function crmHojaEventos(string $code): array
{
    $id = rowOf('crm_cases', $code)->id;

    return withinTenant(tenantA(), fn () => DB::table('crm_case_events')->where('case_id', $id)->orderBy('created_at')->pluck('event')->all());
}

function crmHojaAuditoria(string $bookNumber, string $action): ?object
{
    return withinTenant(tenantA(), fn () => DB::table('audit_events')->where('entity', 'Libro de reclamaciones')->where('entity_id', $bookNumber)->where('action', $action)->first());
}

it('registrar una hoja le asigna correlativo de la sede, plazo hábil y aparece en el libro', function () {
    actingAsSeed('U01');

    $code = $this->postJson('/api/v1/crm/claim-book', ['sede_id' => crmHojaSede(), ...crmHojaDatos(['client' => 'CLI-0001', 'reservation' => 'RES-2026-000344'])], critical())
        ->assertCreated()->json('data.code');

    $claim = rowOf('crm_cases', $code);
    $due = Carbon::parse($claim->due_date);

    expect($claim->is_book)->toBeTrue()
        ->and($claim->book_number)->toBe('LR-LIM-2026-000008')
        ->and($claim->book_status)->toBe('received')
        ->and($claim->status)->toBe('abierta')
        ->and($claim->priority)->toBe('alta')
        ->and($claim->client_id)->toBe(rowOf('crm_clients', 'CLI-0001')->id)
        ->and($claim->reservation_id)->toBe(reservationRow('RES-2026-000344')->id)
        ->and((int) $claim->response_days)->toBe(15)
        ->and($due->gt(Carbon::parse(BUSINESS_TODAY)->addDays(15)))->toBeTrue()
        ->and($due->isWeekend())->toBeFalse()
        ->and($claim->ack_sent_at)->not->toBeNull()
        ->and(json_decode((string) $claim->consumer, true)['doc_number'])->toBe('41553200')
        ->and(crmHojaEventos($code))->toBe(['registro'])
        ->and(crmHojaAuditoria('LR-LIM-2026-000008', 'registrar'))->not->toBeNull()
        ->and(collect($this->getJson('/api/v1/crm/claim-book')->assertOk()->json('data.claims'))->pluck('code'))->toContain($code);

    $ack = DB::table('notif_messages')->where('source_id', $claim->id)->where('event_code', 'reclamacion.constancia')->first();
    expect($ack)->not->toBeNull()
        ->and($ack->recipient_address)->toBe(json_decode((string) $claim->consumer, true)['email'])
        ->and($ack->body_rendered)->toContain('LR-LIM-2026-000008')->toContain('41553200')->toContain((string) $claim->request);
});

it('una queja sin cliente vinculado toma la reserva para ubicar al cliente', function () {
    actingAsSeed('U01');

    $code = $this->postJson('/api/v1/crm/claim-book', ['sede_id' => crmHojaSede('Cusco — Centro Histórico'), ...crmHojaDatos(['type' => 'queja', 'reservation' => 'RES-2026-000347'])], critical())
        ->assertCreated()->json('data.code');

    $claim = rowOf('crm_cases', $code);
    expect($claim->book_number)->toBe('LR-CUS-2026-000012')
        ->and($claim->priority)->toBe('media')
        ->and($claim->client_id)->toBe(rowOf('crm_clients', 'CLI-0003')->id);
});

it('registrar una hoja valida sede, tipo, documento y que la reserva sea del cliente', function () {
    actingAsSeed('U01');

    $this->postJson('/api/v1/crm/claim-book', crmHojaDatos(['type' => 'consulta', 'consumer_doc_number' => '41-553', 'detail' => 'Corto']), critical())
        ->assertStatus(422)->assertJsonValidationErrors(['sede_id', 'type', 'consumer_doc_number', 'detail']);
    expect($this->postJson('/api/v1/crm/claim-book', ['sede_id' => crmHojaSede(), ...crmHojaDatos(['client' => 'CLI-0002', 'reservation' => 'RES-2026-000344'])], critical()))->toBeApiError(422, 'VALIDATION_ERROR');
});

it('la hoja presencial exige domicilio, correo y la aceptación de la respuesta por correo', function () {
    actingAsSeed('U01');

    $this->postJson('/api/v1/crm/claim-book', ['sede_id' => crmHojaSede(), ...crmHojaDatos(['consumer_email' => null, 'consumer_address' => null, 'email_consent' => false, 'consumer_doc_number' => '4155320', 'detail' => 'Demora de una hora.'])], critical())
        ->assertStatus(422)->assertJsonValidationErrors(['consumer_email', 'consumer_address', 'email_consent', 'consumer_doc_number', 'detail']);
});

it('una hoja de un menor exige al padre, madre o apoderado y lo guarda con el formato del kit', function () {
    actingAsSeed('U01');

    $this->postJson('/api/v1/crm/claim-book', ['sede_id' => crmHojaSede(), ...crmHojaDatos(['is_minor' => true])], critical())
        ->assertStatus(422)->assertJsonValidationErrors(['guardian_name', 'guardian_doc_type', 'guardian_doc_number', 'guardian_relation']);

    $code = $this->postJson('/api/v1/crm/claim-book', ['sede_id' => crmHojaSede(), ...crmHojaDatos(['is_minor' => true, 'guardian_name' => 'Rosa Carpio Delgado', 'guardian_doc_type' => 'DNI', 'guardian_doc_number' => '29654102', 'guardian_relation' => 'Madre'])], critical())
        ->assertCreated()->json('data.code');

    $consumer = json_decode((string) rowOf('crm_cases', $code)->consumer, true);
    $sheet = collect($this->getJson('/api/v1/crm/claim-book')->assertOk()->json('data.claims'))->firstWhere('code', $code);

    expect($consumer['is_minor'])->toBeTrue()
        ->and($consumer['guardian'])->toBe(['name' => 'Rosa Carpio Delgado', 'doc_type' => 'DNI', 'doc_number' => '29654102', 'relation' => 'Madre'])
        ->and($sheet['consumer']['is_minor'])->toBeTrue()
        ->and($sheet['consumer']['guardian']['relation'])->toBe('Madre');
});

it('Ventas no gestiona el libro de reclamaciones', function () {
    actingAsSeed('U03');

    expect($this->postJson('/api/v1/crm/claim-book', ['sede_id' => crmHojaSede(), ...crmHojaDatos()], critical()))->toBeApiError(403);
});

it('editar una hoja recibida vincula cliente y reserva, registra el seguimiento y sube la versión', function () {
    actingAsSeed('U01');
    $version = (int) rowOf('crm_cases', 'REC-0020')->lock_version;

    $this->patchJson('/api/v1/crm/claim-book/REC-0020', crmHojaEdicion('REC-0020', ['client' => 'CLI-0010', 'reservation' => 'RES-2026-000349', 'good_description' => 'Paquete Cusco 4D/3N']))->assertOk();

    $claim = rowOf('crm_cases', 'REC-0020');
    expect($claim->client_id)->toBe(rowOf('crm_clients', 'CLI-0010')->id)
        ->and($claim->reservation_id)->toBe(reservationRow('RES-2026-000349')->id)
        ->and(json_decode((string) $claim->good, true)['description'])->toBe('Paquete Cusco 4D/3N')
        ->and((int) $claim->lock_version)->toBe($version + 1)
        ->and(crmHojaEventos('REC-0020'))->toContain('seguimiento')
        ->and(crmHojaAuditoria($claim->book_number, 'vincular'))->not->toBeNull();
});

it('el detalle, el pedido y los datos del consumidor de la hoja no se modifican', function () {
    actingAsSeed('U01');
    $before = rowOf('crm_cases', 'REC-0020');

    expect($this->patchJson('/api/v1/crm/claim-book/REC-0020', crmHojaEdicion('REC-0020', ['detail' => 'Detalle reescrito por la agencia.'])))->toBeApiError(422, 'LR-BR-08');
    expect($this->patchJson('/api/v1/crm/claim-book/REC-0020', crmHojaEdicion('REC-0020', ['consumer_name' => 'Otra Persona'])))->toBeApiError(422, 'LR-BR-08');

    $after = rowOf('crm_cases', 'REC-0020');
    expect($after->detail)->toBe($before->detail)
        ->and($after->consumer)->toBe($before->consumer);
});

it('una hoja respondida ya no se edita', function () {
    actingAsSeed('U01');

    expect($this->patchJson('/api/v1/crm/claim-book/REC-0018', crmHojaEdicion('REC-0018', ['good_description' => 'Cambio tardío'])))->toBeApiError(409, 'LR-STATE');
});

it('una hoja recibida se responde directo, sin pasar por evaluación, y aparece en Postventa', function () {
    actingAsSeed('U01');

    expect(collect($this->getJson('/api/v1/crm/after-sales')->assertOk()->json('data.cases'))->firstWhere('code', 'REC-0020')['is_book'] ?? null)->toBeTrue();

    $this->postJson('/api/v1/crm/claim-book/REC-0020/response', ['decision' => 'Procedente', 'text' => 'Se reconoce el reclamo y se devolverá el importe del traslado.', 'actions' => 'Devolución del traslado'], critical())->assertOk();
    expect(rowOf('crm_cases', 'REC-0020')->book_status)->toBe('answered');
});

it('responder una hoja en evaluación la deja respondida con la decisión y el envío al consumidor', function () {
    actingAsSeed('U01');

    $this->postJson('/api/v1/crm/claim-book/REC-0019/response', ['decision' => 'Procedente en parte', 'text' => 'Se reconoce la demora y se devolverá el 30 % del servicio.', 'actions' => 'Nota de crédito'], critical())->assertOk();

    $claim = rowOf('crm_cases', 'REC-0019');
    $response = json_decode((string) $claim->response, true);
    expect($claim->book_status)->toBe('answered')
        ->and($claim->status)->toBe('resuelta')
        ->and($claim->resolution)->toContain('30 %')
        ->and($claim->resolved_at)->not->toBeNull()
        ->and($response['decision'])->toBe('Procedente en parte')
        ->and($response['sent_at'])->not->toBeNull()
        ->and(crmHojaAuditoria($claim->book_number, 'responder')->after_value)->toBe('answered');

    $message = DB::table('notif_messages')->where('id', $response['notification_id'])->first();
    expect($message->event_code)->toBe('reclamacion.respuesta')
        ->and($message->recipient_address)->toBe($response['sent_to'])
        ->and($message->body_rendered)->toContain('Procedente en parte')->toContain('Nota de crédito');
});

it('reenviar la respuesta vuelve a mandar el correo y queda en el historial', function () {
    actingAsSeed('U01');
    $this->postJson('/api/v1/crm/claim-book/REC-0019/response', ['decision' => 'Procedente en parte', 'text' => 'Se reconoce la demora y se devolverá el 30 % del servicio.', 'actions' => 'Nota de crédito'], critical())->assertOk();
    $first = json_decode((string) rowOf('crm_cases', 'REC-0019')->response, true)['notification_id'];

    $this->postJson('/api/v1/crm/claim-book/REC-0019/response/resend', [], critical())->assertOk();

    $response = json_decode((string) rowOf('crm_cases', 'REC-0019')->response, true);
    expect($response['notification_id'])->not->toBe($first)
        ->and($response['resent'])->toBe(1)
        ->and(crmHojaAuditoria(rowOf('crm_cases', 'REC-0019')->book_number, 'reenviar_respuesta'))->not->toBeNull();
    expect($this->postJson('/api/v1/crm/claim-book/REC-0021/response/resend', [], critical()))->toBeApiError(409, 'LR-STATE');
});

it('pasar a evaluación permite elegir el responsable y le avisa', function () {
    actingAsSeed('U01');
    $owner = seedUser('U02')->id;

    $this->postJson('/api/v1/crm/claim-book/REC-0021/review', ['owner_id' => $owner, 'note' => 'Revisar con el hotel'], critical((int) rowOf('crm_cases', 'REC-0021')->lock_version))->assertOk();

    $claim = rowOf('crm_cases', 'REC-0021');
    expect($claim->owner_id)->toBe($owner)
        ->and(withinTenant(tenantA(), fn () => DB::table('notif_messages')->where('event_code', 'reclamacion.asignada')->where('source_id', $claim->id)->value('recipient_user_id')))->toBe($owner);
});

it('responder fuera de plazo queda marcado en la auditoría', function () {
    actingAsSeed('U01');

    $this->postJson('/api/v1/crm/claim-book/REC-0017/response', ['decision' => 'No procedente', 'text' => 'El servicio se prestó según lo contratado y quedó documentado en la orden.', 'actions' => 'Se revisó la orden de servicio con el guía.'], critical())->assertOk();

    expect(crmHojaAuditoria('LR-AQP-2026-000003', 'responder')->after_value)->toContain('FUERA DE PLAZO');
});

it('responder valida la decisión y el texto, y una hoja cerrada no se responde', function () {
    actingAsSeed('U01');

    $this->postJson('/api/v1/crm/claim-book/REC-0019/response', ['decision' => 'Tal vez', 'text' => 'Corto'], critical())->assertStatus(422)->assertJsonValidationErrors(['decision', 'text', 'actions']);
    expect($this->postJson('/api/v1/crm/claim-book/REC-0015/response', ['decision' => 'Procedente', 'text' => 'Respuesta que llega cuando la hoja ya fue cerrada hace varios días.', 'actions' => 'Ninguna, la hoja ya estaba cerrada.'], critical()))->toBeApiError(409, 'LR-STATE');
});

it('cerrar una hoja respondida guarda la nota y la deja cerrada', function () {
    actingAsSeed('U01');

    $this->postJson('/api/v1/crm/claim-book/REC-0018/close', ['note' => 'Consumidor conforme con la respuesta'], critical((int) rowOf('crm_cases', 'REC-0018')->lock_version))->assertOk();

    $claim = rowOf('crm_cases', 'REC-0018');
    expect($claim->book_status)->toBe('closed')
        ->and($claim->status)->toBe('cerrada')
        ->and($claim->close_note)->toBe('Consumidor conforme con la respuesta')
        ->and($claim->closed_at)->not->toBeNull()
        ->and(crmHojaAuditoria($claim->book_number, 'cerrar'))->not->toBeNull();
});

it('cerrar exige nota y solo aplica a hojas respondidas', function () {
    actingAsSeed('U01');

    $this->postJson('/api/v1/crm/claim-book/REC-0018/close', [], critical((int) rowOf('crm_cases', 'REC-0018')->lock_version))->assertStatus(422)->assertJsonValidationErrors('note');
    expect($this->postJson('/api/v1/crm/claim-book/REC-0020/close', ['note' => 'Cierre sin respuesta'], critical((int) rowOf('crm_cases', 'REC-0020')->lock_version)))->toBeApiError(409, 'LR-STATE')
        ->and(rowOf('crm_cases', 'REC-0020')->book_status)->toBe('received');
});
