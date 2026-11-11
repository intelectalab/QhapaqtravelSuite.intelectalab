<?php

use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

function fieldAssignment(array $values = []): object
{
    return withinTenant(tenantA(), function () use ($values): object {
        $assignment = DB::table('ops_assignments as a')->join('ops_orders as o', 'o.id', '=', 'a.order_id')->whereNotIn('o.status', ['completada', 'cancelada'])->whereNull('o.deleted_at')
            ->orderBy('o.code')->orderBy('a.service_date')->first(['a.id', 'a.order_id', 'o.code as order_code', 'o.reservation_id']);
        DB::table('ops_assignments')->where('id', $assignment->id)->update(['status' => 'pendiente', 'guide_id' => null, 'driver_id' => null, 'vehicle_id' => null, 'service_date' => BUSINESS_TODAY, 'service_time' => '08:00', ...$values]);

        return DB::table('ops_assignments as a')->join('ops_orders as o', 'o.id', '=', 'a.order_id')->where('a.id', $assignment->id)->first(['a.*', 'o.code as order_code', 'o.reservation_id']);
    });
}

function fieldAudit(array $where): bool
{
    return withinTenant(tenantA(), fn () => DB::table('audit_events')->where($where)->exists());
}

it('la validación en vivo devuelve bloqueos y advertencias sin guardar la asignación', function () {
    $assignment = fieldAssignment();
    [$driver, $vehicle, $guide] = withinTenant(tenantA(), function (): array {
        $driver = DB::table('ops_drivers')->whereNull('deleted_at')->orderBy('code')->value('id');
        $vehicle = DB::table('ops_vehicles')->whereNull('deleted_at')->orderBy('plate')->value('id');
        $guide = DB::table('ops_guides')->whereNull('deleted_at')->orderBy('code')->value('id');
        DB::table('ops_drivers')->where('id', $driver)->update(['license_expires_on' => '2026-09-01', 'status' => 'disponible']);
        DB::table('ops_vehicles')->where('id', $vehicle)->update(['capacity' => 1, 'status' => 'disponible', 'soat_expires_on' => '2027-09-01']);
        DB::table('ops_guides')->where('id', $guide)->update(['status' => 'descanso']);

        return [$driver, $vehicle, $guide];
    });
    actingAsSeed('U01');

    $data = $this->postJson("/api/v1/ops/assignments/{$assignment->id}/validate", ['guide_id' => $guide, 'driver_id' => $driver, 'vehicle_id' => $vehicle])->assertOk()->json('data');
    expect($data['ready'])->toBeFalse()
        ->and(implode(' ', $data['blocks']))->toContain('licencia')->toContain('plazas')
        ->and(implode(' ', $data['warnings']))->toContain('descanso')
        ->and($data['context']['passengers'])->toBeGreaterThan(0);
    expect(rowOf('ops_assignments', $assignment->id, column: 'id')->status)->toBe('pendiente');

    $empty = $this->postJson("/api/v1/ops/assignments/{$assignment->id}/validate", [])->assertOk()->json('data');
    expect($empty['ready'])->toBeFalse()->and($empty['blocks'])->toBe([]);
});

it('la validación en vivo detecta el cruce de horario con otra orden', function () {
    $assignment = fieldAssignment();
    $guide = withinTenant(tenantA(), function () use ($assignment): string {
        $guide = (string) DB::table('ops_guides')->whereNull('deleted_at')->orderBy('code')->value('id');
        DB::table('ops_guides')->where('id', $guide)->update(['status' => 'disponible']);
        $other = DB::table('ops_assignments as a')->join('ops_orders as o', 'o.id', '=', 'a.order_id')->where('a.order_id', '<>', $assignment->order_id)->whereNotIn('o.status', ['cancelada'])->value('a.id');
        DB::table('ops_assignments')->where('id', $other)->update(['guide_id' => $guide, 'status' => 'asignada', 'service_date' => BUSINESS_TODAY, 'service_time' => '09:00']);

        return $guide;
    });
    actingAsSeed('U01');

    $data = $this->postJson("/api/v1/ops/assignments/{$assignment->id}/validate", ['guide_id' => $guide])->assertOk()->json('data');
    expect(implode(' ', $data['blocks']))->toContain('menos de 6 horas');
});

