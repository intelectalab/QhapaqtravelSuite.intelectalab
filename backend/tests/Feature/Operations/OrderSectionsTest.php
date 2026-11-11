<?php

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;

beforeEach(fn () => Queue::fake());

it('la orden 360 trae rooming, vouchers, datos web, pasajeros completos y proveedor por servicio', function () {
    actingAsSeed('U01');
    $code = withinTenant(tenantA(), fn () => DB::table('ops_orders')->whereNull('deleted_at')->orderBy('code')->value('code'));

    $data = $this->getJson("/api/v1/ops/orders/{$code}")->assertOk()->json('data');

    expect($data)->toHaveKeys(['web', 'rooming', 'vouchers', 'economics', 'reject_reasons'])
        ->and($data['economics'])->toHaveKeys(['sale', 'cost', 'currency'])
        ->and($data['passengers'][0])->toHaveKeys(['relationship', 'doc_number', 'age', 'phone'])
        ->and($data['services'][0])->toHaveKeys(['provider', 'product', 'reject_reason', 'price'])
        ->and($data['can'])->toHaveKeys(['services', 'vouchers']);
});

it('Operaciones ve la orden sin precios de venta ni resumen económico', function () {
    actingAsSeed('U05');
    $code = withinTenant(tenantA(), fn () => DB::table('ops_orders')->whereNull('deleted_at')->orderBy('code')->value('code'));

    $data = $this->getJson("/api/v1/ops/orders/{$code}")->assertOk()->json('data');

    expect($data['economics'])->toBeNull()
        ->and($data['services'][0])->not->toHaveKey('price');
});
