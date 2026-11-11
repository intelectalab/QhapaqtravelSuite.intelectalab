<?php

use Illuminate\Support\Facades\DB;

beforeEach(function () {
    lockSeededBookings();
});

function opsRoomAudit(array $where): bool
{
    return withinTenant(tenantA(), fn () => DB::table('audit_events')->where($where)->exists());
}

function opsRoomHotel(string $ref): string
{
    return (string) rowOf('catalog_providers', $ref, column: 'ref')->id;
}

function opsRoomPassengers(string $reservation): array
{
    return withinTenant(tenantA(), fn () => DB::table('booking_passengers')->where('reservation_id', reservationRow($reservation)->id)->orderBy('seq')->pluck('id')->all());
}

function opsRoomList(string $id): object
{
    return rowOf('ops_rooming_lists', $id, column: 'id');
}

function opsRoomLock(string $id): int
{
    return (int) opsRoomList($id)->lock_version;
}

function opsRoomCreate(): string
{
    return test()->postJson('/api/v1/ops/rooming-lists', ['reservation_code' => 'RES-2026-000350', 'hotel_id' => opsRoomHotel('PRV-002'), 'check_in' => '2026-10-16', 'check_out' => '2026-10-19'])->assertCreated()->json('data.id');
}

function opsRoomRooms(string $list): array
{
    return withinTenant(tenantA(), fn () => DB::table('ops_rooming_rooms')->where('rooming_list_id', $list)->orderBy('room_number')->get()->all());
}

it('crea una rooming list en borrador para la reserva y el hotel', function () {
    actingAsSeed('U05');
    $id = opsRoomCreate();

    $row = opsRoomList($id);
    expect($row->status)->toBe('borrador')
        ->and($row->hotel_provider_id)->toBe(opsRoomHotel('PRV-002'))
        ->and($row->check_in)->toBe('2026-10-16')
        ->and(opsRoomAudit(['entity' => 'Rooming list', 'entity_id' => 'RES-2026-000350', 'action' => 'crear']))->toBeTrue()
        ->and(collect($this->getJson('/api/v1/ops/rooming-lists')->json('data.items'))->firstWhere('id', $id)['nights'])->toBe(3);

    expect($this->postJson('/api/v1/ops/rooming-lists', ['reservation_code' => 'RES-2026-000350', 'hotel_id' => opsRoomHotel('PRV-002'), 'check_in' => '2026-10-16', 'check_out' => '2026-10-19']))->toBeApiError(409, 'OPS-BR-36');
});

it('valida la reserva, el hotel y las fechas de la rooming list', function () {
    actingAsSeed('U05');

    expect($this->postJson('/api/v1/ops/rooming-lists', ['reservation_code' => 'RES-2026-000350', 'hotel_id' => opsRoomHotel('PRV-013'), 'check_in' => '2026-10-16', 'check_out' => '2026-10-19']))->toBeApiError(422, 'OPS-BR-36');
    expect($this->postJson('/api/v1/ops/rooming-lists', ['reservation_code' => 'RES-2026-000343', 'hotel_id' => opsRoomHotel('PRV-002'), 'check_in' => '2026-10-16', 'check_out' => '2026-10-19']))->toBeApiError(422, 'OPS-BR-36');
    $this->postJson('/api/v1/ops/rooming-lists', ['reservation_code' => 'RES-2026-000350', 'hotel_id' => opsRoomHotel('PRV-002'), 'check_in' => '2026-10-19', 'check_out' => '2026-10-16'])->assertStatus(422)->assertJsonValidationErrors('check_out');
    $this->postJson('/api/v1/ops/rooming-lists', ['reservation_code' => 'RES-2026-000350', 'check_in' => '2026-10-16', 'check_out' => '2026-10-19'])->assertStatus(422)->assertJsonValidationErrors('hotel_id');
});