it('al asignar con aviso deja el mensaje en la bandeja interna del guía', function () {
    $assignment = fieldAssignment();
    $guide = withinTenant(tenantA(), function (): string {
        $guide = (string) DB::table('iam_users')->where('code', 'U09')->value('guide_id');
        DB::table('ops_guides')->where('id', $guide)->update(['status' => 'disponible']);
        DB::table('ops_assignments')->where('guide_id', $guide)->where('service_date', BUSINESS_TODAY)->update(['guide_id' => null]);

        return $guide;
    });
    actingAsSeed('U01');

    $result = $this->putJson("/api/v1/ops/assignments/{$assignment->id}/resources", ['guide_id' => $guide, 'ack_warnings' => true, 'notify' => ['push', 'whatsapp']], critical((int) $assignment->lock_version))->assertOk()->json('data');
    expect($result['notified'])->toBe(1)->and($result['delivery'])->toBe('portal')->and($result['channels'])->toBe(['push', 'whatsapp']);
    $message = withinTenant(tenantA(), fn () => DB::table('notif_messages')->where('event_code', 'asignacion.creada')->where('source_id', $assignment->id)->first());
    expect($message->channel)->toBe('portal')
        ->and((string) $message->recipient_user_id)->toBe((string) seedUser('U09')->getKey());

    $this->putJson("/api/v1/ops/assignments/{$assignment->id}/resources", ['guide_id' => $guide, 'notify' => ['fax']], critical((int) rowOf('ops_assignments', $assignment->id, column: 'id')->lock_version))->assertStatus(422)->assertJsonValidationErrors('notify.0');
});

it('registra y corrige el check-in por pasajero desde la ficha de la orden', function () {
    $guide = withinTenant(tenantA(), fn () => (string) DB::table('ops_guides')->whereNull('deleted_at')->orderBy('code')->value('id'));
    $assignment = fieldAssignment(['status' => 'confirmada', 'guide_id' => $guide]);
    $passengers = withinTenant(tenantA(), fn () => DB::table('booking_passengers')->where('reservation_id', $assignment->reservation_id)->orderBy('seq')->pluck('id')->map(fn ($id) => (string) $id)->all());
    expect(count($passengers))->toBeGreaterThan(0);
    actingAsSeed('U01');

    $this->putJson("/api/v1/ops/assignments/{$assignment->id}/checkins", ['passenger_ids' => $passengers])->assertOk()->assertJsonPath('data.present', count($passengers));
    $order = $this->getJson("/api/v1/ops/orders/{$assignment->order_code}")->assertOk()->json('data');
    expect(collect($order['assignments'])->firstWhere('id', $assignment->id)['checked_in'])->toHaveCount(count($passengers))
        ->and(collect($order['passengers'])->firstWhere('id', $passengers[0])['checkins'])->toBeGreaterThanOrEqual(1)
        ->and(rowOf('ops_assignments', $assignment->id, column: 'id')->first_checkin_at)->not->toBeNull()
        ->and(fieldAudit(['entity' => 'Asignación', 'action' => 'check_in']))->toBeTrue();

    $this->putJson("/api/v1/ops/assignments/{$assignment->id}/checkins", ['passenger_ids' => [$passengers[0]]])->assertOk()->assertJsonPath('data.removed', count($passengers) - 1);
    expect(withinTenant(tenantA(), fn () => DB::table('ops_assignment_checkins')->where('assignment_id', $assignment->id)->whereNull('undone_at')->count()))->toBe(1);

    $this->putJson("/api/v1/ops/assignments/{$assignment->id}/checkins", ['passenger_ids' => [(string) Str::uuid7()]])->assertStatus(422);
    withinTenant(tenantA(), fn () => DB::table('ops_assignments')->where('id', $assignment->id)->update(['service_date' => '2026-10-15']));
    expect($this->putJson("/api/v1/ops/assignments/{$assignment->id}/checkins", ['passenger_ids' => []]))->toBeApiError(409, 'OPS-BR-50');
    withinTenant(tenantA(), fn () => DB::table('ops_assignments')->where('id', $assignment->id)->update(['service_date' => BUSINESS_TODAY, 'status' => 'pendiente', 'guide_id' => null]));
    expect($this->putJson("/api/v1/ops/assignments/{$assignment->id}/checkins", ['passenger_ids' => []]))->toBeApiError(409, 'OPS-BR-50');
});

