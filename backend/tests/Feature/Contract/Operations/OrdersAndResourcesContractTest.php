<?php

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

beforeEach(function () {
    lockSeededBookings();
});

function opsContractAudit(array $where): bool
{
    return withinTenant(tenantA(), fn () => DB::table('audit_events')->where($where)->exists());
}

function opsContractOrder(): object
{
    return withinTenant(tenantA(), fn () => DB::table('ops_orders')->whereNull('deleted_at')->whereNotIn('status', ['completada', 'cancelada'])->orderBy('code')->first());
}

function opsContractPendingService(): object
{
    return withinTenant(tenantA(), function (): object {
        $service = DB::table('booking_reservation_services as s')->join('booking_reservations as r', 'r.id', '=', 's.reservation_id')->join('catalog_providers as p', 'p.id', '=', 's.provider_id')
            ->whereNull('r.deleted_at')->whereNotIn('r.status', ['cancelada', 'completada'])->where('p.status', 'activo')->whereNotIn('s.status', ['cancelado'])
            ->orderBy('s.code')->first(['s.id', 's.code']);
        DB::table('booking_reservation_services')->where('id', $service->id)->update(['status' => 'pendiente', 'confirmation_code' => null]);

        return DB::table('booking_reservation_services')->where('id', $service->id)->first();
    });
}

it('los KPIs de órdenes y las reservas candidatas salen de las tablas operativas', function () {
    actingAsSeed('U05');

    $kpis = $this->getJson('/api/v1/ops/orders/kpis')->assertOk()->json('data');
    $running = withinTenant(tenantA(), fn () => DB::table('ops_orders')->whereNull('deleted_at')->where('status', 'en_ejecucion')->count());
    expect($kpis)->toHaveKeys(['running', 'pending_assignment', 'services_today', 'services_tomorrow', 'open_incidents', 'critical_incidents'])
        ->and($kpis['running'])->toBe($running);

    $candidates = $this->getJson('/api/v1/ops/orders/candidates')->assertOk()->json('data');
    $withOrder = withinTenant(tenantA(), fn () => DB::table('ops_orders')->join('booking_reservations as r', 'r.id', '=', 'ops_orders.reservation_id')->whereNull('ops_orders.deleted_at')->pluck('r.code')->all());
    expect(collect($candidates)->pluck('code')->intersect($withOrder))->toBeEmpty();
});

it('candidatas exige operations.assign y devuelve los permisos requeridos', function () {
    actingAsSeed('U03');

    $response = $this->getJson('/api/v1/ops/orders/candidates');
    expect($response)->toBeApiError(403);
    expect($response->json('required_permissions'))->toContain('operations.view');
});

it('las precondiciones de cierre y el resumen de costos se leen por id o por código', function () {
    $order = opsContractOrder();
    actingAsSeed('U05');

    $checks = $this->getJson("/api/v1/ops/orders/{$order->id}/close-checks")->assertOk()->json('data');
    expect($checks['code'])->toBe($order->code)->and($checks['checks'])->toHaveCount(4)->and($checks)->toHaveKeys(['pending_tasks', 'ready']);

    $summary = $this->getJson("/api/v1/ops/orders/{$order->code}/cost-summary")->assertOk()->json('data');
    expect($summary['sees_margin'])->toBeFalse()->and($summary['services'])->not->toBeEmpty()->and($summary['services'][0])->not->toHaveKey('sale')
        ->and($summary['totals'][0])->not->toHaveKey('margin');

    actingAsSeed('U01');
    $summary = $this->getJson("/api/v1/ops/orders/{$order->code}/cost-summary")->assertOk()->json('data');
    expect($summary['sees_margin'])->toBeTrue()->and($summary['totals'][0])->toHaveKeys(['sale', 'margin', 'margin_pct']);

    $this->getJson('/api/v1/ops/orders/OP-NO-EXISTE/close-checks')->assertNotFound();
});

it('cambia el coordinador con If-Match y rechaza la versión vieja', function () {
    $order = opsContractOrder();
    $coordinator = withinTenant(tenantA(), fn () => (string) DB::table('iam_users as u')->join('model_has_roles as m', 'm.model_id', '=', 'u.id')->join('roles as r', 'r.id', '=', 'm.role_id')
        ->whereIn('r.name', ['operations', 'manager'])->where('u.status', 'activo')->where('u.id', '<>', $order->coordinator_id)->value('u.id'));
    actingAsSeed('U05');

    expect($this->patchJson("/api/v1/ops/orders/{$order->id}/coordinator", ['coordinator_id' => $coordinator]))->toBeApiError(428, 'IF_MATCH_REQUIRED');

    $this->patchJson("/api/v1/ops/orders/{$order->id}/coordinator", ['coordinator_id' => $coordinator], critical((int) $order->lock_version))
        ->assertOk()->assertJsonPath('data.coordinator.id', $coordinator);
    expect(rowOf('ops_orders', $order->code)->coordinator_id)->toBe($coordinator)
        ->and(opsContractAudit(['entity_id' => $order->code, 'action' => 'cambiar_coordinador']))->toBeTrue();

    expect($this->patchJson("/api/v1/ops/orders/{$order->id}/coordinator", ['coordinator_id' => $coordinator], critical((int) $order->lock_version)))->toBeApiError(409, 'STALE_VERSION');
});

