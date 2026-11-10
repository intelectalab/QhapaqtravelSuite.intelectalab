<?php

use Illuminate\Support\Facades\DB;

function opsCrudOrderLock(string $code): int
{
    return (int) rowOf('ops_orders', $code)->lock_version;
}

function opsCrudAudit(array $where): bool
{
    return withinTenant(tenantA(), fn () => DB::table('audit_events')->where($where)->exists());
}

function opsCrudOrderAssignments(string $code): array
{
    return withinTenant(tenantA(), fn () => DB::table('ops_assignments as a')->join('ops_orders as o', 'o.id', '=', 'a.order_id')->where('o.code', $code)->orderBy('a.service_date')->orderBy('a.service_time')->get(['a.id', 'a.status', 'a.guide_id', 'a.driver_id', 'a.vehicle_id', 'a.lock_version'])->all());
}

it('crea la orden operativa de una reserva con sus tareas y asignaciones', function () {
    actingAsSeed('U05');
    $coordinator = seedUser('U06')->getKey();

    $code = $this->postJson('/api/v1/ops/orders', ['reservation_code' => 'RES-2026-000344', 'coordinator_id' => $coordinator], critical())->assertCreated()->json('data.code');
    $order = rowOf('ops_orders', $code);

    expect($order->status)->toBe('pendiente_asignacion')
        ->and($order->coordinator_id)->toBe($coordinator)
        ->and($order->reservation_id)->toBe(reservationRow('RES-2026-000344')->id)
        ->and(withinTenant(tenantA(), fn () => DB::table('ops_order_tasks')->where('order_id', $order->id)->count()))->toBe(5)
        ->and(opsCrudOrderAssignments($code))->toHaveCount(1)
        ->and(opsCrudAudit(['entity' => 'Orden operativa', 'entity_id' => $code, 'action' => 'crear']))->toBeTrue();

    $detail = $this->getJson("/api/v1/ops/orders/{$code}")->assertOk()->json('data');
    expect($detail['reservation']['code'])->toBe('RES-2026-000344')
        ->and($detail['coordinator']['id'])->toBe($coordinator)
        ->and($detail['tasks'])->toHaveCount(5);
});

it('no crea una segunda orden para la misma reserva ni una orden de una reserva en borrador', function () {
    actingAsSeed('U05');
    $coordinator = seedUser('U05')->getKey();

    expect($this->postJson('/api/v1/ops/orders', ['reservation_code' => 'RES-2026-000348', 'coordinator_id' => $coordinator], critical()))->toBeApiError(409, 'OPS-BR-02');
    expect($this->postJson('/api/v1/ops/orders', ['reservation_code' => 'RES-2026-000349', 'coordinator_id' => $coordinator], critical()))->toBeApiError(422, 'OPS-BR-01');
    expect($this->postJson('/api/v1/ops/orders', ['reservation_code' => 'RES-2026-000344', 'coordinator_id' => seedUser('U03')->getKey()], critical()))->toBeApiError(422, 'OPS-BR-04');
    $this->postJson('/api/v1/ops/orders', ['coordinator_id' => $coordinator], critical())->assertStatus(422)->assertJsonValidationErrors('reservation_code');

    expect(withinTenant(tenantA(), fn () => DB::table('ops_orders')->where('reservation_id', reservationRow('RES-2026-000344')->id)->exists()))->toBeFalse();
});

it('solo quien asigna recursos crea o edita órdenes operativas', function (string $user) {
    actingAsSeed($user);

    expect($this->postJson('/api/v1/ops/orders', ['reservation_code' => 'RES-2026-000344', 'coordinator_id' => seedUser('U05')->getKey()], critical()))->toBeApiError(403);
    expect($this->patchJson('/api/v1/ops/orders/OP-2026-0415', ['coordinator_id' => seedUser('U05')->getKey()]))->toBeApiError(403);
    expect($this->postJson('/api/v1/ops/orders/OP-2026-0415/cancel', ['reason' => 'Cliente desistió del viaje.']))->toBeApiError(403);
    expect(rowOf('ops_orders', 'OP-2026-0415')->status)->toBe('pendiente_asignacion');
})->with(['U09', 'U03', 'U07']);

