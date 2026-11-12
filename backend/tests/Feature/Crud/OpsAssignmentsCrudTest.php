<?php

use Illuminate\Support\Facades\DB;

beforeEach(function () {
    lockSeededBookings();
});

function opsAsgAudit(array $where): bool
{
    return withinTenant(tenantA(), fn () => DB::table('audit_events')->where($where)->exists());
}

function opsAsgFind(string $order, string $date, string $time): object
{
    return withinTenant(tenantA(), fn () => DB::table('ops_assignments as a')->join('ops_orders as o', 'o.id', '=', 'a.order_id')
        ->where('o.code', $order)->where('a.service_date', $date)->where('a.service_time', $time)->first(['a.*']));
}

function opsAsgRow(string $id): object
{
    return rowOf('ops_assignments', $id, column: 'id');
}

it('asigna recursos a un servicio pendiente y la orden avanza sola a asignada', function () {
    actingAsSeed('U05');
    $assignment = opsAsgFind('OP-2026-0414', '2026-10-02', '04:30:00');
    $guide = idOf('ops_guides', 'G05');
    $driver = idOf('ops_drivers', 'C02');
    $vehicle = withinTenant(tenantA(), fn () => DB::table('ops_vehicles')->where('plate', 'X4G-310')->value('id'));

    $this->putJson("/api/v1/ops/assignments/{$assignment->id}/resources", ['guide_id' => $guide, 'driver_id' => $driver, 'vehicle_id' => $vehicle, 'ack_warnings' => true], critical((int) $assignment->lock_version))
        ->assertOk();

    $row = opsAsgRow($assignment->id);
    expect($row->status)->toBe('asignada')
        ->and($row->guide_id)->toBe($guide)
        ->and($row->driver_id)->toBe($driver)
        ->and($row->vehicle_id)->toBe($vehicle)
        ->and(rowOf('ops_orders', 'OP-2026-0414')->status)->toBe('asignada')
        ->and(opsAsgAudit(['entity' => 'Asignación', 'entity_id' => 'OP-2026-0414 · '.$assignment->service_label, 'action' => 'asignar']))->toBeTrue();

    $detail = collect($this->getJson('/api/v1/ops/orders/OP-2026-0414')->json('data.assignments'))->firstWhere('id', $assignment->id);
    expect($detail['guide']['id'])->toBe($guide)
        ->and($detail['vehicle']['id'])->toBe($vehicle);
});

it('bloquea recursos de vacaciones, sin datos o con choque de horario en otra orden', function () {
    actingAsSeed('U05');
    $assignment = opsAsgFind('OP-2026-0414', '2026-10-02', '04:30:00');
    $put = fn (array $body) => $this->putJson("/api/v1/ops/assignments/{$assignment->id}/resources", $body, critical((int) opsAsgRow($assignment->id)->lock_version));

    expect($put([]))->toBeApiError(422, 'OPS-BR-20');
    expect($put(['guide_id' => idOf('ops_guides', 'G04'), 'ack_warnings' => true]))->toBeApiError(409, 'OPS-BR-21');
    expect($put(['guide_id' => idOf('ops_guides', 'G01'), 'ack_warnings' => true]))->toBeApiError(409, 'OPS-BR-21');
    expect($put(['vehicle_id' => withinTenant(tenantA(), fn () => DB::table('ops_vehicles')->where('plate', 'X5A-102')->value('id')), 'ack_warnings' => true]))->toBeApiError(409, 'OPS-BR-21');
    $put(['guide_id' => 'no-es-uuid'])->assertStatus(422)->assertJsonValidationErrors('guide_id');

    $warned = $put(['driver_id' => idOf('ops_drivers', 'C04')]);
    expect($warned)->toBeApiError(422, 'OPS-BR-28');
    expect(opsAsgRow($assignment->id)->status)->toBe('pendiente');

    $put(['driver_id' => idOf('ops_drivers', 'C04'), 'ack_warnings' => true])->assertOk();
    $ack = json_decode((string) opsAsgRow($assignment->id)->warnings_ack, true);
    expect($ack['items'])->not->toBeEmpty();

    $this->putJson("/api/v1/ops/assignments/{$assignment->id}/resources", ['guide_id' => idOf('ops_guides', 'G05')], critical((int) opsAsgRow($assignment->id)->lock_version + 4))->assertStatus(409);
});

