<?php

use App\Domain\Documents\Support\VoucherSheet;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;

beforeEach(function () {
    lockSeededBookings();
    Queue::fake();
    freezeBusinessToday();
});

function ventasReservaConfirmada(): string
{
    actingAsSeed('U01');

    return (string) test()->postJson('/api/v1/reservations', [
        'client_id' => 'CLI-0003',
        'product_id' => 'CUS-HUM-FD',
        'departure_id' => departureRow('SAL-0403')->id,
        'adt' => 2,
        'confirm' => true,
    ], critical())->assertCreated()->json('data.code');
}

function ventasCambioPendiente(string $code, array $body): string
{
    test()->postJson("/api/v1/reservations/{$code}/changes", $body, critical(reservationLock($code)))->assertCreated();

    return (string) withinTenant(tenantA(), fn () => DB::table('booking_changes')->where('reservation_id', reservationRow($code)->id)->where('status', 'pendiente')->orderByDesc('requested_at')->value('id'));
}

function ventasEstadoFinanciero(string $code): array
{
    return withinTenant(tenantA(), function () use ($code): array {
        $id = reservationRow($code)->id;

        return [
            'receivables' => DB::table('fin_receivables')->where('reservation_id', $id)->whereNull('deleted_at')->orderBy('due_date')->orderBy('code')->get(),
            'services' => DB::table('booking_reservation_services')->where('reservation_id', $id)->orderBy('code')->get(),
            'payables' => DB::table('fin_payables')->where('reservation_id', $id)->where('kind', 'servicio')->whereNull('deleted_at')->get()->keyBy('reservation_service_id'),
            'passengers' => DB::table('booking_passengers')->where('reservation_id', $id)->orderBy('seq')->get(),
        ];
    });
}

function ventasAuditoriaReserva(string $code, string $action): ?object
{
    return withinTenant(tenantA(), fn () => DB::table('audit_events')->where('entity', 'Reserva')->where('entity_id', $code)->where('action', $action)->orderByDesc('occurred_at')->first());
}

function ventasPrimerPasajero(string $code): object
{
    return withinTenant(tenantA(), fn () => DB::table('booking_passengers')->where('reservation_id', reservationRow($code)->id)->orderBy('seq')->first());
}

it('editar las notas de la reserva las guarda, sube la versión y queda en el historial', function () {
    actingAsSeed('U05');
    $lock = reservationLock('RES-2026-000349');

    $this->patchJson('/api/v1/reservations/RES-2026-000349', ['notes' => 'El cliente llega en el vuelo LA2047'], critical($lock))->assertOk();

    expect(reservationRow('RES-2026-000349')->notes)->toBe('El cliente llega en el vuelo LA2047')
        ->and(reservationLock('RES-2026-000349'))->toBe($lock + 1)
        ->and(ventasAuditoriaReserva('RES-2026-000349', 'editar')?->after_value)->toBe('El cliente llega en el vuelo LA2047');
    $this->getJson('/api/v1/reservations/RES-2026-000349')->assertOk()->assertJsonPath('data.notes', 'El cliente llega en el vuelo LA2047');
});

it('editar las notas exige If-Match vigente y valida la longitud', function () {
    actingAsSeed('U05');
    $lock = reservationLock('RES-2026-000349');

    expect($this->patchJson('/api/v1/reservations/RES-2026-000349', ['notes' => 'Sin versión'], ['Accept' => 'application/json']))->toBeApiError(428, 'IF_MATCH_REQUIRED');
    expect($this->patchJson('/api/v1/reservations/RES-2026-000349', ['notes' => 'Versión vieja'], critical($lock + 5))->status())->toBeIn([409, 412]);
    $this->patchJson('/api/v1/reservations/RES-2026-000349', ['notes' => str_repeat('a', 2001)], critical($lock))->assertStatus(422)->assertJsonValidationErrors('notes');
    expect(reservationRow('RES-2026-000349')->notes)->not->toBe('Versión vieja');
});

