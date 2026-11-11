<?php

use Illuminate\Support\Facades\DB;

beforeEach(function () {
    lockSeededBookings();
});

function supOpsAudit(array $where): bool
{
    return withinTenant(tenantA(), fn () => DB::table('audit_events')->where($where)->exists());
}

function supOpsList(string $providerRef = 'PRV-001'): object
{
    return withinTenant(tenantA(), function () use ($providerRef): object {
        $provider = DB::table('catalog_providers')->where('ref', $providerRef)->value('id');
        $list = DB::table('ops_rooming_lists')->where('hotel_provider_id', $provider)->whereNull('deleted_at')->orderBy('check_in')->first();
        DB::table('ops_rooming_lists')->where('id', $list->id)->update(['status' => 'enviada', 'sent_at' => now(), 'sent_version' => 1, 'hotel_ack_at' => null, 'hotel_ack_by' => null, 'hotel_confirmed_at' => null, 'hotel_confirmed_by' => null]);

        return DB::table('ops_rooming_lists')->where('id', $list->id)->first();
    });
}

function supOpsVoucher(string $providerRef, string $status, string $date): string
{
    return withinTenant(tenantA(), function () use ($providerRef, $status, $date): string {
        $provider = DB::table('catalog_providers')->where('ref', $providerRef)->value('id');
        $code = DB::table('ops_vouchers')->where('provider_id', $provider)->orderBy('code')->value('code');
        DB::table('ops_vouchers')->where('code', $code)->update(['status' => $status, 'service_date' => $date, 'used_at' => $status === 'utilizado' ? now()->subDay() : null, 'void_reason' => $status === 'anulado' ? 'Cambio de proveedor' : null, 'void_at' => $status === 'anulado' ? now() : null]);

        return $code;
    });
}

function supOpsService(string $providerRef = 'PRV-001'): object
{
    return withinTenant(tenantA(), function () use ($providerRef): object {
        $provider = DB::table('catalog_providers')->where('ref', $providerRef)->value('id');
        $service = DB::table('booking_reservation_services as s')->join('booking_reservations as r', 'r.id', '=', 's.reservation_id')->where('s.provider_id', $provider)->where('r.status', '<>', 'borrador')->whereNull('r.deleted_at')->orderBy('s.code')->first(['s.id', 's.code', 's.reservation_id']);
        DB::table('booking_reservation_services')->where('id', $service->id)->update(['status' => 'confirmado', 'confirmation_code' => 'TR-55620', 'confirmed_at' => now(), 'service_date' => BUSINESS_TODAY]);

        return $service;
    });
}

it('el hotel acusa recibo, observa una habitación y confirma el resto de su rooming list', function () {
    $list = supOpsList();
    actingAsSeed('U17');

    $items = collect($this->getJson('/api/v1/supplier/rooming-lists')->assertOk()->json('data.items'));
    $item = $items->firstWhere('id', $list->id);
    expect($item['state'])->toBe('por_acusar')->and($item['rooms'])->not->toBeEmpty();

    $this->postJson("/api/v1/supplier/rooming-lists/{$list->id}/acknowledge", ['lock_version' => $list->lock_version], critical())->assertOk();
    expect(rowOf('ops_rooming_lists', $list->id, column: 'id')->hotel_ack_at)->not->toBeNull()
        ->and(supOpsAudit(['entity' => 'Rooming list', 'action' => 'acuse_recibo_hotel']))->toBeTrue();
    expect($this->postJson("/api/v1/supplier/rooming-lists/{$list->id}/acknowledge", [], critical()))->toBeApiError(409, 'SUP-BR-20');

    $room = $item['rooms'][0];
    $this->postJson("/api/v1/supplier/rooming-rooms/{$room['id']}/observations", ['reason' => 'Habitación en mantenimiento', 'impact' => 'alta', 'proposal' => 'Upgrade a junior suite sin costo.'], critical())->assertCreated();
    $observed = rowOf('ops_rooming_rooms', $room['id'], column: 'id');
    $incident = withinTenant(tenantA(), fn () => DB::table('ops_incidents')->where('id', $observed->incident_id)->first());
    expect($observed->status)->toBe('observada')
        ->and($incident->source)->toBe('extranet')
        ->and($incident->type)->toBe('Proveedor')
        ->and($incident->severity)->toBe('alta')
        ->and(withinTenant(tenantA(), fn () => DB::table('notif_messages')->where('event_code', 'incidencia.creada')->where('source_id', $incident->id)->exists()))->toBeTrue();
    expect($this->postJson("/api/v1/supplier/rooming-rooms/{$room['id']}/observations", ['reason' => 'Otro', 'impact' => 'baja', 'proposal' => 'Otra vez.'], critical()))->toBeApiError(409, 'SUP-BR-22');

    $version = (int) rowOf('ops_rooming_lists', $list->id, column: 'id')->lock_version;
    expect($this->postJson("/api/v1/supplier/rooming-lists/{$list->id}/confirm", ['lock_version' => $version - 1], critical()))->toBeApiError(409, 'STALE_VERSION');
    $this->postJson("/api/v1/supplier/rooming-lists/{$list->id}/confirm", ['lock_version' => $version], critical())->assertOk();
    $statuses = withinTenant(tenantA(), fn () => DB::table('ops_rooming_rooms')->where('rooming_list_id', $list->id)->pluck('status', 'id'));
    expect($statuses[$room['id']])->toBe('observada')
        ->and($statuses->except($room['id'])->unique()->values()->all())->toBe(count($statuses) > 1 ? ['confirmada'] : [])
        ->and(rowOf('ops_rooming_lists', $list->id, column: 'id')->hotel_confirmed_at)->not->toBeNull();
});

