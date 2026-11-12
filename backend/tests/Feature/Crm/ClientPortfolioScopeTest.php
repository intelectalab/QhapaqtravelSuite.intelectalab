<?php

use Illuminate\Support\Facades\DB;

it('la cartera de Ventas incluye al cliente con una reserva suya y el 360 solo muestra lo suyo (01 §6)', function () {
    $seller = actingAsSeed('U03');
    $row = withinTenant(tenantA(), fn () => DB::table('booking_reservations as r')->join('crm_clients as c', 'c.id', '=', 'r.client_id')
        ->whereNull('r.deleted_at')->where('c.owner_id', '<>', $seller->id)->first(['r.id', 'r.code', 'c.id as client_id', 'c.code as client']));
    expect($row)->not->toBeNull();
    withinTenant(tenantA(), fn () => DB::table('booking_reservations')->where('id', $row->id)->update(['owner_id' => $seller->id]));
    withinTenant(tenantA(), fn () => DB::table('booking_reservations')->where('client_id', $row->client_id)->where('id', '<>', $row->id)->update(['owner_id' => seedUser('U04')->id]));

    $detail = $this->getJson("/api/v1/crm/clients/{$row->client}")->assertOk()->json('data');
    $reservations = collect($this->getJson("/api/v1/crm/clients/{$row->client}/reservations")->assertOk()->json('data'))->pluck('code')->all();

    expect($detail['partial'])->toBeTrue()
        ->and($reservations)->toBe([$row->code]);
});