it('lista asignaciones con filtros y crea la que le falta a un servicio de la orden', function () {
    $setup = withinTenant(tenantA(), function (): array {
        $assignment = DB::table('ops_assignments as a')->join('ops_orders as o', 'o.id', '=', 'a.order_id')->whereNull('o.deleted_at')->whereNotIn('o.status', ['completada', 'cancelada'])
            ->join('booking_reservation_services as s', 's.id', '=', 'a.reservation_service_id')->whereIn('s.service_kind', ['tour', 'traslado'])->where('s.status', '<>', 'cancelado')
            ->orderBy('o.code')->first(['a.id', 'a.order_id', 'a.reservation_service_id', 'o.code', 's.code as service_code']);
        DB::table('ops_assignments')->where('id', $assignment->id)->delete();

        return (array) $assignment;
    });
    actingAsSeed('U05');

    $page = $this->getJson('/api/v1/ops/assignments?filter[incomplete]=true&page[size]=5')->assertOk()->json();
    expect($page['meta'])->toHaveKeys(['per_page', 'next_cursor'])->and(collect($page['data'])->pluck('status')->unique()->all())->each->toBe('pendiente');
    $this->getJson('/api/v1/ops/assignments?filter[from]=today')->assertOk();
    expect($this->getJson('/api/v1/ops/assignments?filter[from]=ayer'))->toBeApiError(422);

    $created = $this->postJson("/api/v1/ops/orders/{$setup['code']}/assignments", ['reservation_service_id' => $setup['reservation_service_id']])->assertCreated()->json('data');
    expect($created['service_code'])->toBe($setup['service_code'])->and($created['status'])->toBe('pendiente')
        ->and(opsContractAudit(['entity' => 'Asignación', 'action' => 'crear']))->toBeTrue();

    expect($this->postJson("/api/v1/ops/orders/{$setup['code']}/assignments", ['reservation_service_id' => $setup['service_code']]))->toBeApiError(409, 'OPS-BR-05');
});

it('alertas de documentos, agenda y cambio de estado del recurso', function () {
    $driver = withinTenant(tenantA(), function (): object {
        $driver = DB::table('ops_drivers')->whereNull('deleted_at')->orderBy('code')->first();
        DB::table('ops_drivers')->where('id', $driver->id)->update(['license_expires_on' => now()->addDays(10)->toDateString(), 'status' => 'disponible']);

        return $driver;
    });
    actingAsSeed('U05');

    $alerts = $this->getJson('/api/v1/ops/resources/document-alerts')->assertOk()->json('data');
    expect(collect($alerts['items'])->firstWhere('id', $driver->id)['state'])->toBe('por_vencer');

    $agenda = $this->getJson("/api/v1/ops/resources/driver/{$driver->id}/agenda")->assertOk()->json('data');
    expect($agenda['id'])->toBe($driver->id)->and($agenda['items'])->toBeArray();
    $this->getJson('/api/v1/ops/resources/driver/'.Str::uuid().'/agenda')->assertNotFound();

    $this->patchJson("/api/v1/ops/resources/driver/{$driver->id}/status", ['status' => 'descanso'])->assertOk()->assertJsonPath('data.status', 'descanso');
    expect(withinTenant(tenantA(), fn () => DB::table('ops_drivers')->where('id', $driver->id)->value('status')))->toBe('descanso')
        ->and(opsContractAudit(['entity' => 'Conductor', 'action' => 'cambio_estado']))->toBeTrue();
    expect($this->patchJson("/api/v1/ops/resources/driver/{$driver->id}/status", ['status' => 'mantenimiento']))->toBeApiError(422);
});

it('solicita, confirma y rechaza el servicio con el proveedor desde Operaciones', function () {
    $service = opsContractPendingService();
    actingAsSeed('U05');

    $this->postJson("/api/v1/ops/reservation-services/{$service->id}/supplier-request", ['note' => 'Confirmar recojo'], critical())->assertOk()->assertJsonPath('data.status', 'solicitado');
    $page = $this->getJson('/api/v1/ops/supplier-requests?filter[service]='.$service->code)->assertOk()->json();
    expect($page['data'][0]['status'])->toBe('solicitado')->and($page['data'][0]['service']['code'])->toBe($service->code);

    $fresh = serviceRow($service->code);
    expect($this->postJson("/api/v1/ops/reservation-services/{$service->code}/supplier-confirmation", ['confirmation_code' => 'CONF-881'], critical((int) $fresh->lock_version - 1)))->toBeApiError(409, 'STALE_VERSION');
    $this->postJson("/api/v1/ops/reservation-services/{$service->code}/supplier-confirmation", ['confirmation_code' => 'CONF-881', 'time' => '08:30'], critical((int) $fresh->lock_version))
        ->assertOk()->assertJsonPath('data.status', 'confirmado');
    expect(serviceRow($service->code)->confirmation_code)->toBe('CONF-881');
});

it('registra el rechazo del proveedor con motivo y no acepta un servicio sin solicitar', function () {
    $service = opsContractPendingService();
    actingAsSeed('U05');

    expect($this->postJson("/api/v1/ops/reservation-services/{$service->id}/supplier-rejection", ['reason' => 'Otro', 'detail' => 'Sin unidades'], critical((int) $service->lock_version)))->toBeApiError(409, 'RES-SERVICE-NOT-REQUESTED');

    $this->postJson("/api/v1/ops/reservation-services/{$service->code}/supplier-request", [], critical())->assertOk();
    $fresh = serviceRow($service->code);
    expect($this->postJson("/api/v1/ops/reservation-services/{$service->id}/supplier-rejection", ['reason' => 'Motivo inventado', 'detail' => 'Sin unidades'], critical((int) $fresh->lock_version)))->toBeApiError(422);
    $this->postJson("/api/v1/ops/reservation-services/{$service->id}/supplier-rejection", ['reason' => 'Otro', 'detail' => 'Sin unidades'], critical((int) $fresh->lock_version))
        ->assertOk()->assertJsonPath('data.status', 'rechazado');
    expect(serviceRow($service->code)->status)->toBe('rechazado');
});