it('un hotel no ve ni responde rooming lists de otro proveedor', function () {
    $list = supOpsList();
    withinTenant(tenantA(), fn () => DB::table('ops_rooming_lists')->where('id', $list->id)->update(['hotel_provider_id' => DB::table('catalog_providers')->where('ref', 'PRV-002')->value('id')]));
    actingAsSeed('U17');

    expect(collect($this->getJson('/api/v1/supplier/rooming-lists')->json('data.items'))->pluck('id'))->not->toContain($list->id);
    $this->postJson("/api/v1/supplier/rooming-lists/{$list->id}/acknowledge", [], critical())->assertNotFound();
    $this->postJson("/api/v1/supplier/rooming-lists/{$list->id}/confirm", [], critical())->assertNotFound();
});

it('la rooming list en modificación no admite respuesta del hotel y el reenvío pide un nuevo acuse', function () {
    $list = supOpsList();
    withinTenant(tenantA(), fn () => DB::table('ops_rooming_lists')->where('id', $list->id)->update(['status' => 'modificada', 'hotel_ack_at' => now()]));
    actingAsSeed('U17');

    expect($this->postJson("/api/v1/supplier/rooming-lists/{$list->id}/confirm", [], critical()))->toBeApiError(409, 'SUP-BR-20');

    actingAsSeed('U01');
    withinTenant(tenantA(), fn () => DB::table('ops_rooming_lists')->where('id', $list->id)->update(['status' => 'confirmada']));
    $this->postJson("/api/v1/ops/rooming-lists/{$list->id}/send", [], critical((int) rowOf('ops_rooming_lists', $list->id, column: 'id')->lock_version))->assertOk();
    expect(rowOf('ops_rooming_lists', $list->id, column: 'id')->hotel_ack_at)->toBeNull();
});

it('el proveedor valida un voucher en recepción con las reglas de anulado, utilizado y fecha', function () {
    $code = supOpsVoucher('PRV-001', 'emitido', BUSINESS_TODAY);
    actingAsSeed('U17');

    expect(collect($this->getJson('/api/v1/supplier/vouchers')->assertOk()->json('data.items'))->pluck('code'))->toContain($code);
    $this->postJson('/api/v1/supplier/vouchers/redeem', ['code' => strtolower($code)], critical())->assertOk()->assertJsonPath('data.code', $code);
    $row = rowOf('ops_vouchers', $code);
    expect($row->status)->toBe('utilizado')
        ->and($row->used_via)->toBe('extranet')
        ->and(supOpsAudit(['entity' => 'Voucher', 'entity_id' => $code, 'action' => 'check_in_proveedor']))->toBeTrue();
    expect($this->postJson('/api/v1/supplier/vouchers/redeem', ['code' => $code], critical()))->toBeApiError(409, 'SUP-BR-31');

    supOpsVoucher('PRV-001', 'anulado', BUSINESS_TODAY);
    expect($this->postJson('/api/v1/supplier/vouchers/redeem', ['code' => $code], critical()))->toBeApiError(409, 'SUP-BR-31');

    $tomorrow = now()->addDay()->toDateString();
    supOpsVoucher('PRV-001', 'emitido', $tomorrow);
    expect($this->postJson('/api/v1/supplier/vouchers/redeem', ['code' => $code], critical()))->toBeApiError(422, 'SUP-BR-32');
    $this->postJson('/api/v1/supplier/vouchers/redeem', ['code' => $code, 'confirm_future' => true], critical())->assertOk();

    supOpsVoucher('PRV-001', 'emitido', now()->addDays(5)->toDateString());
    expect($this->postJson('/api/v1/supplier/vouchers/redeem', ['code' => $code, 'confirm_future' => true], critical()))->toBeApiError(422, 'SUP-BR-32');
});