it('cambia el coordinador de la orden y lo registra en la auditoría', function () {
    actingAsSeed('U01');
    $before = rowOf('ops_orders', 'OP-2026-0415')->coordinator_id;
    $next = seedUser($before === seedUser('U06')->getKey() ? 'U05' : 'U06')->getKey();

    $this->patchJson('/api/v1/ops/orders/OP-2026-0415', ['coordinator_id' => $next])->assertOk();

    expect(rowOf('ops_orders', 'OP-2026-0415')->coordinator_id)->toBe($next)
        ->and($this->getJson('/api/v1/ops/orders/OP-2026-0415')->json('data.coordinator.id'))->toBe($next)
        ->and(opsCrudAudit(['entity' => 'Orden operativa', 'entity_id' => 'OP-2026-0415', 'action' => 'cambiar_coordinador', 'after_value' => $next]))->toBeTrue();

    expect($this->patchJson('/api/v1/ops/orders/OP-2026-0415', ['coordinator_id' => seedUser('U03')->getKey()]))->toBeApiError(422, 'OPS-BR-04');
    $this->patchJson('/api/v1/ops/orders/OP-2026-0415', ['coordinator_id' => 'no-es-uuid'])->assertStatus(422)->assertJsonValidationErrors('coordinator_id');
    expect($this->patchJson('/api/v1/ops/orders/OP-2026-0411', ['coordinator_id' => $next]))->toBeApiError(409, 'OPS-BR-05');
});

it('marca la orden como asignada solo cuando no quedan servicios sin recursos', function () {
    actingAsSeed('U05');

    expect($this->postJson('/api/v1/ops/orders/OP-2026-0414/mark-assigned', [], critical(opsCrudOrderLock('OP-2026-0414'))))->toBeApiError(409, 'OPS-BR-05');
    expect(rowOf('ops_orders', 'OP-2026-0414')->status)->toBe('pendiente_asignacion');

    [$assignment] = opsCrudOrderAssignments('OP-2026-0414');
    withinTenant(tenantA(), fn () => DB::table('ops_assignments')->where('id', $assignment->id)->update(['status' => 'asignada', 'guide_id' => idOf('ops_guides', 'G05')]));

    $this->postJson('/api/v1/ops/orders/OP-2026-0414/mark-assigned', [], critical(opsCrudOrderLock('OP-2026-0414')))->assertOk()->assertJsonPath('data.status', 'asignada');
    expect(rowOf('ops_orders', 'OP-2026-0414')->status)->toBe('asignada')
        ->and(opsCrudAudit(['entity' => 'Orden operativa', 'entity_id' => 'OP-2026-0414', 'action' => 'cambio_estado', 'after_value' => 'asignada']))->toBeTrue();

    expect($this->postJson('/api/v1/ops/orders/OP-2026-0414/mark-assigned', [], critical(opsCrudOrderLock('OP-2026-0414'))))->toBeApiError(409, 'OPS-BR-05');
    $this->postJson('/api/v1/ops/orders/OP-2026-0414/mark-assigned', [], critical(opsCrudOrderLock('OP-2026-0414') + 3))->assertStatus(409);
});

it('cancela la orden, libera sus recursos y deja al guía libre para otra orden', function () {
    actingAsSeed('U05');
    $guide = idOf('ops_guides', 'G05');
    $first = opsCrudOrderAssignments('OP-2026-0415')[1];
    $this->putJson("/api/v1/ops/assignments/{$first->id}/resources", ['guide_id' => $guide, 'ack_warnings' => true], critical((int) $first->lock_version))->assertOk();

    expect($this->postJson('/api/v1/ops/orders/OP-2026-0415/cancel', ['reason' => 'No']))->toBeApiError(422);
    $this->postJson('/api/v1/ops/orders/OP-2026-0415/cancel', ['reason' => 'El cliente canceló el viaje.'])->assertOk();

    $order = rowOf('ops_orders', 'OP-2026-0415');
    expect($order->status)->toBe('cancelada')
        ->and($order->cancel_reason)->toBe('El cliente canceló el viaje.')
        ->and(collect(opsCrudOrderAssignments('OP-2026-0415'))->every(fn (object $row) => $row->status === 'pendiente' && $row->guide_id === null))->toBeTrue()
        ->and(opsCrudAudit(['entity' => 'Orden operativa', 'entity_id' => 'OP-2026-0415', 'action' => 'cancelar']))->toBeTrue();

    expect(withinTenant(tenantA(), fn () => DB::table('ops_assignments')->where('guide_id', $guide)->where('service_date', '2026-10-10')->exists()))->toBeFalse();
    expect($this->postJson('/api/v1/ops/orders/OP-2026-0415/cancel', ['reason' => 'Segundo intento de cancelación.']))->toBeApiError(409, 'OPS-BR-05');
    expect($this->postJson('/api/v1/ops/orders/OP-2026-0412/cancel', ['reason' => 'La operación ya empezó.']))->toBeApiError(409, 'OPS-BR-05');
    expect(rowOf('ops_orders', 'OP-2026-0412')->status)->toBe('en_ejecucion');
});