it('una reserva cerrada no admite cambios de notas', function () {
    actingAsSeed('U01');

    expect($this->patchJson('/api/v1/reservations/RES-2026-000343', ['notes' => 'Intento'], critical(reservationLock('RES-2026-000343'))))->toBeApiError(409, 'RESERVATION_CLOSED');
});

it('Ventas no edita reservas porque no tiene permiso de modificar', function () {
    actingAsSeed('U03');

    expect($this->patchJson('/api/v1/reservations/RES-2026-000349', ['notes' => 'Intento'], critical(reservationLock('RES-2026-000349'))))->toBeApiError(403);
});

it('editar un pasajero cambia su ficha en la reserva, en la ficha de documentos y en el voucher', function () {
    actingAsSeed('U01');
    $passenger = ventasPrimerPasajero('RES-2026-000347');
    $lock = reservationLock('RES-2026-000347');

    $response = $this->patchJson("/api/v1/reservations/RES-2026-000347/passengers/{$passenger->id}", [
        'full_name' => 'Hannah Becker Schulz',
        'pax_type' => 'ADT',
        'doc_type' => 'Pasaporte',
        'doc_number' => 'C9X11223',
        'nationality' => 'Alemana',
        'birth_date' => '1991-06-14',
        'diet_notes' => 'Vegetariana',
    ], critical($lock))->assertOk();

    $detail = $this->getJson('/api/v1/reservations/RES-2026-000347')->assertOk()->json('data.passengers');
    $voucher = rowOf('ops_vouchers', 'VOU-2026-01201');
    $sheet = withinTenant(tenantA(), fn () => app(VoucherSheet::class)->draft((string) $voucher->id)->data);
    $docs = $this->getJson('/api/v1/reservations/RES-2026-000347/travel-docs')->assertOk()->json('data.passengers');

    expect($response->json('data.full_name'))->toBe('Hannah Becker Schulz')
        ->and(collect($detail)->firstWhere('id', $passenger->id)['doc_number'])->toBe('C9X11223')
        ->and(collect($sheet['passengers'])->pluck('name'))->toContain('Hannah Becker Schulz')
        ->and(collect($sheet['passengers'])->firstWhere('name', 'Hannah Becker Schulz')['document'])->toBe('Pasaporte C9X11223')
        ->and(collect($sheet['diets'])->pluck('name'))->toContain('Hannah Becker Schulz')
        ->and(collect($docs)->firstWhere('id', $passenger->id)['name'])->toBe('Hannah Becker Schulz')
        ->and(reservationLock('RES-2026-000347'))->toBe($lock + 1)
        ->and(ventasAuditoriaReserva('RES-2026-000347', 'editar_pasajero')?->after_value)->toBe('Hannah Becker Schulz');
});

it('editar un pasajero calcula su edad a la fecha del viaje y lo puede marcar como titular', function () {
    actingAsSeed('U01');
    $passengers = ventasEstadoFinanciero('RES-2026-000344')['passengers'];
    $target = $passengers->firstWhere('is_lead', false);

    $this->patchJson("/api/v1/reservations/RES-2026-000344/passengers/{$target->id}", [
        'full_name' => 'Mateo Torres Quispe',
        'pax_type' => 'CHD',
        'doc_type' => 'DNI',
        'doc_number' => '81234567',
        'nationality' => 'Peruana',
        'birth_date' => '2016-10-05',
        'is_lead' => true,
    ], critical(reservationLock('RES-2026-000344')))->assertOk();

    $after = ventasEstadoFinanciero('RES-2026-000344')['passengers'];

    expect(reservationRow('RES-2026-000344')->travel_from)->toBe('2026-10-12')
        ->and((int) $after->firstWhere('id', $target->id)->age)->toBe(10)
        ->and($after->where('is_lead', true)->pluck('id')->all())->toBe([$target->id]);
});