it('el proveedor no canjea vouchers emitidos a otro establecimiento', function () {
    $foreign = supOpsVoucher('PRV-005', 'emitido', BUSINESS_TODAY);
    actingAsSeed('U17');

    expect(collect($this->getJson('/api/v1/supplier/vouchers')->json('data.items'))->pluck('code'))->not->toContain($foreign);
    $this->postJson('/api/v1/supplier/vouchers/redeem', ['code' => $foreign], critical())->assertNotFound();
    expect(rowOf('ops_vouchers', $foreign)->status)->toBe('emitido');
});

it('el proveedor reporta una incidencia, la sigue y comenta mientras está abierta', function () {
    $service = supOpsService();
    actingAsSeed('U17');

    $this->postJson('/api/v1/supplier/incidents', ['service' => $service->code, 'type' => 'Capacidad', 'severity' => 'critica', 'title' => 'Sin habitaciones dobles', 'description' => 'Por sobreventa proponemos dos triples.'], critical())->assertCreated();
    $code = $this->getJson('/api/v1/supplier/incidents')->assertOk()->json('data.items.0.code');
    $incident = rowOf('ops_incidents', $code);
    expect($incident->source)->toBe('extranet')
        ->and($incident->reservation_service_id)->toBe($service->id)
        ->and($incident->sla_hours)->toBe(4)
        ->and(withinTenant(tenantA(), fn () => DB::table('notif_messages')->where('event_code', 'incidencia.critica')->where('source_id', $incident->id)->count()))->toBeGreaterThan(0)
        ->and(supOpsAudit(['entity' => 'Incidencia', 'entity_id' => $code, 'action' => 'crear']))->toBeTrue();

    $this->postJson("/api/v1/supplier/incidents/{$code}/comments", ['message' => 'Confirmamos dos triples a partir de mañana.'])->assertOk();
    $detail = $this->getJson("/api/v1/supplier/incidents/{$code}")->assertOk()->json('data');
    expect(collect($detail['logs'])->pluck('kind')->all())->toContain('comentario')
        ->and(collect($detail['logs'])->pluck('kind')->all())->not->toContain('alerta')
        ->and(collect($detail['logs'])->firstWhere('kind', 'comentario')['mine'])->toBeTrue();

    withinTenant(tenantA(), fn () => DB::table('ops_incidents')->where('code', $code)->update(['status' => 'cerrada', 'resolution' => 'Resuelto']));
    expect($this->postJson("/api/v1/supplier/incidents/{$code}/comments", ['message' => 'Otro comentario.']))->toBeApiError(409, 'SUP-BR-53');
});

it('la incidencia del proveedor exige un servicio suyo y reciente', function () {
    $service = supOpsService();
    actingAsSeed('U17');

    $this->postJson('/api/v1/supplier/incidents', ['service' => $service->code, 'type' => 'Clima', 'severity' => 'media', 'title' => 'x', 'description' => 'corto'], critical())->assertStatus(422)->assertJsonValidationErrors(['type', 'title', 'description']);

    withinTenant(tenantA(), fn () => DB::table('booking_reservation_services')->where('id', $service->id)->update(['service_date' => now()->subDays(10)->toDateString()]));
    expect($this->postJson('/api/v1/supplier/incidents', ['service' => $service->code, 'type' => 'Horario', 'severity' => 'media', 'title' => 'Llegada tarde', 'description' => 'El grupo llegó dos horas tarde.'], critical()))->toBeApiError(422, 'SUP-BR-51');

    $foreign = supOpsService('PRV-005');
    $this->postJson('/api/v1/supplier/incidents', ['service' => $foreign->code, 'type' => 'Horario', 'severity' => 'media', 'title' => 'Llegada tarde', 'description' => 'El grupo llegó dos horas tarde.'], critical())->assertNotFound();
});

it('el inicio del proveedor cuenta incidencias abiertas y rooming por responder', function () {
    supOpsList();
    actingAsSeed('U17');

    $home = $this->getJson('/api/v1/supplier/home')->assertOk()->json('data');
    $session = $this->getJson('/api/v1/supplier/session')->assertOk()->json('data');
    expect($home['kpis'])->toHaveKey('open_incidents')
        ->and($session['counts']['rooming'])->toBeGreaterThan(0)
        ->and(collect($home['alerts'])->pluck('kind'))->toContain('rooming');
});

it('el personal de la agencia no usa las acciones de la extranet', function () {
    $list = supOpsList();
    actingAsSeed('U01');

    $this->getJson('/api/v1/supplier/rooming-lists')->assertForbidden();
    $this->postJson("/api/v1/supplier/rooming-lists/{$list->id}/acknowledge", [], critical())->assertForbidden();
    $this->postJson('/api/v1/supplier/vouchers/redeem', ['code' => 'VOU-2026-00001'], critical())->assertForbidden();
});
