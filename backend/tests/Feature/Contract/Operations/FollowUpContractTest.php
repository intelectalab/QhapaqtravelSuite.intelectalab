<?php

use Illuminate\Support\Facades\DB;

beforeEach(function () {
    lockSeededBookings();
});

function followUpAudit(array $where): bool
{
    return withinTenant(tenantA(), fn () => DB::table('audit_events')->where($where)->exists());
}

function followUpList(): object
{
    return withinTenant(tenantA(), fn () => DB::table('ops_rooming_lists as l')->whereNull('l.deleted_at')->whereExists(fn ($query) => $query->from('ops_rooming_rooms as r')->whereColumn('r.rooming_list_id', 'l.id'))->orderBy('l.check_in')->first(['l.*']));
}

function followUpVoucher(): object
{
    return withinTenant(tenantA(), function (): object {
        $voucher = DB::table('ops_vouchers as v')->join('booking_reservations as r', 'r.id', '=', 'v.reservation_id')->whereNotIn('r.status', ['cancelada', 'borrador'])->orderBy('v.code')->first(['v.id', 'v.reservation_service_id']);
        DB::table('ops_vouchers')->where('id', $voucher->id)->update(['status' => 'emitido', 'used_at' => null, 'void_at' => null, 'void_reason' => null]);
        DB::table('booking_reservation_services')->where('id', $voucher->reservation_service_id)->update(['status' => 'confirmado']);

        return DB::table('ops_vouchers')->where('id', $voucher->id)->first();
    });
}

function followUpIncident(): object
{
    return withinTenant(tenantA(), function (): object {
        $incident = DB::table('ops_incidents')->orderBy('code')->first();
        DB::table('ops_incidents')->where('id', $incident->id)->update(['status' => 'abierta', 'severity' => 'media', 'type' => 'Proveedor', 'closed_at' => null, 'resolved_at' => null]);

        return DB::table('ops_incidents')->where('id', $incident->id)->first();
    });
}

it('el detalle de la rooming list trae habitaciones, pasajeros y validación, y su documento de vista previa', function () {
    $list = followUpList();
    actingAsSeed('U05');

    $item = $this->getJson("/api/v1/ops/rooming-lists/{$list->id}")->assertOk()->json('data');
    expect($item['id'])->toBe($list->id)->and($item['rooms'])->not->toBeEmpty()->and($item)->toHaveKeys(['passengers', 'warnings', 'room_types']);

    $document = $this->getJson("/api/v1/ops/rooming-lists/{$list->id}/document")->assertOk()->json('data');
    expect($document['totals']['rooms'])->toBe(count($item['rooms']))->and($document['title'])->toContain($item['reservation']['code']);

    $this->getJson('/api/v1/ops/rooming-lists/no-existe')->assertNotFound();
});

it('valida una distribución propuesta sin guardar nada', function () {
    $list = followUpList();
    actingAsSeed('U05');
    $item = $this->getJson("/api/v1/ops/rooming-lists/{$list->id}")->json('data');
    $first = $item['passengers'][0]['id'];
    $before = withinTenant(tenantA(), fn () => DB::table('ops_rooming_rooms')->where('rooming_list_id', $list->id)->count());

    $result = $this->postJson("/api/v1/ops/rooming-lists/{$list->id}/validate", ['rooms' => [
        ['room_number' => '901', 'room_type' => 'Simple', 'passenger_ids' => [$first]],
        ['room_number' => '902', 'room_type' => 'Simple', 'passenger_ids' => [$first]],
    ]])->assertOk()->json('data');

    expect($result['valid'])->toBeFalse()->and($result['blocks'])->not->toBeEmpty()
        ->and(withinTenant(tenantA(), fn () => DB::table('ops_rooming_rooms')->where('rooming_list_id', $list->id)->count()))->toBe($before);

    $ok = $this->postJson("/api/v1/ops/rooming-lists/{$list->id}/validate", ['rooms' => [['room_number' => '901', 'room_type' => 'Simple', 'passenger_ids' => [$first]]]])->assertOk()->json('data');
    expect($ok['valid'])->toBeTrue();
});