it('prellena las rooming lists por ciudad desde el alojamiento de la reserva web', function () {
    $assignment = fieldAssignment();
    $reservation = withinTenant(tenantA(), function () use ($assignment): object {
        $reservation = DB::table('booking_reservations')->where('id', $assignment->reservation_id)->first(['id', 'code', 'travel_from', 'status']);
        DB::table('booking_reservations')->where('id', $reservation->id)->update(['status' => 'confirmada']);
        $snapshot = (string) Str::uuid7();
        DB::table('booking_reservation_web_snapshots')->insert(['id' => $snapshot, 'reservation_id' => $reservation->id, 'product_id' => DB::table('catalog_products')->value('id'), 'service_date' => $reservation->travel_from, 'pax_adt' => 2, 'pax_chd' => 0, 'pax_inf' => 0, 'currency_display' => 'USD', 'charge_currency' => 'USD', 'fx_rate' => 1, 'lines' => '[]', 'total' => 0, 'payment_mode' => 'total']);
        DB::table('booking_reservation_web_lodging')->insert([
            ['snapshot_id' => $snapshot, 'leg_id' => 'leg-cusco', 'city' => 'Cusco', 'hotel_name' => 'Hotel Tambo Real', 'room_type' => 'Doble', 'rooms' => 2, 'nights' => 3, 'created_at' => now()],
            ['snapshot_id' => $snapshot, 'leg_id' => 'leg-lima', 'city' => 'Lima', 'hotel_name' => 'Hotel Miraflores', 'room_type' => 'Suite presidencial', 'rooms' => 1, 'nights' => 1, 'created_at' => now()->addSecond()],
        ]);

        return $reservation;
    });
    actingAsSeed('U01');

    $pending = $this->getJson("/api/v1/ops/orders/{$assignment->order_code}")->assertOk()->json('data.lodging_pending');
    expect(collect($pending)->pluck('city')->all())->toBe(['Cusco', 'Lima']);

    $created = $this->postJson('/api/v1/ops/rooming/prefill', ['reservation' => $reservation->code], critical())->assertCreated()->json('data.created');
    expect($created)->toHaveCount(2);
    $lists = withinTenant(tenantA(), fn () => DB::table('ops_rooming_lists')->where('reservation_id', $reservation->id)->where('source', 'booking.lodging')->orderBy('check_in')->get());
    expect($lists)->toHaveCount(2)
        ->and($lists[0]->check_in)->toBe($reservation->travel_from)
        ->and($lists[1]->check_in)->toBe(CarbonImmutable::parse($reservation->travel_from)->addDays(3)->toDateString());
    $rooms = withinTenant(tenantA(), fn () => DB::table('ops_rooming_rooms')->where('rooming_list_id', $lists[0]->id)->orderBy('room_number')->get());
    expect($rooms->pluck('room_number')->all())->toBe(['CUS-1', 'CUS-2'])
        ->and(withinTenant(tenantA(), fn () => DB::table('ops_rooming_rooms')->where('rooming_list_id', $lists[1]->id)->value('room_type')))->toBe('Doble')
        ->and(fieldAudit(['entity' => 'Rooming list', 'action' => 'prellenar_reserva_web']))->toBeTrue();

    expect($this->postJson('/api/v1/ops/rooming/prefill', ['reservation' => $reservation->code], critical()))->toBeApiError(409, 'OPS-V21-02');
    expect($this->getJson("/api/v1/ops/orders/{$assignment->order_code}")->json('data.lodging_pending'))->toBe([]);
});

it('la ficha de la orden lista las evidencias de las incidencias de su reserva', function () {
    $assignment = fieldAssignment();
    $code = withinTenant(tenantA(), function () use ($assignment): string {
        $incident = (string) Str::uuid7();
        DB::table('ops_incidents')->insert(['id' => $incident, 'code' => 'INC-9901', 'reservation_id' => $assignment->reservation_id, 'type' => 'Proveedor', 'severity' => 'media', 'title' => 'Observación del hotel', 'description' => 'Habitación en mantenimiento.', 'status' => 'abierta', 'reported_by' => DB::table('iam_users')->where('code', 'U17')->value('id'), 'source' => 'extranet', 'sla_hours' => 24, 'sla_due_at' => now()->addDay()]);
        DB::table('ops_evidences')->insert(['incident_id' => $incident, 'file_name' => 'foto_habitacion.jpg', 'storage_path' => 'tenants/x/ops/evidences/foto.jpg', 'mime_type' => 'image/jpeg', 'size_bytes' => 1200, 'sha256' => str_repeat('a', 64), 'source' => 'web', 'captured_at' => now(), 'uploaded_by' => DB::table('iam_users')->where('code', 'U01')->value('id')]);

        return 'INC-9901';
    });
    actingAsSeed('U01');

    $files = $this->getJson("/api/v1/ops/orders/{$assignment->order_code}")->assertOk()->json('data.evidence_files');
    $file = collect($files)->firstWhere('name', 'foto_habitacion.jpg');
    expect($file['incident'])->toBe($code)->and($file['incident_title'])->toBe('Observación del hotel');
});

it('ventas no valida asignaciones ni registra check-in', function () {
    $assignment = fieldAssignment();
    actingAsSeed('U03');

    $this->postJson("/api/v1/ops/assignments/{$assignment->id}/validate", [])->assertForbidden();
    $this->putJson("/api/v1/ops/assignments/{$assignment->id}/checkins", ['passenger_ids' => []])->assertForbidden();
});