it('agrega, completa, reabre y elimina tareas de la orden', function () {
    $actor = actingAsSeed('U05');

    $this->postJson('/api/v1/ops/orders/OP-2026-0413/tasks', ['title' => 'Reconfirmar tren con PeruRail'])->assertCreated();
    $task = collect($this->getJson('/api/v1/ops/orders/OP-2026-0413')->json('data.tasks'))->firstWhere('title', 'Reconfirmar tren con PeruRail');
    expect($task)->not->toBeNull()
        ->and($task['done'])->toBeFalse()
        ->and(opsCrudAudit(['entity' => 'Orden operativa', 'entity_id' => 'OP-2026-0413', 'action' => 'agregar_tarea']))->toBeTrue();

    $this->patchJson("/api/v1/ops/order-tasks/{$task['id']}", ['done' => true])->assertOk();
    $row = rowOf('ops_order_tasks', $task['id'], column: 'id');
    expect((bool) $row->done)->toBeTrue()
        ->and($row->done_by)->toBe($actor->getKey())
        ->and(collect($this->getJson('/api/v1/ops/orders/OP-2026-0413')->json('data.tasks'))->firstWhere('id', $task['id'])['done'])->toBeTrue();

    $this->patchJson("/api/v1/ops/order-tasks/{$task['id']}", ['done' => false])->assertOk();
    expect(rowOf('ops_order_tasks', $task['id'], column: 'id')->done_by)->toBeNull()
        ->and(opsCrudAudit(['entity' => 'Orden operativa', 'entity_id' => 'OP-2026-0413', 'action' => 'reabrir_tarea']))->toBeTrue();
    $this->patchJson("/api/v1/ops/order-tasks/{$task['id']}", ['done' => 'quizas'])->assertStatus(422)->assertJsonValidationErrors('done');

    $this->deleteJson("/api/v1/ops/order-tasks/{$task['id']}")->assertOk();
    expect(rowOf('ops_order_tasks', $task['id'], column: 'id')->deleted_at)->not->toBeNull()
        ->and(collect($this->getJson('/api/v1/ops/orders/OP-2026-0413')->json('data.tasks'))->pluck('id'))->not->toContain($task['id'])
        ->and(opsCrudAudit(['entity' => 'Orden operativa', 'entity_id' => 'OP-2026-0413', 'action' => 'eliminar_tarea']))->toBeTrue();
    $this->deleteJson("/api/v1/ops/order-tasks/{$task['id']}")->assertNotFound();
    $this->patchJson('/api/v1/ops/order-tasks/no-existe', ['done' => true])->assertNotFound();
});

it('valida las tareas y no las cambia en una orden cerrada', function () {
    actingAsSeed('U05');
    $this->postJson('/api/v1/ops/orders/OP-2026-0413/tasks', ['title' => 'x'])->assertStatus(422)->assertJsonValidationErrors('title');
    expect($this->postJson('/api/v1/ops/orders/OP-2026-0411/tasks', ['title' => 'Tarea tardía']))->toBeApiError(409, 'OPS-BR-05');

    $closed = withinTenant(tenantA(), fn () => DB::table('ops_order_tasks as t')->join('ops_orders as o', 'o.id', '=', 't.order_id')->where('o.code', 'OP-2026-0411')->whereNull('t.deleted_at')->value('t.id'));
    expect($this->patchJson("/api/v1/ops/order-tasks/{$closed}", ['done' => true]))->toBeApiError(409, 'OPS-BR-05');
    expect($this->deleteJson("/api/v1/ops/order-tasks/{$closed}"))->toBeApiError(409, 'OPS-BR-05');
    expect(rowOf('ops_order_tasks', $closed, column: 'id')->deleted_at)->toBeNull();

    actingAsSeed('U09');
    expect($this->postJson('/api/v1/ops/orders/OP-2026-0413/tasks', ['title' => 'Tarea del guía']))->toBeApiError(403);
});
