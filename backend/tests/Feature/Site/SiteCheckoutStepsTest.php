<?php

use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use Illuminate\Testing\TestResponse;

beforeEach(function () {
    $this->withoutMiddleware(ThrottleRequests::class);
    Queue::fake();
});

function stepSlug(string $code): string
{
    return (string) withinTenant(tenantA(), fn () => DB::table('catalog_products')->where('code', $code)->value('slug'));
}

function stepDate(string $slug, string $from, int $adults = 2): string
{
    foreach (['2026-10', '2026-11', '2026-12'] as $month) {
        $days = test()->getJson("/api/v1/public/products/{$slug}/calendar?mes={$month}&viajeros={$adults}", siteOf())->assertOk()->json('data.days');
        foreach ($days as $day) {
            if ($day['sellable'] && $day['date'] >= $from) {
                return $day['date'];
            }
        }
    }

    throw new RuntimeException("Sin fecha vendible para {$slug}");
}

function stepCart(string $slug, string $date, int $adults = 2, int $children = 0): string
{
    return (string) test()->postJson('/api/v1/public/carts/current/items', ['product' => $slug, 'date' => $date, 'adults' => $adults, 'children' => $children], siteOf(extra: critical()))->assertCreated()->json('data.token');
}

function stepBuyer(array $extra = []): array
{
    return ['name' => 'Lucía Benavides Ortiz', 'email' => 'lucia.benavides@checkout.pe', 'phone' => '+51 944 222 333', 'country' => 'Perú', 'doc_type' => 'DNI', 'doc_number' => '41236587', 'billing_type' => 'Boleta', ...$extra];
}

function stepPost(string $token, string $path, array $body): TestResponse
{
    return test()->withCredentials()->withUnencryptedCookie('ah_cart', $token)->postJson("/api/v1/public/{$path}", $body, siteOf(extra: critical()));
}

it('SIT-BR-09 v2.1: las condiciones del carrito traen modalidades, grupo, recojo y políticas; el adelanto respeta la política del producto', function () {
    $slug = stepSlug('CUS-PKG-5D4N');
    $token = stepCart($slug, stepDate($slug, '2026-10-25'));

    $terms = $this->withCredentials()->withUnencryptedCookie('ah_cart', $token)->postJson('/api/v1/public/checkout/validate', [], siteOf(extra: critical()))->assertOk()->json('data.terms');
    expect(collect($terms['modes'])->pluck('value')->all())->toBe(['total', 'adelanto'])
        ->and($terms['group'])->toBe(['adt' => 2, 'chd' => 0, 'inf' => 0])
        ->and($terms['items'][0])->toHaveKeys(['pickup', 'comments', 'cancellation', 'deposit_pct', 'balance_due'])
        ->and(collect($terms['modes'])->firstWhere('value', 'adelanto')['amount'])->toBe(bcdiv(bcmul($terms['total'], '30', 4), '100', 2));

    $humantay = stepCart(stepSlug('CUS-HUM-FD'), stepDate(stepSlug('CUS-HUM-FD'), '2026-10-25'));
    expect(collect(stepPost($humantay, 'checkout/validate', [])->assertOk()->json('data.terms.modes'))->pluck('value')->all())->toBe(['total']);
});

it('SIT-BR-13 y SIT-BR-14: cada paso se valida por separado y la edad debe calzar con el tipo de pasajero', function () {
    $slug = stepSlug('CUS-PKG-5D4N');
    $token = stepCart($slug, stepDate($slug, '2026-10-25'));

    stepPost($token, 'checkout/validate', ['step' => 'comprador', ...stepBuyer(['doc_number' => '12'])])->assertStatus(422)->assertJsonValidationErrors(['doc_number']);
    stepPost($token, 'checkout/validate', ['step' => 'comprador', ...stepBuyer()])->assertOk()->assertJsonPath('data.valid', true);

    stepPost($token, 'checkout/validate', ['step' => 'pasajeros', 'passengers' => webTravelers(1)])->assertStatus(422)->assertJsonValidationErrors(['passengers']);
    expect(stepPost($token, 'checkout/validate', ['step' => 'pasajeros', 'passengers' => webTravelers(1, 1)]))->toBeApiError(422, 'SIT-BR-14');
    $twins = webTravelers(2);
    $twins[1]['doc_number'] = $twins[0]['doc_number'];
    expect(stepPost($token, 'checkout/validate', ['step' => 'pasajeros', 'passengers' => $twins]))->toBeApiError(422, 'SIT-BR-14');
    stepPost($token, 'checkout/validate', ['step' => 'pasajeros', 'passengers' => webTravelers(2)])->assertOk();

    stepPost($token, 'checkout/validate', ['step' => 'pago', 'pay_mode' => 'adelanto', 'method' => 'transferencia'])->assertStatus(422)->assertJsonValidationErrors(['operation_ref', 'terms', 'privacy']);
});