it('el guía recibe aviso cuando le liberan o reasignan el servicio', function () {
    actingAsSeed('U05');
    $busy = opsAsgFind('OP-2026-0413', '2026-10-02', '07:30:00');
    $guideUser = idOf('iam_users', 'U09');
    $notice = fn (string $event, string $user) => withinTenant(tenantA(), fn () => DB::table('notif_messages')->where('event_code', $event)->where('recipient_user_id', $user)->where('source_id', $busy->id)->count());

    $this->postJson("/api/v1/ops/assignments/{$busy->id}/release", [], critical((int) $busy->lock_version))->assertOk();
    expect($notice('asignacion.liberada', $guideUser))->toBe(1);

    $this->putJson("/api/v1/ops/assignments/{$busy->id}/resources", ['guide_id' => idOf('ops_guides', 'G01'), 'ack_warnings' => true], critical((int) opsAsgRow($busy->id)->lock_version))->assertOk();
    $this->putJson("/api/v1/ops/assignments/{$busy->id}/resources", ['guide_id' => idOf('ops_guides', 'G02'), 'ack_warnings' => true], critical((int) opsAsgRow($busy->id)->lock_version))->assertOk();

    expect($notice('asignacion.reasignada', $guideUser))->toBe(1)
        ->and($notice('asignacion.reasignada', idOf('iam_users', 'U10')))->toBe(0);
});

it('liberar la asignación deja al guía libre para otra orden el mismo día', function () {
    actingAsSeed('U05');
    $guide = idOf('ops_guides', 'G01');
    $busy = opsAsgFind('OP-2026-0413', '2026-10-02', '07:30:00');
    $target = opsAsgFind('OP-2026-0414', '2026-10-02', '04:30:00');
    expect($busy->guide_id)->toBe($guide);

    expect($this->putJson("/api/v1/ops/assignments/{$target->id}/resources", ['guide_id' => $guide, 'ack_warnings' => true], critical((int) $target->lock_version)))->toBeApiError(409, 'OPS-BR-21');

    $this->postJson("/api/v1/ops/assignments/{$busy->id}/release", [], critical((int) $busy->lock_version))->assertOk();
    $released = opsAsgRow($busy->id);
    expect($released->status)->toBe('pendiente')
        ->and($released->guide_id)->toBeNull()
        ->and($released->driver_id)->toBeNull()
        ->and($released->vehicle_id)->toBeNull()
        ->and(rowOf('ops_orders', 'OP-2026-0413')->status)->toBe('pendiente_asignacion')
        ->and(opsAsgAudit(['entity' => 'Asignación', 'entity_id' => 'OP-2026-0413 · '.$busy->service_label, 'action' => 'liberar']))->toBeTrue();

    $this->putJson("/api/v1/ops/assignments/{$target->id}/resources", ['guide_id' => $guide], critical((int) opsAsgRow($target->id)->lock_version))->assertOk()->assertJsonPath('data.warnings', []);
    expect(opsAsgRow($target->id)->guide_id)->toBe($guide);

    expect($this->postJson("/api/v1/ops/assignments/{$busy->id}/release", [], critical((int) opsAsgRow($busy->id)->lock_version)))->toBeApiError(409, 'OPS-BR-05');
});

it('confirma la asignación con el recurso y la orden queda confirmada cuando todas lo están', function () {
    actingAsSeed('U05');
    $assignment = opsAsgFind('OP-2026-0414', '2026-10-02', '04:30:00');

    expect($this->postJson("/api/v1/ops/assignments/{$assignment->id}/confirm", [], critical((int) $assignment->lock_version)))->toBeApiError(409, 'OPS-BR-05');

    $this->putJson("/api/v1/ops/assignments/{$assignment->id}/resources", ['guide_id' => idOf('ops_guides', 'G05'), 'ack_warnings' => true], critical((int) $assignment->lock_version))->assertOk();
    $this->postJson("/api/v1/ops/assignments/{$assignment->id}/confirm", [], critical((int) opsAsgRow($assignment->id)->lock_version))->assertOk();

    $row = opsAsgRow($assignment->id);
    expect($row->status)->toBe('confirmada')
        ->and($row->confirmed_via)->toBe('web')
        ->and($row->confirmed_at)->not->toBeNull()
        ->and(rowOf('ops_orders', 'OP-2026-0414')->status)->toBe('confirmada')
        ->and(opsAsgAudit(['entity' => 'Asignación', 'entity_id' => 'OP-2026-0414 · '.$assignment->service_label, 'action' => 'confirmar_recurso']))->toBeTrue();

    $this->postJson("/api/v1/ops/assignments/{$assignment->id}/release", [], critical((int) $row->lock_version))->assertOk();
    expect(opsAsgRow($assignment->id)->confirmed_at)->toBeNull()
        ->and(rowOf('ops_orders', 'OP-2026-0414')->status)->toBe('pendiente_asignacion');
});

