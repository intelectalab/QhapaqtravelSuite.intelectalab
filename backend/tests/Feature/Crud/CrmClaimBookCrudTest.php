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
        'consumer_doc_type' => $consumer['docType'],
        'consumer_doc_number' => $consumer['docNumber'],
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
        ->and(json_decode((string) $claim->consumer, true)['docNumber'])->toBe('41553200')
        ->and(crmHojaEventos($code))->toBe(['registro'])
        ->and(crmHojaAuditoria('LR-LIM-2026-000008', 'registrar'))->not->toBeNull()
        ->and(collect($this->getJson('/api/v1/crm/claim-book')->assertOk()->json('data.claims'))->pluck('code'))->toContain($code);
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
});

it('responder fuera de plazo queda marcado en la auditoría', function () {
    actingAsSeed('U01');

    $this->postJson('/api/v1/crm/claim-book/REC-0017/response', ['decision' => 'No procedente', 'text' => 'El servicio se prestó según lo contratado y documentado.'], critical())->assertOk();

    expect(crmHojaAuditoria('LR-AQP-2026-000003', 'responder')->after_value)->toContain('FUERA DE PLAZO');
});

it('responder valida la decisión y el texto, y una hoja cerrada no se responde', function () {
    actingAsSeed('U01');

    $this->postJson('/api/v1/crm/claim-book/REC-0019/response', ['decision' => 'Tal vez', 'text' => 'Corto'], critical())->assertStatus(422)->assertJsonValidationErrors(['decision', 'text']);
    expect($this->postJson('/api/v1/crm/claim-book/REC-0015/response', ['decision' => 'Procedente', 'text' => 'Respuesta que llega cuando la hoja ya fue cerrada.'], critical()))->toBeApiError(409, 'LR-STATE');
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
