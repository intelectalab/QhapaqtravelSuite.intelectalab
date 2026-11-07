<?php

use Illuminate\Support\Facades\DB;

it('el checklist documental responde en /reservations/{id}/travel-docs', function () {
    actingAsSeed('U05');
    $item = withinTenant(tenantA(), fn () => DB::table('ops_travel_doc_items as i')->join('booking_reservations as r', 'r.id', '=', 'i.reservation_id')->where('i.status', '!=', 'observado')->orderBy('r.code')->first(['i.id', 'i.passenger_id', 'i.doc_type', 'r.code']));

    $this->getJson("/api/v1/reservations/{$item->code}/travel-docs")->assertOk()->assertJsonPath('data.code', $item->code);
    $this->postJson("/api/v1/reservations/{$item->code}/travel-docs/{$item->passenger_id}/{$item->doc_type}/observe", ['reason' => 'Falta la página de datos'], critical())->assertOk()->assertJsonPath('data.id', $item->id);

    expect(rowOf('ops_travel_doc_items', $item->id, column: 'id')->status)->toBe('observado')
        ->and($this->postJson("/api/v1/reservations/{$item->code}/travel-docs/{$item->passenger_id}/otro/observe", ['reason' => 'Falta la página de datos'], critical())->status())->toBe(404)
        ->and($this->getJson("/api/v1/ops/travel-docs/{$item->code}")->status())->toBe(404)
        ->and(routeExists('POST', "/api/v1/ops/travel-docs/items/{$item->id}/validate"))->toBeFalse();
});