it('agrega y edita habitaciones respetando la capacidad y sin repetir pasajeros', function () {
    actingAsSeed('U05');
    $list = opsRoomCreate();
    [$jose, $rosa, $sebastian, $valentina] = opsRoomPassengers('RES-2026-000350');

    $this->postJson("/api/v1/ops/rooming-lists/{$list}/rooms", ['room_number' => '301', 'room_type' => 'Doble', 'status' => 'pendiente', 'passenger_ids' => [$jose, $rosa, $valentina]], critical(opsRoomLock($list)))->assertCreated();
    expect($this->postJson("/api/v1/ops/rooming-lists/{$list}/rooms", ['room_number' => '302', 'room_type' => 'Simple', 'status' => 'pendiente', 'passenger_ids' => [$sebastian, $rosa]], critical(opsRoomLock($list))))->toBeApiError(422, 'OPS-BR-32');
    expect($this->postJson("/api/v1/ops/rooming-lists/{$list}/rooms", ['room_number' => '302', 'room_type' => 'Doble', 'status' => 'pendiente', 'passenger_ids' => [$sebastian, $rosa]], critical(opsRoomLock($list))))->toBeApiError(409, 'OPS-BR-30');
    expect($this->postJson("/api/v1/ops/rooming-lists/{$list}/rooms", ['room_number' => '301', 'room_type' => 'Simple', 'status' => 'pendiente', 'passenger_ids' => [$sebastian]], critical(opsRoomLock($list))))->toBeApiError(409, 'OPS-BR-31');
    expect($this->postJson("/api/v1/ops/rooming-lists/{$list}/rooms", ['room_number' => '303', 'room_type' => 'Simple', 'status' => 'pendiente', 'passenger_ids' => [opsRoomPassengers('RES-2026-000345')[0]]], critical(opsRoomLock($list))))->toBeApiError(422, 'VALIDATION_ERROR');
    $this->postJson("/api/v1/ops/rooming-lists/{$list}/rooms", ['room_number' => '303', 'room_type' => 'Suite', 'status' => 'pendiente'], critical(opsRoomLock($list)))->assertStatus(422)->assertJsonValidationErrors('room_type');

    $room = opsRoomRooms($list)[0];
    expect($room->room_number)->toBe('301')
        ->and((int) $room->capacity)->toBe(2)
        ->and(withinTenant(tenantA(), fn () => DB::table('ops_rooming_guests')->where('room_id', $room->id)->count()))->toBe(3);

    $this->putJson("/api/v1/ops/rooming-lists/{$list}/rooms/{$room->id}", ['room_number' => '305', 'room_type' => 'Triple', 'status' => 'confirmada', 'passenger_ids' => [$jose, $rosa, $sebastian]])->assertOk();
    $updated = opsRoomRooms($list)[0];
    expect($updated->room_number)->toBe('305')
        ->and((int) $updated->capacity)->toBe(3)
        ->and(withinTenant(tenantA(), fn () => DB::table('ops_rooming_guests')->where('room_id', $room->id)->pluck('passenger_id')->sort()->values()->all()))->toBe(collect([$jose, $rosa, $sebastian])->sort()->values()->all())
        ->and(opsRoomAudit(['entity' => 'Rooming list', 'entity_id' => 'RES-2026-000350', 'action' => 'editar_habitacion']))->toBeTrue();

    $this->putJson("/api/v1/ops/rooming-lists/{$list}/rooms/01a1b4f8-0000-7000-8000-000000000000", ['room_number' => '306', 'room_type' => 'Simple', 'status' => 'pendiente'])->assertNotFound();
});

it('no deja a un pasajero en dos hoteles con fechas superpuestas', function () {
    actingAsSeed('U05');
    $list = $this->postJson('/api/v1/ops/rooming-lists', ['reservation_code' => 'RES-2026-000348', 'hotel_id' => opsRoomHotel('PRV-002'), 'check_in' => '2026-10-02', 'check_out' => '2026-10-04'])->assertCreated()->json('data.id');
    $lodged = withinTenant(tenantA(), fn () => DB::table('ops_rooming_guests as g')->join('ops_rooming_lists as l', 'l.id', '=', 'g.rooming_list_id')->where('l.reservation_id', reservationRow('RES-2026-000348')->id)->where('l.id', '<>', $list)->value('g.passenger_id'));
    expect($lodged)->not->toBeNull();

    expect($this->postJson("/api/v1/ops/rooming-lists/{$list}/rooms", ['room_number' => '101', 'room_type' => 'Simple', 'status' => 'pendiente', 'passenger_ids' => [$lodged]], critical(opsRoomLock($list))))->toBeApiError(409, 'OPS-BR-31');
    expect(opsRoomRooms($list))->toBeEmpty();
});

it('confirma, envía al hotel y pasa a modificada cuando se cambia después del envío', function () {
    actingAsSeed('U05');
    $list = opsRoomCreate();
    [$jose, $rosa, $sebastian] = opsRoomPassengers('RES-2026-000350');

    expect($this->postJson("/api/v1/ops/rooming-lists/{$list}/confirm", [], critical(opsRoomLock($list))))->toBeApiError(409, 'OPS-BR-34');
    $this->postJson("/api/v1/ops/rooming-lists/{$list}/rooms", ['room_number' => '201', 'room_type' => 'Doble', 'status' => 'pendiente', 'passenger_ids' => [$jose, $rosa]], critical(opsRoomLock($list)))->assertCreated();
    expect($this->postJson("/api/v1/ops/rooming-lists/{$list}/send", [], critical(opsRoomLock($list))))->toBeApiError(409, 'OPS-BR-34');

    $this->postJson("/api/v1/ops/rooming-lists/{$list}/confirm", [], critical(opsRoomLock($list)))->assertOk();
    expect(opsRoomList($list)->status)->toBe('confirmada');

    $this->postJson("/api/v1/ops/rooming-lists/{$list}/send", [], critical(opsRoomLock($list)))->assertOk();
    $sent = opsRoomList($list);
    expect($sent->status)->toBe('enviada')
        ->and((int) $sent->sent_version)->toBe(1)
        ->and($sent->sent_at)->not->toBeNull()
        ->and(opsRoomAudit(['entity' => 'Rooming list', 'entity_id' => 'RES-2026-000350', 'action' => 'enviar_hotel', 'after_value' => 'enviada v1']))->toBeTrue();

    expect($this->deleteJson("/api/v1/ops/rooming-lists/{$list}"))->toBeApiError(409, 'OPS-BR-34');

    $this->postJson("/api/v1/ops/rooming-lists/{$list}/rooms", ['room_number' => '202', 'room_type' => 'Simple', 'status' => 'pendiente', 'passenger_ids' => [$sebastian]], critical(opsRoomLock($list)))->assertCreated();
    expect(opsRoomList($list)->status)->toBe('modificada');
    expect($this->postJson("/api/v1/ops/rooming-lists/{$list}/send", [], critical(opsRoomLock($list))))->toBeApiError(409, 'OPS-BR-34');

    $this->postJson("/api/v1/ops/rooming-lists/{$list}/confirm", [], critical(opsRoomLock($list)))->assertOk();
    $this->postJson("/api/v1/ops/rooming-lists/{$list}/send", [], critical(opsRoomLock($list)))->assertOk();
    expect((int) opsRoomList($list)->sent_version)->toBe(2);

    $this->postJson("/api/v1/ops/rooming-lists/{$list}/send", [], critical(opsRoomLock($list) + 3))->assertStatus(409);
});