it('la orden no se confirma sola mientras un proveedor no confirma su servicio', function () {
    actingAsSeed('U05');
    $guide = idOf('ops_guides', 'G05');

    foreach ([['2026-10-04', '04:30:00'], ['2026-10-05', '09:00:00']] as [$date, $time]) {
        $pending = opsAsgFind('OP-2026-0413', $date, $time);
        $this->putJson("/api/v1/ops/assignments/{$pending->id}/resources", ['guide_id' => $guide, 'ack_warnings' => true], critical((int) $pending->lock_version))->assertOk();
    }

    foreach ($this->getJson('/api/v1/ops/orders/OP-2026-0413')->json('data.assignments') as $assignment) {
        if ($assignment['status'] === 'asignada') {
            $this->postJson("/api/v1/ops/assignments/{$assignment['id']}/confirm", [], critical((int) opsAsgRow($assignment['id'])->lock_version))->assertOk();
        }
    }

    expect(collect($this->getJson('/api/v1/ops/orders/OP-2026-0413')->json('data.assignments'))->pluck('status')->unique()->all())->toBe(['confirmada'])
        ->and(serviceRow('RS-3487')->status)->toBe('solicitado')
        ->and(rowOf('ops_orders', 'OP-2026-0413')->status)->toBe('asignada');
    expect($this->postJson('/api/v1/ops/orders/OP-2026-0413/confirm', [], critical((int) rowOf('ops_orders', 'OP-2026-0413')->lock_version)))->toBeApiError(409, 'OPS-BR-05');
});

it('no toca asignaciones de órdenes cerradas ni deja asignar a quien no gestiona recursos', function () {
    actingAsSeed('U05');
    $closed = opsAsgFind('OP-2026-0411', '2026-09-26', '04:10:00');
    expect($this->postJson("/api/v1/ops/assignments/{$closed->id}/release", [], critical((int) $closed->lock_version)))->toBeApiError(409, 'OPS-BR-05');
    expect($this->postJson("/api/v1/ops/assignments/{$closed->id}/confirm", [], critical((int) $closed->lock_version)))->toBeApiError(409, 'OPS-BR-05');
    $this->postJson('/api/v1/ops/assignments/no-existe/confirm', [], critical(0))->assertNotFound();

    $assignment = opsAsgFind('OP-2026-0414', '2026-10-02', '04:30:00');
    actingAsSeed('U09');
    expect($this->putJson("/api/v1/ops/assignments/{$assignment->id}/resources", ['guide_id' => idOf('ops_guides', 'G05')], critical((int) $assignment->lock_version)))->toBeApiError(403);
    expect($this->postJson("/api/v1/ops/assignments/{$assignment->id}/confirm", [], critical((int) $assignment->lock_version)))->toBeApiError(403);
    expect($this->postJson("/api/v1/ops/assignments/{$assignment->id}/release", [], critical((int) $assignment->lock_version)))->toBeApiError(403);

    actingAsTenantBAdmin();
    $this->putJson("/api/v1/ops/assignments/{$assignment->id}/resources", ['guide_id' => idOf('ops_guides', 'G05')], critical((int) $assignment->lock_version))->assertNotFound();
    expect(opsAsgRow($assignment->id)->status)->toBe('pendiente');
});

it('una salida programada del mismo guía a menos de 6 horas bloquea la asignación (OPS-BR-21)', function () {
    actingAsSeed('U05');
    $assignment = opsAsgFind('OP-2026-0414', '2026-10-02', '04:30:00');
    $guide = idOf('ops_guides', 'G05');
    $departure = withinTenant(tenantA(), fn () => DB::table('catalog_product_departures')->where('status', '<>', 'cancelada')->orderBy('departure_date')->first(['id']));
    withinTenant(tenantA(), fn () => DB::table('catalog_product_departures')->where('id', $departure->id)->update(['departure_date' => '2026-10-02', 'departure_time' => '07:00', 'guide_id' => $guide]));

    $response = $this->putJson("/api/v1/ops/assignments/{$assignment->id}/resources", ['guide_id' => $guide, 'ack_warnings' => true], critical((int) $assignment->lock_version));

    expect($response)->toBeApiError(409, 'OPS-BR-21')
        ->and(json_encode($response->json(), JSON_UNESCAPED_UNICODE))->toContain('salida programada');
});
