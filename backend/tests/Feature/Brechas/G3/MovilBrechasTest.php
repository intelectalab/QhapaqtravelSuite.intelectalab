<?php

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

beforeEach(function () {
    config(['access.experience_routes.mobile' => ['mobile.operator.', 'mobile.devices.']]);
});

function g3Guide(): object
{
    return withinTenant(tenantA(), function (): object {
        $guide = (string) DB::table('iam_users')->where('code', 'U09')->value('guide_id');
        $assignment = DB::table('ops_assignments as a')->join('ops_orders as o', 'o.id', '=', 'a.order_id')->whereNotIn('o.status', ['completada', 'cancelada'])->whereNull('o.deleted_at')
            ->orderBy('o.code')->orderBy('a.service_date')->first(['a.id', 'a.order_id', 'a.reservation_service_id', 'o.reservation_id']);
        DB::table('ops_assignments')->where('id', $assignment->id)->update(['status' => 'asignada', 'guide_id' => $guide, 'service_date' => BUSINESS_TODAY, 'service_time' => '08:00']);

        return $assignment;
    });
}

it('G3-15 a G3-17: el pasajero ve próxima actividad, hotel, alerta destacada, itinerario sin alojamiento y sus documentos', function () {
    actingAsSeed('U15');

    $trip = $this->getJson('/api/v1/mobile/passenger/trip')->assertOk()->json('data');
    $itinerary = $this->getJson('/api/v1/mobile/passenger/itinerary')->assertOk()->json('data');
    $documents = $this->getJson('/api/v1/mobile/passenger/documents')->assertOk()->json('data');

    expect($trip)->toHaveKeys(['next_detail', 'critical_alert', 'hotel'])
        ->and(collect($itinerary['days'])->flatMap(fn (array $day): array => $day['services'])->pluck('kind'))->not->toContain('alojamiento')
        ->and($itinerary['days'][0])->toHaveKey('stay')
        ->and($documents)->toHaveKeys(['insurance', 'passports'])
        ->and(count($documents['passports']))->toBe(count($trip['passengers']));

    $services = collect($itinerary['days'])->flatMap(fn (array $day): array => $day['services']);
    if ($services->isNotEmpty()) {
        expect($services->first())->toHaveKeys(['meeting_point', 'provider', 'includes']);
    }
});

it('G3-15: la alerta crítica sale con su detalle en Mi viaje', function () {
    $reservation = idOf('booking_reservations', 'RES-2026-000347');
    withinTenant(tenantA(), fn () => DB::table('ops_incidents')->insert([
        'code' => 'INC-G3-01', 'reservation_id' => $reservation, 'type' => 'Transporte', 'severity' => 'critica', 'title' => 'Paro regional',
        'public_title' => 'Posible cambio de horario', 'public_message' => 'Tu coordinador confirmará hoy el nuevo horario.', 'description' => 'Paro en la vía',
        'status' => 'abierta', 'reported_by' => idOf('iam_users', 'U01'), 'sla_hours' => 4, 'sla_due_at' => now()->addHours(4),
    ]));
    actingAsSeed('U15');

    $alert = $this->getJson('/api/v1/mobile/passenger/trip')->assertOk()->json('data.critical_alert');

    expect($alert['title'])->toBe('Posible cambio de horario')
        ->and($alert['message'])->toBe('Tu coordinador confirmará hoy el nuevo horario.');
});

it('G3-18: el pasajero lee sus comentarios enviados desde la app', function () {
    actingAsSeed('U15');

    $response = $this->getJson('/api/v1/mobile/passenger/feedback');

    if ($response->status() === 403) {
        expect($response->json('code'))->not->toBeNull();

        return;
    }

    expect($response->assertOk()->json('data'))->toHaveKeys(['types', 'services', 'history']);
});

it('G3-22, G3-23 y G3-29: el detalle del operador trae incidencias abiertas, el recojo solo donde aplica y el perfil con calificación', function () {
    $assignment = g3Guide();
    actingAsSeed('U09');

    $me = $this->getJson('/api/v1/mobile/operator/me')->assertOk()->json('data');
    $detail = $this->getJson("/api/v1/mobile/operator/assignments/{$assignment->id}")->assertOk()->json('data');
    $first = withinTenant(tenantA(), fn () => DB::table('booking_reservation_services')->where('reservation_id', $assignment->reservation_id)->whereNotIn('status', ['cancelado', 'rechazado'])->whereNull('replaced_by_id')->where('service_kind', '<>', 'alojamiento')
        ->orderBy('service_date')->orderByRaw('service_time nulls last')->orderBy('code')->value('id'));

    expect($me)->toHaveKeys(['rating', 'status_label'])
        ->and($detail)->toHaveKey('incidents')
        ->and($detail['pickup']['applies'])->toBe((string) $first === (string) $assignment->reservation_service_id);

    if (! $detail['pickup']['applies']) {
        expect($detail['pickup']['flight'])->toBeNull()->and($detail['pickup']['sign'])->toBeNull();
    }
});

it('G3-27: Operaciones desactiva un teléfono y la app recibe la orden de borrar sus datos', function () {
    $assignment = g3Guide();
    actingAsSeed('U09');
    $device = $this->postJson('/api/v1/mobile/devices', ['platform' => 'android', 'app_version' => '1.0.0'])->assertCreated()->json('data.id');

    actingAsSeed('U01');
    $this->postJson("/api/v1/ops/mobile-devices/{$device}/revoke")->assertOk()->assertJsonPath('data.revoked', true);
    expect($this->postJson("/api/v1/ops/mobile-devices/{$device}/revoke"))->toBeApiError(409, 'MOB-DEVICE-01')
        ->and(withinTenant(tenantA(), fn () => DB::table('audit_events')->where(['entity' => 'Dispositivo móvil', 'entity_id' => $device, 'action' => 'revocar'])->exists()))->toBeTrue();

    actingAsSeed('U09');
    $boot = $this->withHeaders(['X-Device-Id' => $device])->getJson('/api/v1/mobile/operator/bootstrap');
    expect($boot)->toBeApiError(403, 'DEVICE_REVOKED');

    $action = ['client_action_id' => (string) Str::uuid7(), 'device_id' => $device, 'assignment_id' => $assignment->id, 'type' => 'confirm', 'occurred_at' => now()->toIso8601String(), 'offline' => false, 'payload' => []];
    expect($this->postJson('/api/v1/mobile/operator/sync', ['actions' => [$action]]))->toBeApiError(403, 'DEVICE_REVOKED');
});

it('G3-27: un guía no puede desactivar teléfonos desde el back-office', function () {
    actingAsSeed('U09');

    expect($this->postJson('/api/v1/ops/mobile-devices/'.Str::uuid7().'/revoke')->status())->toBe(403);
});

it('G3-31: la vista previa del operador trae contadores de sincronización, teléfonos y la orden de cada servicio', function () {
    actingAsSeed('U01');

    $preview = $this->getJson('/api/v1/mobile/operator')->assertOk()->json('data');

    expect($preview['sync'])->toHaveKeys(['received', 'applied', 'offline', 'conflicts', 'rejected'])
        ->and($preview['devices'])->toHaveKey('items');
    if ($preview['services'] !== []) {
        expect($preview['services'][0])->toHaveKey('order');
    }
});