it('pago con adelanto y tarjeta aprobada: crea adelanto y saldo, cobra solo el adelanto, guarda pasajeros, recojo y comentarios, y confirma', function () {
    $slug = stepSlug('CUS-PKG-5D4N');
    $token = stepCart($slug, stepDate($slug, '2026-10-25'));

    $data = stepPost($token, 'checkout/orders', [
        ...stepBuyer(), 'passengers' => webTravelers(2), 'lines' => [['line' => 1, 'pickup_point' => '', 'pickup_address' => 'Hotel Tambo Real, Cusco', 'comments' => 'Uno de los viajeros es vegetariano.']],
        'pay_mode' => 'adelanto', 'method' => 'tarjeta', 'card_token' => 'tok_ok_1111', 'card_holder' => 'LUCIA BENAVIDES', 'terms' => true, 'privacy' => true,
    ])->assertCreated()->json('data');

    $order = withinTenant(tenantA(), fn () => DB::table('channel_ecom_orders')->where('code', $data['code'])->first());
    $reservation = withinTenant(tenantA(), fn () => DB::table('booking_reservations')->where('ecom_order_id', $order->id)->first());
    $receivables = withinTenant(tenantA(), fn () => DB::table('fin_receivables')->where('reservation_id', $reservation->id)->get()->keyBy('kind'));
    $snapshot = withinTenant(tenantA(), fn () => DB::table('booking_reservation_web_snapshots')->where('reservation_id', $reservation->id)->first());
    $attempt = withinTenant(tenantA(), fn () => DB::table('channel_ecom_payment_attempts')->where('order_id', $order->id)->first());

    expect($data['payment']['result'])->toBe('aprobado')
        ->and($order->status)->toBe('confirmado')
        ->and($order->pay_mode)->toBe('anticipo')
        ->and($order->balance_due_date)->not->toBeNull()
        ->and($receivables->keys()->sort()->values()->all())->toBe(['adelanto', 'saldo'])
        ->and($receivables['adelanto']->status)->toBe('pagada')
        ->and($receivables['saldo']->status)->toBe('abierta')
        ->and(bcadd((string) $receivables['adelanto']->amount, (string) $receivables['saldo']->amount, 2))->toBe(bcadd((string) $reservation->total_amount, '0', 2))
        ->and($reservation->status)->not->toBe('pendiente_pago')
        ->and($snapshot->payment_mode)->toBe('adelanto')
        ->and($snapshot->comments)->toBe('Uno de los viajeros es vegetariano.')
        ->and($attempt->card_masked)->toBe('•••• 1111')
        ->and(withinTenant(tenantA(), fn () => DB::table('channel_ecom_passengers')->where('order_id', $order->id)->count()))->toBe(2)
        ->and(withinTenant(tenantA(), fn () => DB::table('booking_passengers')->where('reservation_id', $reservation->id)->where('full_name', 'Viajero2 Prueba ADT')->exists()))->toBeTrue();
});

it('SIT-BR-16: una tarjeta rechazada deja el pedido con pago rechazado y se puede reintentar; luego se paga el saldo', function () {
    $slug = stepSlug('CUS-PKG-5D4N');
    $token = stepCart($slug, stepDate($slug, '2026-10-25'));
    $data = stepPost($token, 'checkout/orders', [...stepBuyer(), 'passengers' => webTravelers(2), 'pay_mode' => 'adelanto', 'method' => 'tarjeta', 'card_token' => 'tok_51_0002', 'card_holder' => 'LUCIA B', 'terms' => true, 'privacy' => true])->assertCreated()->json('data');
    $access = siteOf(extra: [...critical(), 'X-Order-Token' => $data['token']]);

    expect($data['payment']['result'])->toBe('rechazado');
    $order = $this->getJson("/api/v1/public/orders/{$data['code']}", $access)->assertOk()->json('data');
    expect($order['status'])->toBe('pago_rechazado')->and($order['attempts'][0]['code'])->toBe('51');

    $paid = $this->postJson("/api/v1/public/orders/{$data['code']}/payments", ['method' => 'tarjeta', 'card_token' => 'tok_ok_4444', 'card_holder' => 'LUCIA B'], $access)->assertOk()->json('data');
    expect($paid['payment']['result'])->toBe('aprobado')->and($paid['status'])->toBe('confirmado')->and((float) $paid['due'])->toBeGreaterThan(0);

    $balance = $this->postJson("/api/v1/public/orders/{$data['code']}/payments", ['method' => 'tarjeta', 'card_token' => 'tok_ok_4444', 'card_holder' => 'LUCIA B'], siteOf(extra: [...critical(), 'X-Order-Token' => $data['token']]))->assertOk()->json('data');
    expect($balance['due'])->toBe('0.00')
        ->and(collect($balance['reservations'][0]['receivables'])->pluck('status')->unique()->values()->all())->toBe(['pagada']);
});

it('SIT-BR-17: transferencia o Yape exigen número de operación, consumen los cupos y dejan el pago por validar', function () {
    $slug = stepSlug('CUS-HUM-FD');
    $token = stepCart($slug, stepDate($slug, '2026-10-05'));
    $data = stepPost($token, 'checkout/orders', [...stepBuyer(), 'passengers' => webTravelers(2), 'pay_mode' => 'total', 'method' => 'yape', 'operation_ref' => 'YP-889911', 'terms' => true, 'privacy' => true])->assertCreated()->json('data');

    $order = withinTenant(tenantA(), fn () => DB::table('channel_ecom_orders')->where('code', $data['code'])->first());
    $payment = withinTenant(tenantA(), fn () => DB::table('fin_payments')->where('reference', 'YP-889911')->first());
    $reservation = withinTenant(tenantA(), fn () => DB::table('booking_reservations')->where('ecom_order_id', $order->id)->first());

    expect($data['payment']['result'])->toBe('por_validar')
        ->and($order->status)->toBe('pago_por_validar')
        ->and($payment->status)->toBe('pendiente')
        ->and($reservation->status)->toBe('pendiente_pago')
        ->and(withinTenant(tenantA(), fn () => DB::table('catalog_availability_holds')->where('reference_id', $order->id)->value('status')))->toBe('confirmada')
        ->and($this->postJson("/api/v1/public/orders/{$data['code']}/payments", ['method' => 'tarjeta', 'card_token' => 'tok_ok_1111'], siteOf(extra: [...critical(), 'X-Order-Token' => $data['token']])))->toBeApiError(409);
});
