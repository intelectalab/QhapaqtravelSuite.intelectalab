<?php

use App\Domain\Integrations\Fake\FakePaymentGateway;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use Illuminate\Testing\TestResponse;

beforeEach(function () {
    $this->withoutMiddleware(ThrottleRequests::class);
    Queue::fake();
});

function gatewayOrder(): array
{
    $slug = (string) withinTenant(tenantA(), fn () => DB::table('catalog_products')->where('code', 'CUS-PKG-5D4N')->value('slug'));
    $date = null;
    foreach (['2026-11', '2026-12', '2027-01'] as $month) {
        foreach (test()->getJson("/api/v1/public/products/{$slug}/calendar?mes={$month}&viajeros=2", siteOf())->assertOk()->json('data.days') as $day) {
            if ($day['sellable']) {
                $date ??= $day['date'];
            }
        }
    }
    $cart = (string) test()->postJson('/api/v1/public/carts/current/items', ['product' => $slug, 'date' => $date, 'adults' => 2], siteOf(extra: critical()))->assertCreated()->json('data.token');

    return test()->withCredentials()->withUnencryptedCookie('ah_cart', $cart)->postJson('/api/v1/public/checkout/orders', [
        'name' => 'Mateo Ríos Salas', 'email' => 'mateo.gateway@checkout.pe', 'phone' => '+51 966 333 444', 'country' => 'Perú', 'doc_type' => 'DNI', 'doc_number' => '47889900', 'billing_type' => 'Boleta',
        'passengers' => webTravelers(2), 'pay_mode' => 'total', 'terms' => true, 'privacy' => true,
    ], siteOf(extra: critical()))->assertCreated()->json('data');
}

function webhookPost(array $event, ?string $signature = null): TestResponse
{
    $raw = json_encode($event);

    return test()->call('POST', '/api/v1/webhooks/payments/sandbox', [], [], [], ['CONTENT_TYPE' => 'application/json', 'HTTP_ACCEPT' => 'application/json', 'HTTP_X_GATEWAY_SIGNATURE' => $signature ?? FakePaymentGateway::sign($raw)], $raw);
}

it('F2-WEB-08: la sesión de pago se crea con el monto pendiente y el cobro con esa sesión confirma el pedido por la interfaz PaymentGateway', function () {
    $order = gatewayOrder();
    $headers = siteOf(extra: [...critical(), 'X-Order-Token' => $order['token']]);

    $session = $this->postJson("/api/v1/public/orders/{$order['code']}/payment-session", [], $headers)->assertCreated()->json('data');
    expect($session['gateway_session'])->toStartWith('SBX-SES-')->and($session['gateway'])->toBe('fake')->and((float) $session['amount'])->toBeGreaterThan(0);

    $paid = $this->postJson("/api/v1/public/orders/{$order['code']}/payments", ['method' => 'tarjeta', 'card_token' => 'tok_ok_1111', 'card_holder' => 'MATEO RIOS', 'session_id' => $session['session_id']], siteOf(extra: [...critical(), 'X-Order-Token' => $order['token']]))->assertOk()->json('data');
    $attempt = withinTenant(tenantA(), fn () => DB::table('channel_ecom_payment_attempts as a')->join('channel_ecom_orders as o', 'o.id', '=', 'a.order_id')->where('o.code', $order['code'])->first(['a.*', 'o.status as order_status']));

    expect($paid['payment']['result'])->toBe('aprobado')
        ->and($attempt->gateway_txn_id)->toStartWith('SBX-')
        ->and($attempt->card_masked)->toBe('•••• 1111')
        ->and($attempt->order_status)->toBe('confirmado');

    $event = ['id' => 'evt_'.uniqid(), 'type' => 'payment.approved', 'data' => ['tenant_id' => (string) tenantA()->getKey(), 'reference' => $order['code'], 'txn_id' => $attempt->gateway_txn_id, 'masked' => '•••• 1111']];
    webhookPost($event)->assertOk()->assertJsonPath('data.result', 'duplicado');
    webhookPost($event)->assertOk()->assertJsonPath('data.result', 'duplicado');
    expect(withinTenant(tenantA(), fn () => DB::table('channel_ecom_payment_attempts')->where('gateway_txn_id', $attempt->gateway_txn_id)->count()))->toBe(1);
});

it('una sesión de otro pedido no sirve y un rechazo del sandbox (código 51) deja el pedido en pago_rechazado', function () {
    $order = gatewayOrder();
    $headers = fn () => siteOf(extra: [...critical(), 'X-Order-Token' => $order['token']]);

    expect($this->postJson("/api/v1/public/orders/{$order['code']}/payments", ['method' => 'tarjeta', 'card_token' => 'tok_ok_1111', 'session_id' => 'SBX-SES-INEXISTENTE'], $headers()))->toBeApiError(422, 'PAYMENT_SESSION_INVALID');

    $data = $this->postJson("/api/v1/public/orders/{$order['code']}/payments", ['method' => 'tarjeta', 'card_token' => 'tok_51_0002'], $headers())->assertOk()->json('data');
    expect($data['payment']['result'])->toBe('rechazado')
        ->and($data['status'])->toBe('pago_rechazado')
        ->and($data['attempts'][0]['code'])->toBe('51');
});

it('el webhook verifica la firma HMAC, aplica el cobro aprobado una sola vez y registra el contracargo', function () {
    $order = gatewayOrder();
    $event = ['id' => 'evt_'.uniqid(), 'type' => 'payment.approved', 'data' => ['tenant_id' => (string) tenantA()->getKey(), 'reference' => $order['code'], 'txn_id' => 'SBX-WEBHOOK01', 'masked' => '•••• 4444', 'three_ds' => 'autenticado']];

    expect(webhookPost($event, 'firma-falsa'))->toBeApiError(401, 'WEBHOOK_SIGNATURE_INVALID');
    $this->call('POST', '/api/v1/webhooks/payments/otra-pasarela', [], [], [], ['CONTENT_TYPE' => 'application/json', 'HTTP_ACCEPT' => 'application/json'], '{}')->assertNotFound();

    webhookPost($event)->assertOk()->assertJsonPath('data.result', 'aprobado');
    webhookPost($event)->assertOk()->assertJsonPath('data.result', 'duplicado');
    webhookPost([...$event, 'id' => 'evt_'.uniqid()])->assertOk()->assertJsonPath('data.result', 'duplicado');

    expect(withinTenant(tenantA(), fn () => DB::table('channel_ecom_orders')->where('code', $order['code'])->value('status')))->toBe('confirmado')
        ->and(withinTenant(tenantA(), fn () => DB::table('channel_ecom_payment_attempts')->where('gateway_txn_id', 'SBX-WEBHOOK01')->count()))->toBe(1);

    webhookPost(['id' => 'evt_'.uniqid(), 'type' => 'payment.chargeback', 'data' => ['tenant_id' => (string) tenantA()->getKey(), 'reference' => $order['code'], 'txn_id' => 'SBX-WEBHOOK01']])->assertOk()->assertJsonPath('data.result', 'contracargo_registrado');
    expect(withinTenant(tenantA(), fn () => DB::table('audit_events')->where(['entity' => 'Pedido web', 'entity_id' => $order['code'], 'action' => 'contracargo'])->exists()))->toBeTrue();
});