it('quita habitaciones y elimina la lista en borrador sin perder el historial', function () {
    actingAsSeed('U05');
    $list = opsRoomCreate();
    [$jose, $rosa] = opsRoomPassengers('RES-2026-000350');
    $this->postJson("/api/v1/ops/rooming-lists/{$list}/rooms", ['room_number' => '401', 'room_type' => 'Doble', 'status' => 'pendiente', 'passenger_ids' => [$jose, $rosa]], critical(opsRoomLock($list)))->assertCreated();
    $this->postJson("/api/v1/ops/rooming-lists/{$list}/rooms", ['room_number' => '402', 'room_type' => 'Simple', 'status' => 'pendiente'], critical(opsRoomLock($list)))->assertCreated();
    [$first] = opsRoomRooms($list);

    $this->postJson("/api/v1/ops/rooming-lists/{$list}/confirm", [], critical(opsRoomLock($list)))->assertOk();
    $this->deleteJson("/api/v1/ops/rooming-lists/{$list}/rooms/{$first->id}")->assertOk();
    expect(collect(opsRoomRooms($list))->pluck('room_number')->all())->toBe(['402'])
        ->and(withinTenant(tenantA(), fn () => DB::table('ops_rooming_guests')->where('room_id', $first->id)->exists()))->toBeFalse()
        ->and(opsRoomList($list)->status)->toBe('modificada')
        ->and(opsRoomAudit(['entity' => 'Rooming list', 'entity_id' => 'RES-2026-000350', 'action' => 'eliminar_habitacion', 'before_value' => '401']))->toBeTrue();
    $this->deleteJson("/api/v1/ops/rooming-lists/{$list}/rooms/{$first->id}")->assertNotFound();

    $this->deleteJson("/api/v1/ops/rooming-lists/{$list}")->assertOk();
    expect(opsRoomList($list)->deleted_at)->not->toBeNull()
        ->and(collect($this->getJson('/api/v1/ops/rooming-lists')->json('data.items'))->pluck('id'))->not->toContain($list)
        ->and(opsRoomAudit(['entity' => 'Rooming list', 'entity_id' => 'RES-2026-000350', 'action' => 'eliminar']))->toBeTrue();
    $this->deleteJson("/api/v1/ops/rooming-lists/{$list}")->assertNotFound();

    $again = opsRoomCreate();
    expect(opsRoomList($again)->status)->toBe('borrador')
        ->and(opsRoomList($again)->deleted_at)->toBeNull()
        ->and(opsRoomRooms($again))->toBeEmpty()
        ->and(collect($this->getJson('/api/v1/ops/rooming-lists')->json('data.items'))->pluck('id'))->toContain($again);
});

it('solo quien modifica reservas gestiona rooming lists y otra agencia no las ve', function () {
    actingAsSeed('U05');
    $list = opsRoomCreate();

    foreach (['U03', 'U07'] as $user) {
        actingAsSeed($user);
        expect($this->postJson('/api/v1/ops/rooming-lists', ['reservation_code' => 'RES-2026-000345', 'hotel_id' => opsRoomHotel('PRV-002'), 'check_in' => '2026-10-01', 'check_out' => '2026-10-03']))->toBeApiError(403);
        expect($this->deleteJson("/api/v1/ops/rooming-lists/{$list}"))->toBeApiError(403);
    }

    actingAsTenantBAdmin();
    $this->deleteJson("/api/v1/ops/rooming-lists/{$list}")->assertNotFound();
    $this->postJson("/api/v1/ops/rooming-lists/{$list}/confirm", [], critical(opsRoomLock($list)))->assertNotFound();
    expect(opsRoomList($list)->deleted_at)->toBeNull();
});