it('editar un pasajero valida el nombre, el tipo y la fecha de nacimiento', function () {
    actingAsSeed('U01');
    $passenger = ventasPrimerPasajero('RES-2026-000344');

    $this->patchJson("/api/v1/reservations/RES-2026-000344/passengers/{$passenger->id}", ['full_name' => 'A', 'pax_type' => 'XXX', 'birth_date' => '2030-01-01'], critical(reservationLock('RES-2026-000344')))
        ->assertStatus(422)->assertJsonValidationErrors(['full_name', 'pax_type', 'birth_date']);
    expect(ventasPrimerPasajero('RES-2026-000344')->full_name)->toBe($passenger->full_name);
});

it('editar un pasajero de otra reserva responde 404 y una reserva cerrada responde 409', function () {
    actingAsSeed('U01');
    $foreign = ventasPrimerPasajero('RES-2026-000348');
    $closed = ventasPrimerPasajero('RES-2026-000346');

    expect($this->patchJson("/api/v1/reservations/RES-2026-000344/passengers/{$foreign->id}", ['full_name' => 'Otra Persona', 'pax_type' => 'ADT', 'doc_type' => 'DNI', 'doc_number' => '45781200', 'nationality' => 'Peruana', 'birth_date' => '1985-02-03'], critical(reservationLock('RES-2026-000344'))))->toBeApiError(404);
    expect($this->patchJson("/api/v1/reservations/RES-2026-000346/passengers/{$closed->id}", ['full_name' => 'Otra Persona', 'pax_type' => 'ADT', 'doc_type' => 'DNI', 'doc_number' => '45781200', 'nationality' => 'Peruana', 'birth_date' => '1985-02-03'], critical(reservationLock('RES-2026-000346'))))->toBeApiError(409, 'RESERVATION_CLOSED');
    expect(ventasPrimerPasajero('RES-2026-000348')->full_name)->toBe($foreign->full_name);
});

it('Ventas no edita pasajeros', function () {
    actingAsSeed('U03');
    $passenger = ventasPrimerPasajero('RES-2026-000349');

    expect($this->patchJson("/api/v1/reservations/RES-2026-000349/passengers/{$passenger->id}", ['full_name' => 'Otro Nombre', 'pax_type' => 'ADT'], critical(reservationLock('RES-2026-000349'))))->toBeApiError(403);
});

it('aprobar una modificación de pasajeros suma el pasajero, ajusta el total, crea la cuota de ajuste, toma el cupo y ajusta las cuentas por pagar', function () {
    $code = ventasReservaConfirmada();
    $before = ventasEstadoFinanciero($code);
    $total = (string) reservationRow($code)->total_amount;
    $sold = (int) departureRow('SAL-0403')->sold;
    $change = ventasCambioPendiente($code, ['type' => 'pax', 'extra_pax' => 1, 'delta' => '150.00', 'description' => 'Se suma la hermana del titular']);

    expect(reservationRow($code)->total_amount)->toBe($total);

    actingAsSeed('U02');
    $this->postJson("/api/v1/reservations/{$code}/changes/{$change}/approve", [], critical(reservationLock($code)))->assertOk();

    $after = ventasEstadoFinanciero($code);
    $row = rowOf('booking_changes', $change, column: 'id');
    $adjustment = $after['receivables']->firstWhere('kind', 'ajuste');

    expect($row->status)->toBe('aplicada')
        ->and($row->decided_by)->toBe(seedUser('U02')->id)
        ->and($after['passengers'])->toHaveCount($before['passengers']->count() + 1)
        ->and($after['passengers']->where('is_placeholder', true))->toHaveCount($before['passengers']->where('is_placeholder', true)->count() + 1)
        ->and($after['passengers']->last()->pax_type)->toBe('ADT')
        ->and(bccomp((string) reservationRow($code)->total_amount, bcadd($total, '150.00', 2), 2))->toBe(0)
        ->and($adjustment)->not->toBeNull()
        ->and((string) $adjustment->amount)->toBe('150.00')
        ->and($adjustment->status)->toBe('abierta')
        ->and((int) departureRow('SAL-0403')->sold)->toBe($sold + 1)
        ->and(ventasAuditoriaReserva($code, 'modificar'))->not->toBeNull();

    $changed = 0;
    foreach ($after['services']->whereNotNull('provider_id') as $service) {
        if (bccomp((string) $service->cost_amount, '0', 2) !== 1) {
            continue;
        }
        $payable = $after['payables']->get($service->id);
        expect($payable)->not->toBeNull()
            ->and(bccomp((string) $payable->amount, (string) $service->cost_amount, 2))->toBe(0);
        $changed += bccomp((string) $payable->amount, (string) $before['payables']->get($service->id)?->amount, 2) !== 0 ? 1 : 0;
    }
    expect($changed)->toBeGreaterThan(0);
    expect(collect($this->getJson("/api/v1/reservations/{$code}")->assertOk()->json('data.changes')))->toBeEmpty();
});

