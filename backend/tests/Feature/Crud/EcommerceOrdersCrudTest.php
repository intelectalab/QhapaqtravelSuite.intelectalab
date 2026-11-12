<?php

use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;

function ecoPendingOrder(): string
{
    $token = (string) test()->postJson('/api/v1/public/carts/current/items', ['product' => 'laguna-humantay-full-day', 'date' => '2026-10-04', 'adults' => 2], siteOf(extra: critical()))->assertCreated()->json('data.token');

    return (string) test()->withCredentials()->withUnencryptedCookie('ah_cart', $token)->postJson('/api/v1/public/checkout/orders', [
        'name' => 'Valeria Ccori Mendoza',
        'email' => 'valeria.ccori@pedido.pe',
        'phone' => '+51 955 111 222',
        'country' => 'Perú',
        'doc_type' => 'DNI',
        'doc_number' => '47851236',
        'billing_type' => 'Boleta',
        'terms' => true,
        'privacy' => true,
        'passengers' => webTravelers(2),
    ], siteOf(extra: critical()))->assertCreated()->json('data.code');
}

function ecoOrderState(string $code): array
{
    return withinTenant(tenantA(), function () use ($code) {
        $order = DB::table('channel_ecom_orders')->where('code', $code)->first();
        $reservations = DB::table('booking_reservations')->where('ecom_order_id', $order->id)->get(['id', 'code', 'status']);

        return [
            'order' => $order,
            'holds' => DB::table('catalog_availability_holds')->where('reference_id', $order->id)->pluck('status')->all(),
            'reservations' => $reservations->pluck('status')->all(),
            'services' => DB::table('booking_reservation_services')->whereIn('reservation_id', $reservations->pluck('id'))->pluck('status')->unique()->values()->all(),
            'receivables' => DB::table('fin_receivables')->whereIn('reservation_id', $reservations->pluck('id'))->pluck('status')->unique()->values()->all(),
        ];
    });
}

function ecoCancel(string $code, array $body = ['reason' => 'Cliente desistió de la compra'])
{
    return test()->postJson("/api/v1/channels/ecommerce/orders/{$code}/cancel", $body, critical((int) rowOf('channel_ecom_orders', $code)->lock_version));
}

beforeEach(function () {
    $this->withoutMiddleware(ThrottleRequests::class);
    Queue::fake();
});

it('anular un pedido web pendiente libera los cupos, cancela la reserva, sus servicios y la cuota sin pagos', function () {
    $code = ecoPendingOrder();
    $before = ecoOrderState($code);
    expect($before['order']->status)->toBe('pago_pendiente')
        ->and($before['holds'])->toContain('hold')
        ->and($before['reservations'])->toBe(['pendiente_pago']);

    actingAsSeed('U01');
    ecoCancel($code)->assertOk()->assertJsonPath('data.code', $code);

    $after = ecoOrderState($code);
    expect($after['order']->status)->toBe('cancelado')
        ->and($after['order']->cancel_reason)->toBe('Cliente desistió de la compra')
        ->and($after['holds'])->not->toContain('hold')
        ->and($after['reservations'])->toBe(['cancelada'])
        ->and($after['services'])->toBe(['cancelado'])
        ->and($after['receivables'])->toBe(['cancelada'])
        ->and(withinTenant(tenantA(), fn () => DB::table('audit_events')->where(['entity' => 'Pedido web', 'entity_id' => $code, 'action' => 'anular'])->exists()))->toBeTrue();
});

it('anular un pedido sin reserva solo cambia su estado', function () {
    actingAsSeed('U01');

    ecoCancel('WEB-10430')->assertOk();

    expect(rowOf('channel_ecom_orders', 'WEB-10430')->status)->toBe('cancelado')
        ->and(rowOf('channel_ecom_orders', 'WEB-10430')->cancel_reason)->toBe('Cliente desistió de la compra');
});

it('solo se anulan pedidos abiertos: confirmados y ya anulados responden 409', function () {
    actingAsSeed('U01');

    expect(ecoCancel('WEB-10431'))->toBeApiError(409, 'ECO-BR-04')
        ->and(rowOf('channel_ecom_orders', 'WEB-10431')->status)->toBe('confirmado');

    ecoCancel('WEB-10433')->assertOk();
    expect(ecoCancel('WEB-10433'))->toBeApiError(409, 'ECO-BR-04');
});

it('un pedido con el abono por validar no se anula desde el canal: lo resuelve Finanzas al validar', function () {
    actingAsSeed('U01');
    withinTenant(tenantA(), fn () => DB::table('channel_ecom_orders')->where('code', 'WEB-10433')->update(['status' => 'pago_por_validar']));

    expect(ecoCancel('WEB-10433'))->toBeApiError(409, 'ECO-BR-04')
        ->and(rowOf('channel_ecom_orders', 'WEB-10433')->status)->toBe('pago_por_validar');
});

it('anular exige motivo, la versión del pedido y el permiso de e-commerce', function () {
    actingAsSeed('U01');
    ecoCancel('WEB-10433', ['reason' => ''])->assertStatus(422)->assertJsonValidationErrors(['reason']);
    expect($this->postJson('/api/v1/channels/ecommerce/orders/WEB-10433/cancel', ['reason' => 'Cliente desistió'], critical()))->toBeApiError(428, 'IF_MATCH_REQUIRED');

    actingAsSeed('U03');
    expect(ecoCancel('WEB-10433'))->toBeApiError(403)
        ->and(rowOf('channel_ecom_orders', 'WEB-10433')->status)->toBe('pago_pendiente');
});