it('edita y elimina una habitación con la versión de la lista', function () {
    $list = followUpList();
    actingAsSeed('U05');
    $item = $this->getJson("/api/v1/ops/rooming-lists/{$list->id}")->json('data');
    $room = $item['rooms'][0];
    $payload = ['room_number' => $room['number'], 'room_type' => $room['type'], 'status' => 'confirmada', 'passenger_ids' => collect($room['guests'])->pluck('id')->all()];

    expect($this->putJson("/api/v1/ops/rooming-rooms/{$room['id']}", $payload))->toBeApiError(428, 'IF_MATCH_REQUIRED');
    expect($this->putJson("/api/v1/ops/rooming-rooms/{$room['id']}", $payload, critical($item['lock_version'] + 5)))->toBeApiError(409, 'STALE_VERSION');

    $saved = $this->putJson("/api/v1/ops/rooming-rooms/{$room['id']}", $payload, critical($item['lock_version']))->assertOk()->json('data');
    expect($saved['status'])->toBe('confirmada')->and(followUpAudit(['entity' => 'Rooming list', 'action' => 'editar_habitacion']))->toBeTrue();

    $version = (int) rowOf('ops_rooming_lists', $list->id, column: 'id')->lock_version;
    $this->deleteJson("/api/v1/ops/rooming-rooms/{$room['id']}", [], critical($version))->assertNoContent();
    expect(withinTenant(tenantA(), fn () => DB::table('ops_rooming_rooms')->where('id', $room['id'])->exists()))->toBeFalse()
        ->and(followUpAudit(['entity' => 'Rooming list', 'action' => 'eliminar_habitacion']))->toBeTrue();
});

it('vouchers: pendientes de emitir, verificación previa, detalle y reenvío', function () {
    $voucher = followUpVoucher();
    actingAsSeed('U05');

    $pending = $this->getJson('/api/v1/ops/vouchers/pending-issue')->assertOk()->json('data');
    expect($pending)->toBeArray();

    $check = $this->postJson('/api/v1/ops/vouchers/check', ['reservation_service_id' => $voucher->reservation_service_id])->assertOk()->json('data');
    expect($check['can_issue'])->toBeFalse()->and(collect($check['blocks'])->pluck('code'))->toContain('OPS-BR-41');

    $detail = $this->getJson("/api/v1/ops/vouchers/{$voucher->id}")->assertOk()->json('data');
    expect($detail['code'])->toBe($voucher->code)->and($detail)->toHaveKeys(['versions', 'notifications']);

    expect($this->postJson("/api/v1/ops/vouchers/{$voucher->code}/resend", []))->toBeApiError(422, 'IDEMPOTENCY_KEY_REQUIRED');
    $this->postJson("/api/v1/ops/vouchers/{$voucher->code}/resend", [], critical())->assertOk()->assertJsonPath('data.code', $voucher->code);
    expect(followUpAudit(['entity' => 'Voucher', 'entity_id' => $voucher->code, 'action' => 'reenviar']))->toBeTrue();
});

it('incidencias: asigna responsable y reclasifica con If-Match', function () {
    $incident = followUpIncident();
    $assignee = withinTenant(tenantA(), fn () => (string) DB::table('iam_users as u')->join('model_has_roles as m', 'm.model_id', '=', 'u.id')->join('roles as r', 'r.id', '=', 'm.role_id')
        ->whereIn('r.name', ['operations', 'manager'])->where('u.status', 'activo')->where('u.id', '<>', (string) $incident->assignee_id)->value('u.id'));
    actingAsSeed('U05');

    expect($this->patchJson("/api/v1/ops/incidents/{$incident->code}/assignee", ['assignee_id' => $assignee]))->toBeApiError(428, 'IF_MATCH_REQUIRED');
    $this->patchJson("/api/v1/ops/incidents/{$incident->code}/assignee", ['assignee_id' => $assignee], critical((int) $incident->lock_version))->assertOk();
    expect(rowOf('ops_incidents', $incident->code)->assignee_id)->toBe($assignee);

    $version = (int) rowOf('ops_incidents', $incident->code)->lock_version;
    $this->patchJson("/api/v1/ops/incidents/{$incident->id}/classification", ['type' => 'Transporte', 'severity' => 'alta'], critical($version))->assertOk();
    $row = rowOf('ops_incidents', $incident->code);
    expect($row->severity)->toBe('alta')->and($row->type)->toBe('Transporte')
        ->and(followUpAudit(['entity' => 'Incidencia', 'entity_id' => $incident->code, 'action' => 'editar']))->toBeTrue();

    expect($this->patchJson("/api/v1/ops/incidents/{$incident->id}/classification", ['type' => 'Transporte', 'severity' => 'alta'], critical((int) $row->lock_version)))->toBeApiError(409);
});

it('Finanzas no reenvía vouchers ni reclasifica incidencias', function () {
    $voucher = followUpVoucher();
    actingAsSeed('U07');

    $response = $this->postJson("/api/v1/ops/vouchers/{$voucher->code}/resend", [], critical());
    expect($response)->toBeApiError(403);
    expect($response->json('required_permissions'))->not->toBeEmpty();
});