it('aprobar una modificación con saldo a favor reduce la primera cuota abierta y no crea cuota de ajuste', function () {
    $code = ventasReservaConfirmada();
    $before = ventasEstadoFinanciero($code)['receivables'];
    $first = $before->first();
    $total = (string) reservationRow($code)->total_amount;
    $change = ventasCambioPendiente($code, ['type' => 'otro', 'delta' => '-100.00', 'description' => 'Se retira la cena de bienvenida']);

    actingAsSeed('U02');
    $this->postJson("/api/v1/reservations/{$code}/changes/{$change}/approve", [], critical(reservationLock($code)))->assertOk();

    $after = ventasEstadoFinanciero($code)['receivables'];

    expect(bccomp((string) $after->firstWhere('id', $first->id)->amount, bcsub((string) $first->amount, '100.00', 2), 2))->toBe(0)
        ->and($after->firstWhere('kind', 'ajuste'))->toBeNull()
        ->and(rowOf('booking_changes', $change, column: 'id')->credit_amount)->toBeNull()
        ->and(bccomp((string) reservationRow($code)->total_amount, bcsub($total, '100.00', 2), 2))->toBe(0);
});

it('una modificación ya aplicada no se vuelve a aprobar ni a rechazar', function () {
    $code = ventasReservaConfirmada();
    $change = ventasCambioPendiente($code, ['type' => 'upgrade', 'delta' => '80.00', 'description' => 'Mejora a habitación superior']);

    actingAsSeed('U02');
    $this->postJson("/api/v1/reservations/{$code}/changes/{$change}/approve", [], critical(reservationLock($code)))->assertOk();
    $total = (string) reservationRow($code)->total_amount;

    expect($this->postJson("/api/v1/reservations/{$code}/changes/{$change}/approve", [], critical(reservationLock($code))))->toBeApiError(404);
    expect($this->postJson("/api/v1/reservations/{$code}/changes/{$change}/reject", ['note' => 'Tarde'], critical(reservationLock($code))))->toBeApiError(404);
    expect((string) reservationRow($code)->total_amount)->toBe($total)
        ->and(ventasEstadoFinanciero($code)['receivables']->where('kind', 'ajuste'))->toHaveCount(1);
});

it('Ventas y Operaciones no aprueban modificaciones; la solicitud de Operaciones queda pendiente', function () {
    $code = ventasReservaConfirmada();
    actingAsSeed('U05');
    $change = ventasCambioPendiente($code, ['type' => 'upgrade', 'delta' => '80.00', 'description' => 'Mejora a habitación superior']);

    expect($this->postJson("/api/v1/reservations/{$code}/changes/{$change}/approve", [], critical(reservationLock($code))))->toBeApiError(403);
    actingAsSeed('U03');
    expect($this->postJson("/api/v1/reservations/{$code}/changes/{$change}/approve", [], critical(reservationLock($code))))->toBeApiError(403);
    expect(rowOf('booking_changes', $change, column: 'id')->status)->toBe('pendiente');
});

