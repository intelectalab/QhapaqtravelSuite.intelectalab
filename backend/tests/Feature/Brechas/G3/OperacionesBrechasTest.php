<?php

use App\Domain\Documents\Support\VoucherSheet;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;

it('G3-08: la solicitud al cliente usa su plantilla y lista los documentos que faltan, incluidos los vencidos', function () {
    Queue::fake();
    $row = withinTenant(tenantA(), fn () => DB::table('booking_reservations as r')->join('crm_clients as c', 'c.id', '=', 'r.client_id')->whereNull('r.deleted_at')->where('r.status', '<>', 'cancelada')->whereNotNull('c.email')
        ->whereExists(fn ($query) => $query->from('ops_travel_doc_items as i')->whereColumn('i.reservation_id', 'r.id')->whereIn('i.status', ['pendiente', 'observado']))->orderBy('r.code')->first(['r.id', 'r.code']));
    actingAsSeed('U01');

    $result = $this->postJson("/api/v1/reservations/{$row->code}/travel-docs/requests", ['channels' => ['Email']])->assertCreated()->json('data');
    $message = withinTenant(tenantA(), fn () => DB::table('notif_messages')->where('reservation_id', $row->id)->where('event_code', 'documentos.solicitud')->orderByDesc('created_at')->first(['body_rendered']));

    expect($result['items'])->toBe(count($result['documents']))
        ->and($result['documents'][0])->toContain(':')
        ->and($message)->not->toBeNull()
        ->and($message->body_rendered)->toContain($result['documents'][0]);
});

it('G3-01: el detalle de documentos trae la bitácora y el listado el asesor y los pasajeros', function () {
    $code = withinTenant(tenantA(), fn () => DB::table('booking_reservations as r')->whereNull('r.deleted_at')->where('r.status', '<>', 'cancelada')
        ->whereExists(fn ($query) => $query->from('ops_travel_doc_items as i')->whereColumn('i.reservation_id', 'r.id'))->orderBy('r.code')->value('r.code'));
    actingAsSeed('U01');

    $list = $this->getJson('/api/v1/ops/travel-docs')->assertOk()->json('data.items');
    $detail = $this->getJson("/api/v1/reservations/{$code}/travel-docs")->assertOk()->json('data');

    expect($list[0])->toHaveKeys(['owner', 'passengers'])
        ->and($detail)->toHaveKey('log')
        ->and($detail['passengers'][0]['documents'][0])->toHaveKeys(['min_expiry', 'validated_by']);
});

it('G3-02 y G3-03: la lista de órdenes cuenta los servicios y la reserva candidata dice cuántos se replicarán', function () {
    actingAsSeed('U01');

    $data = $this->getJson('/api/v1/ops/orders')->assertOk()->json('data');

    expect($data['items'][0])->toHaveKey('services')
        ->and($data['items'][0]['reservation'])->toHaveKey('channel');

    if ($data['candidates'] !== []) {
        expect($data['candidates'][0])->toHaveKeys(['services', 'replicable', 'passengers'])
            ->and($data['candidates'][0]['replicable'])->toBeLessThanOrEqual($data['candidates'][0]['services']);
    }
});

it('G3-13: la agenda de recursos incluye las salidas programadas', function () {
    actingAsSeed('U01');

    $data = $this->getJson('/api/v1/ops/resources')->assertOk()->json('data');

    expect($data)->toHaveKey('departures');
    foreach ($data['departures'] as $departure) {
        expect($departure)->toHaveKeys(['kind', 'resource_id', 'date', 'label', 'ref']);
    }
});

it('G3-12: quien asigna recursos puede retirar evidencias desde el detalle de la incidencia', function () {
    $code = withinTenant(tenantA(), fn () => DB::table('ops_incidents')->orderBy('code')->value('code'));
    actingAsSeed('U01');

    expect($this->getJson("/api/v1/ops/incidents/{$code}")->assertOk()->json('data.can'))->toHaveKey('remove_evidence');
});

it('G3-11: el voucher lleva el contacto de emergencia 24/7 y al coordinador con su teléfono', function () {
    $voucher = withinTenant(tenantA(), fn () => DB::table('ops_vouchers as v')->join('ops_orders as o', 'o.reservation_id', '=', 'v.reservation_id')->whereNotNull('o.coordinator_id')->where('o.status', '<>', 'cancelada')->orderBy('v.code')->value('v.id'));
    $draft = withinTenant(tenantA(), fn () => app(VoucherSheet::class)->draft((string) $voucher));

    expect($draft->data)->toHaveKey('emergency')
        ->and(collect($draft->data['crew'])->pluck('label'))->toContain('Coordinador');
});