it('rechazar una modificación la marca rechazada sin tocar el total ni las cuotas y queda en auditoría', function () {
    $code = ventasReservaConfirmada();
    $before = ventasEstadoFinanciero($code);
    $total = (string) reservationRow($code)->total_amount;
    $change = ventasCambioPendiente($code, ['type' => 'pax', 'extra_pax' => 1, 'delta' => '150.00', 'description' => 'Se suma un amigo']);

    actingAsSeed('U02');
    $this->postJson("/api/v1/reservations/{$code}/changes/{$change}/reject", ['note' => 'La salida no admite más cupos'], critical(reservationLock($code)))->assertOk();

    $after = ventasEstadoFinanciero($code);
    $row = rowOf('booking_changes', $change, column: 'id');

    expect($row->status)->toBe('rechazada')
        ->and($row->decided_by)->toBe(seedUser('U02')->id)
        ->and((string) reservationRow($code)->total_amount)->toBe($total)
        ->and($after['receivables']->pluck('amount')->all())->toBe($before['receivables']->pluck('amount')->all())
        ->and($after['passengers'])->toHaveCount($before['passengers']->count())
        ->and(ventasAuditoriaReserva($code, 'rechazar_modificacion')?->after_value)->toBe('La salida no admite más cupos');
});

it('rechazar una modificación exige la nota y el permiso de supervisor', function () {
    $code = ventasReservaConfirmada();
    $change = ventasCambioPendiente($code, ['type' => 'upgrade', 'delta' => '80.00', 'description' => 'Mejora a habitación superior']);

    actingAsSeed('U02');
    $this->postJson("/api/v1/reservations/{$code}/changes/{$change}/reject", [], critical(reservationLock($code)))->assertStatus(422)->assertJsonValidationErrors('note');
    actingAsSeed('U05');
    expect($this->postJson("/api/v1/reservations/{$code}/changes/{$change}/reject", ['note' => 'No procede'], critical(reservationLock($code))))->toBeApiError(403);
    expect(rowOf('booking_changes', $change, column: 'id')->status)->toBe('pendiente');
});

it('rechazar la solicitud de anulación la cierra, la reserva sigue viva y el asesor puede volver a pedirla', function () {
    $request = withinTenant(tenantA(), fn () => DB::table('booking_cancel_requests')->where('reservation_id', reservationRow('RES-2026-000349')->id)->where('status', 'pendiente')->first());

    actingAsSeed('U02');
    $data = $this->postJson("/api/v1/reservations/RES-2026-000349/cancel-requests/{$request->id}/reject", ['note' => 'El cliente confirmó que viaja'])->assertOk()->json('data');

    expect($data['status'])->toBe('rechazada')
        ->and($data['decision_note'])->toBe('El cliente confirmó que viaja')
        ->and($data['decided_by'])->toBe(seedUser('U02')->id)
        ->and(reservationRow('RES-2026-000349')->status)->toBe('borrador')
        ->and($this->getJson('/api/v1/reservations/RES-2026-000349')->json('data.cancel_request'))->toBeNull()
        ->and(ventasAuditoriaReserva('RES-2026-000349', 'rechazar_anulacion')?->after_value)->toBe('El cliente confirmó que viaja');

    expect($this->postJson("/api/v1/reservations/RES-2026-000349/cancel-requests/{$request->id}/reject", ['note' => 'Otra vez']))->toBeApiError(404);

    actingAsSeed('U03');
    $this->postJson('/api/v1/reservations/RES-2026-000349/cancel-requests', ['reason' => 'Cambio de planes', 'detail' => 'Pospone el viaje a diciembre'])->assertCreated();
});

it('rechazar la solicitud de anulación exige nota y el permiso de cancelar', function () {
    $request = withinTenant(tenantA(), fn () => DB::table('booking_cancel_requests')->where('reservation_id', reservationRow('RES-2026-000349')->id)->where('status', 'pendiente')->first());

    actingAsSeed('U02');
    $this->postJson("/api/v1/reservations/RES-2026-000349/cancel-requests/{$request->id}/reject", [])->assertStatus(422)->assertJsonValidationErrors('note');
    actingAsSeed('U03');
    expect($this->postJson("/api/v1/reservations/RES-2026-000349/cancel-requests/{$request->id}/reject", ['note' => 'Lo cierro yo']))->toBeApiError(403);
    expect(rowOf('booking_cancel_requests', $request->id, column: 'id')->status)->toBe('pendiente');
});

function attachTravelDocFile(string $itemId): void
{
    withinTenant(tenantA(), fn () => DB::table('ops_travel_doc_items')->where('id', $itemId)->update(['file_id' => DB::table('sys_documents')->insertGetId(['doc_type' => 'travel_doc', 'storage_path' => 'pruebas/documento.pdf', 'file_name' => 'documento.pdf', 'mime_type' => 'application/pdf', 'sha256' => str_repeat('b', 64)])]));
}

it('validar un documento de viaje lo deja completo con quien lo validó y se ve en el checklist', function () {
    actingAsSeed('U05');
    $item = withinTenant(tenantA(), fn () => DB::table('ops_travel_doc_items')->where('reservation_id', reservationRow('RES-2026-000345')->id)->where('doc_type', 'id_doc')->orderBy('doc_number')->first());
    attachTravelDocFile($item->id);

    $this->postJson("/api/v1/reservations/RES-2026-000345/travel-docs/{$item->passenger_id}/id_doc/validate", ['doc_number' => '71022330', 'expiry_date' => '2031-01-01'], critical())
        ->assertOk()->assertJsonPath('data.id', $item->id);

    $row = rowOf('ops_travel_doc_items', $item->id, column: 'id');
    $docs = collect($this->getJson('/api/v1/reservations/RES-2026-000345/travel-docs')->assertOk()->json('data.passengers'))->firstWhere('id', $item->passenger_id)['documents'];

    expect($row->status)->toBe('completo')
        ->and($row->validated_by)->toBe(seedUser('U05')->id)
        ->and($row->expiry_date)->toBe('2031-01-01')
        ->and(collect($docs)->firstWhere('type', 'id_doc')['status'])->toBe('completo')
        ->and(withinTenant(tenantA(), fn () => DB::table('audit_events')->where('entity', 'Documento de viaje')->where('action', 'validar')->where('entity_id', 'like', 'RES-2026-000345%')->exists()))->toBeTrue();
});

it('no se valida un documento que vence antes del regreso ni uno inexistente', function () {
    actingAsSeed('U05');
    $item = withinTenant(tenantA(), fn () => DB::table('ops_travel_doc_items')->where('reservation_id', reservationRow('RES-2026-000345')->id)->where('doc_type', 'id_doc')->orderBy('doc_number')->first());
    attachTravelDocFile($item->id);

    expect($this->postJson("/api/v1/reservations/RES-2026-000345/travel-docs/{$item->passenger_id}/id_doc/validate", ['expiry_date' => '2026-10-01'], critical()))->toBeApiError(422, 'DOC-BR-002');
    expect($this->postJson("/api/v1/reservations/RES-2026-000345/travel-docs/{$item->passenger_id}/insurance/validate", [], critical()))->toBeApiError(404);
    expect(rowOf('ops_travel_doc_items', $item->id, column: 'id')->status)->toBe('pendiente');
});

it('Ventas no valida documentos de viaje', function () {
    actingAsSeed('U03');
    $item = withinTenant(tenantA(), fn () => DB::table('ops_travel_doc_items')->where('reservation_id', reservationRow('RES-2026-000349')->id)->first());

    expect($this->postJson("/api/v1/reservations/RES-2026-000349/travel-docs/{$item->passenger_id}/{$item->doc_type}/validate", [], critical()))->toBeApiError(403);
});
