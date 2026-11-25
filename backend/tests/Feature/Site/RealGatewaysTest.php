<?php

use App\Domain\Integrations\Payments\Adapters\IzipayGateway;
use App\Domain\Integrations\Payments\Adapters\MercadoPagoGateway;
use App\Domain\Integrations\Payments\AgencyPaymentGateways;
use App\Domain\Integrations\Payments\GatewayAccount;
use Illuminate\Http\Client\Request;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;
use Illuminate\Testing\TestResponse;

beforeEach(function () {
    $this->withoutMiddleware(ThrottleRequests::class);
    Queue::fake();
    Http::preventStrayRequests();
});

const RG_CREDENTIALS = [
    'culqi' => ['public_key' => 'pk_test_kipu123', 'secret_key' => 'sk_test_kipu456'],
    'mercadopago' => ['public_key' => 'TEST-pub-kipu', 'access_token' => 'TEST-token-kipu', 'webhook_secret' => 'mp-secreto-kipu'],
    'izipay' => ['shop_id' => '12345678', 'password' => 'testpassword_kipu', 'public_key' => '12345678:testpublickey_kipu', 'hmac_key' => 'hmac-kipu'],
    'niubiz' => ['merchant_id' => '456879852', 'user' => 'integraciones@kipu.pe', 'password' => 'clave-niubiz'],
];

function rgHealthy(): void
{
    Http::fake([
        'api.culqi.com/v2/charges?limit=1' => Http::response(['data' => [], 'paging' => []]),
        'api.mercadopago.com/users/me' => Http::response(['id' => 1, 'nickname' => 'AGENCIA_TEST']),
        'api.micuentaweb.pe/api-payment/V4/Charge/SDKTest' => Http::response(['status' => 'SUCCESS', 'answer' => ['value' => 'kipucontrol']]),
        'apisandbox.vnforappstest.com/api.security/v1/security' => Http::response('eyJ.token.niubiz', 201),
    ]);
}

function rgConnect(string $provider, string $currency = 'PEN', array $extra = []): string
{
    actingAsSeed('U01');

    return (string) test()->postJson('/api/v1/finance/gateways', ['provider' => $provider, 'account_ref' => 'Comercio '.$provider.' '.Str::random(6), 'currency' => $currency, 'status' => 'activa', 'mode' => 'sandbox', 'credentials' => RG_CREDENTIALS[$provider], ...$extra], critical())->assertOk()->json('data.id');
}

function rgOrder(): array
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

    $order = test()->withCredentials()->withUnencryptedCookie('ah_cart', $cart)->postJson('/api/v1/public/checkout/orders', [
        'name' => 'Mateo Ríos Salas', 'email' => 'mateo.real@checkout.pe', 'phone' => '+51 966 333 444', 'country' => 'Perú', 'doc_type' => 'DNI', 'doc_number' => '47889900', 'billing_type' => 'Boleta',
        'passengers' => webTravelers(2), 'pay_mode' => 'total', 'method' => 'tarjeta', 'terms' => true, 'privacy' => true,
    ], siteOf(extra: critical()))->assertCreated()->json('data');

    expect($order['payment'])->toBeNull();

    return $order;
}

function rgHeaders(array $order): array
{
    return siteOf(extra: [...critical(), 'X-Order-Token' => $order['token']]);
}

function rgSession(array $order): array
{
    return test()->postJson("/api/v1/public/orders/{$order['code']}/payment-session", [], rgHeaders($order))->assertCreated()->json('data');
}

function rgPay(array $order, string $token, string $session): TestResponse
{
    return test()->postJson("/api/v1/public/orders/{$order['code']}/payments", ['method' => 'tarjeta', 'card_token' => $token, 'session_id' => $session], rgHeaders($order));
}

function rgOrderState(string $code): object
{
    return withinTenant(tenantA(), fn () => DB::table('channel_ecom_orders as o')->leftJoin('channel_ecom_payment_attempts as a', 'a.order_id', '=', 'o.id')->where('o.code', $code)->orderByDesc('a.attempted_at')->orderByDesc('a.id')->first(['o.status', 'o.currency', 'a.gateway_txn_id', 'a.card_masked', 'a.gateway_code', 'a.result']));
}

function rgWebhook(string $provider, string $account, string $raw, array $server = [], array $query = []): TestResponse
{
    $url = '/api/v1/webhooks/payments/'.$provider.'?'.http_build_query(['agencia' => tenantA()->subdomain, 'cuenta' => $account, ...$query]);

    return test()->call('POST', $url, [], [], [], ['CONTENT_TYPE' => 'application/json', 'HTTP_ACCEPT' => 'application/json', ...$server], $raw);
}

function rgDue(array $order): string
{
    return (string) withinTenant(tenantA(), fn () => DB::table('channel_ecom_orders')->where('code', $order['code'])->value('amount_due_now'));
}

it('Pasarelas: Culqi valida las llaves del modo, guarda las credenciales cifradas, prueba la conexión y muestra la URL del webhook', function () {
    Http::fake(['api.culqi.com/v2/charges*' => Http::sequence()->push(['data' => []])->push(['data' => []])->push(['object' => 'error', 'type' => 'authentication_error'], 401)]);
    actingAsSeed('U01');
    $payload = ['provider' => 'culqi', 'account_ref' => 'Culqi Andes', 'currency' => 'PEN', 'status' => 'activa', 'mode' => 'sandbox'];

    expect($this->postJson('/api/v1/finance/gateways', [...$payload, 'credentials' => ['public_key' => 'pk_live_x', 'secret_key' => 'sk_live_y']], critical()))->toBeApiError(422, 'VT-GATEWAY-MODE');
    expect($this->postJson('/api/v1/finance/gateways', [...$payload, 'credentials' => ['public_key' => 'pk_test_x']], critical()))->toBeApiError(422, 'VT-10');

    $id = rgConnect('culqi');
    $listed = collect($this->getJson('/api/v1/finance/gateways')->assertOk()->json('data.items'))->firstWhere('id', $id);
    $page = $this->getJson('/api/v1/finance/gateways')->json('data');

    expect($listed['connector'])->toBeTrue()
        ->and($listed['credentials_set'])->toBe(['public_key', 'secret_key'])
        ->and($listed['check']['status'])->toBe('ok')
        ->and($listed['webhook_url'])->toContain('/api/v1/webhooks/payments/culqi?agencia='.tenantA()->subdomain.'&cuenta='.$id)
        ->and(json_encode($listed))->not->toContain('sk_test_kipu456')
        ->and($page['active_connector'])->toBe($id)
        ->and(collect($page['connectors'])->pluck('provider')->all())->toBe(['izipay', 'culqi', 'niubiz', 'mercadopago']);
    Http::assertSent(fn (Request $request) => $request->url() === 'https://api.culqi.com/v2/charges?limit=1' && $request->hasHeader('Authorization', 'Bearer sk_test_kipu456'));

    $this->patchJson("/api/v1/finance/gateways/{$id}", ['credentials' => ['public_key' => 'pk_test_nueva']])->assertOk();
    $stored = withinTenant(tenantA(), fn () => app(AgencyPaymentGateways::class)->find($id));
    expect($stored->secrets)->toBe(['public_key' => 'pk_test_nueva', 'secret_key' => 'sk_test_kipu456']);

    $check = $this->postJson("/api/v1/finance/gateways/{$id}/test", [], critical())->assertOk()->json('data');
    expect($check['status'])->toBe('error')->and($check['message'])->toContain('llave secreta')
        ->and(withinTenant(tenantA(), fn () => DB::table('audit_events')->where(['entity' => 'Pasarela', 'entity_id' => $id, 'action' => 'probar_conexion'])->exists()))->toBeTrue();

    $paypal = withinTenant(tenantA(), fn () => DB::table('fin_gateway_accounts')->where('provider', 'paypal')->value('id'));
    expect($this->postJson("/api/v1/finance/gateways/{$paypal}/test", [], critical()))->toBeApiError(422, 'VT-GATEWAY-TEST');
});

it('Culqi: el checkout crea el pedido, abre la sesión con la llave pública y cobra el token por API; la sesión no se reutiliza', function () {
    rgHealthy();
    rgConnect('culqi');
    $order = rgOrder();
    $session = rgSession($order);

    expect($session['gateway'])->toBe('culqi')
        ->and($session['embed']['provider'])->toBe('culqi')
        ->and($session['embed']['public_key'])->toBe('pk_test_kipu123')
        ->and($session['embed']['amount'])->toBe((int) round((float) rgDue($order) * 100))
        ->and(json_encode($session))->not->toContain('sk_test');

    Http::fake(['api.culqi.com/v2/charges' => Http::response(['object' => 'charge', 'id' => 'chr_test_aprobado1', 'source' => ['card_number' => '411111******1111', 'last_four' => '1111'], 'outcome' => ['type' => 'venta_exitosa', 'code' => 'AUT0000'], 'reference_code' => 'R1'], 201)]);
    $paid = rgPay($order, 'tkn_test_abc123', $session['session_id'])->assertOk()->json('data');
    $state = rgOrderState($order['code']);

    expect($paid['payment']['result'])->toBe('aprobado')
        ->and($state->status)->toBe('confirmado')
        ->and($state->gateway_txn_id)->toBe('chr_test_aprobado1')
        ->and($state->card_masked)->toBe('•••• 1111');
    Http::assertSent(fn (Request $request) => $request->url() === 'https://api.culqi.com/v2/charges' && $request['source_id'] === 'tkn_test_abc123' && $request['amount'] === (int) round((float) rgDue($order) * 100) && $request['metadata']['reference'] === $order['code'] && $request['metadata']['scope'] === 'order');

    expect(rgPay($order, 'tkn_test_abc123', $session['session_id']))->toBeApiError(409);
    expect(rgPay($order, 'tok_ok_1111', $session['session_id']))->toBeApiError(409);
});

it('Culqi: un rechazo por fondos deja el pedido en pago_rechazado con el mensaje del banco y sin sesión no se cobra', function () {
    rgHealthy();
    rgConnect('culqi');
    $order = rgOrder();

    expect($this->postJson("/api/v1/public/orders/{$order['code']}/payments", ['method' => 'tarjeta', 'card_token' => 'tkn_test_abc123'], rgHeaders($order)))->toBeApiError(422, 'PAYMENT_SESSION_INVALID');

    Http::fake(['api.culqi.com/v2/charges' => Http::response(['object' => 'error', 'type' => 'card_error', 'code' => 'card_declined', 'decline_code' => 'insufficient_funds', 'user_message' => 'Su tarjeta no tiene fondos suficientes.'], 402)]);
    $data = rgPay($order, 'tkn_test_sinfondos', rgSession($order)['session_id'])->assertOk()->json('data');

    expect($data['payment']['result'])->toBe('rechazado')
        ->and($data['payment']['message'])->toContain('Fondos insuficientes')
        ->and($data['status'])->toBe('pago_rechazado')
        ->and(rgOrderState($order['code'])->gateway_code)->toBe('insufficient_funds');
});

it('Culqi: el webhook consulta el cargo con la llave secreta, confirma el pedido una sola vez y rechaza cuentas ajenas', function () {
    rgHealthy();
    $account = rgConnect('culqi');
    $order = rgOrder();
    $charge = 'chr_test_'.Str::random(10);
    Http::fake(["api.culqi.com/v2/charges/{$charge}" => Http::response(['object' => 'charge', 'id' => $charge, 'source' => ['card_number' => '511111******4444'], 'outcome' => ['type' => 'venta_exitosa'], 'metadata' => ['reference' => $order['code'], 'scope' => 'order', 'tenant_id' => (string) tenantA()->getKey()]])]);
    $raw = json_encode(['object' => 'event', 'type' => 'charge.creation.succeeded', 'data' => json_encode(['id' => $charge, 'object' => 'charge'])]);

    rgWebhook('culqi', $account, $raw)->assertOk()->assertJsonPath('data.result', 'aprobado');
    rgWebhook('culqi', $account, $raw)->assertOk()->assertJsonPath('data.result', 'duplicado');

    expect(rgOrderState($order['code'])->status)->toBe('confirmado')
        ->and(withinTenant(tenantA(), fn () => DB::table('channel_ecom_payment_attempts')->where('gateway_txn_id', $charge)->count()))->toBe(1);
    Http::assertSent(fn (Request $request) => $request->url() === "https://api.culqi.com/v2/charges/{$charge}" && $request->hasHeader('Authorization', 'Bearer sk_test_kipu456'));

    rgWebhook('culqi', (string) Str::uuid(), $raw)->assertNotFound();
    rgWebhook('mercadopago', $account, $raw)->assertNotFound();
    rgWebhook('culqi', $account, json_encode(['type' => 'charge.creation.succeeded', 'data' => ['id' => 'tkn_test_x']]))->assertOk()->assertJsonPath('data.result', 'ignorado');
});

it('Mercado Pago: cobra con el token del Brick, envía clave de idempotencia y traduce el rechazo', function () {
    rgHealthy();
    rgConnect('mercadopago', 'USD');
    $order = rgOrder();
    $session = rgSession($order);

    expect($session['embed']['provider'])->toBe('mercadopago')->and($session['embed']['public_key'])->toBe('TEST-pub-kipu');

    Http::fake(['api.mercadopago.com/v1/payments' => Http::sequence()
        ->push(['id' => 1311772470, 'status' => 'rejected', 'status_detail' => 'cc_rejected_insufficient_amount', 'card' => ['last_four_digits' => '0004']], 201)
        ->push(['id' => 1311772471, 'status' => 'approved', 'status_detail' => 'accredited', 'card' => ['last_four_digits' => '0004']], 201)]);
    $form = json_encode(['token' => 'ff8080814c11e237014c1ff593b57b4d', 'payment_method_id' => 'visa', 'issuer_id' => '310', 'installments' => 1, 'payer' => ['email' => 'mateo.real@checkout.pe', 'identification' => ['type' => 'DNI', 'number' => '47889900']]]);

    $declined = rgPay($order, $form, $session['session_id'])->assertOk()->json('data');
    expect($declined['payment']['result'])->toBe('rechazado')->and($declined['payment']['message'])->toContain('Fondos insuficientes');

    $paid = rgPay($order, $form, rgSession($order)['session_id'])->assertOk()->json('data');
    expect($paid['payment']['result'])->toBe('aprobado')
        ->and(rgOrderState($order['code'])->gateway_txn_id)->toBe('1311772471');
    Http::assertSent(fn (Request $request) => $request->url() === 'https://api.mercadopago.com/v1/payments' && $request->hasHeader('X-Idempotency-Key') && $request->hasHeader('Authorization', 'Bearer TEST-token-kipu') && $request['transaction_amount'] === (float) rgDue($order) && $request['external_reference'] === $order['code'] && $request['binary_mode'] === true);
});

it('Mercado Pago: el webhook valida x-signature con la clave secreta y consulta el pago; una firma falsa responde 401', function () {
    rgHealthy();
    $account = rgConnect('mercadopago', 'USD');
    $order = rgOrder();
    $paymentId = (string) random_int(100000000, 999999999);
    Http::fake(["api.mercadopago.com/v1/payments/{$paymentId}" => Http::response(['id' => (int) $paymentId, 'status' => 'approved', 'status_detail' => 'accredited', 'external_reference' => $order['code'], 'metadata' => ['reference' => $order['code'], 'scope' => 'order'], 'card' => ['last_four_digits' => '4444']])]);
    $raw = json_encode(['action' => 'payment.updated', 'api_version' => 'v1', 'data' => ['id' => $paymentId], 'type' => 'payment', 'live_mode' => false]);
    $ts = (string) now()->getTimestamp();
    $requestId = (string) Str::uuid();
    $v1 = hash_hmac('sha256', MercadoPagoGateway::manifest($paymentId, $requestId, $ts), 'mp-secreto-kipu');

    expect(rgWebhook('mercadopago', $account, $raw, ['HTTP_X_SIGNATURE' => "ts={$ts},v1=".str_repeat('0', 64), 'HTTP_X_REQUEST_ID' => $requestId], ['data.id' => $paymentId, 'type' => 'payment']))->toBeApiError(401, 'WEBHOOK_SIGNATURE_INVALID');

    rgWebhook('mercadopago', $account, $raw, ['HTTP_X_SIGNATURE' => "ts={$ts},v1={$v1}", 'HTTP_X_REQUEST_ID' => $requestId], ['data.id' => $paymentId, 'type' => 'payment'])->assertOk()->assertJsonPath('data.result', 'aprobado');

    expect(rgOrderState($order['code'])->status)->toBe('confirmado')
        ->and(rgOrderState($order['code'])->card_masked)->toBe('•••• 4444');
    expect(MercadoPagoGateway::manifest('', '', '1704908010'))->toBe('ts:1704908010;');
});

it('Izipay: la sesión pide el formToken y el cobro valida kr-hash, el pedido y el monto antes de aprobar', function () {
    rgHealthy();
    rgConnect('izipay');
    $order = rgOrder();
    Http::fake(['api.micuentaweb.pe/api-payment/V4/Charge/CreatePayment' => Http::response(['status' => 'SUCCESS', 'answer' => ['formToken' => 'DEMO-TOKEN-'.Str::random(40)]])]);
    $session = rgSession($order);
    $cents = (int) round((float) rgDue($order) * 100);

    expect($session['embed']['form_token'])->toStartWith('DEMO-TOKEN-')
        ->and($session['embed']['public_key'])->toBe('12345678:testpublickey_kipu')
        ->and($session['embed']['script'])->toContain('static.micuentaweb.pe');
    Http::assertSent(fn (Request $request) => str_ends_with($request->url(), '/Charge/CreatePayment') && $request['amount'] === $cents && $request['orderId'] === $order['code'] && $request->hasHeader('Authorization', 'Basic '.base64_encode('12345678:testpassword_kipu')));

    $answer = fn (int $amount, string $status = 'PAID') => json_encode(['orderStatus' => $status, 'orderDetails' => ['orderId' => $order['code'], 'orderTotalAmount' => $amount, 'orderCurrency' => rgOrderState($order['code'])->currency], 'transactions' => [['uuid' => 'a1b2c3d4e5f6', 'detailedStatus' => 'AUTHORISED', 'transactionDetails' => ['cardDetails' => ['pan' => '497010XXXXXX0055']]]]]);
    $token = fn (string $raw, string $key = 'hmac-kipu') => json_encode(['kr-answer' => $raw, 'kr-hash' => IzipayGateway::sign($raw, $key), 'kr-hash-key' => 'sha256_hmac']);

    $forged = rgPay($order, $token($answer($cents), 'otra-clave'), $session['session_id'])->assertOk()->json('data');
    expect($forged['payment']['result'])->toBe('rechazado')->and(rgOrderState($order['code'])->gateway_code)->toBe('firma');

    $cheap = rgPay($order, $token($answer(100)), rgSession($order)['session_id'])->assertOk()->json('data');
    expect($cheap['payment']['result'])->toBe('rechazado')->and(rgOrderState($order['code'])->gateway_code)->toBe('no_coincide');

    $paid = rgPay($order, $token($answer($cents)), rgSession($order)['session_id'])->assertOk()->json('data');
    expect($paid['payment']['result'])->toBe('aprobado')
        ->and(rgOrderState($order['code'])->gateway_txn_id)->toBe('a1b2c3d4e5f6')
        ->and(rgOrderState($order['code'])->card_masked)->toBe('•••• 0055');
});

it('Izipay: la IPN se firma con la contraseña; la válida confirma el pedido y la falsa responde 401', function () {
    rgHealthy();
    $account = rgConnect('izipay');
    $order = rgOrder();
    $uuid = Str::lower(Str::random(32));
    $raw = json_encode(['orderStatus' => 'PAID', 'orderDetails' => ['orderId' => $order['code']], 'transactions' => [['uuid' => $uuid, 'metadata' => ['reference' => $order['code'], 'scope' => 'order'], 'transactionDetails' => ['cardDetails' => ['pan' => '497010XXXXXX0055']]]]]);
    $ipn = fn (string $key) => test()->call('POST', '/api/v1/webhooks/payments/izipay?'.http_build_query(['agencia' => tenantA()->subdomain, 'cuenta' => $account]), ['kr-answer' => $raw, 'kr-hash' => IzipayGateway::sign($raw, $key), 'kr-hash-key' => 'password', 'kr-answer-type' => 'V4/Payment'], [], [], ['HTTP_ACCEPT' => 'application/json']);

    expect($ipn('hmac-kipu'))->toBeApiError(401, 'WEBHOOK_SIGNATURE_INVALID');
    $ipn('testpassword_kipu')->assertOk()->assertJsonPath('data.result', 'aprobado');

    expect(rgOrderState($order['code'])->status)->toBe('confirmado')->and(rgOrderState($order['code'])->gateway_txn_id)->toBe($uuid);
});

it('Niubiz: la sesión usa el token de seguridad, la autorización 000 aprueba y el 116 se informa como fondos insuficientes', function () {
    rgHealthy();
    $account = rgConnect('niubiz');
    $order = rgOrder();
    Http::fake([
        'apisandbox.vnforappstest.com/api.ecommerce/*' => Http::response(['sessionKey' => str_repeat('a', 64), 'expirationTime' => 1700000000000]),
        'apisandbox.vnforappstest.com/api.authorization/v3/authorization/*' => Http::sequence()
            ->push(['errorCode' => 400, 'errorMessage' => 'Denegado', 'data' => ['ACTION_CODE' => '116', 'ACTION_DESCRIPTION' => 'Fondos insuficientes', 'CARD' => '455788******1234']], 400)
            ->push(['order' => ['transactionId' => '991234567890123'], 'dataMap' => ['ACTION_CODE' => '000', 'STATUS' => 'Authorized', 'TRANSACTION_ID' => '991234567890123', 'TRANSACTION_DATE' => '261125103015', 'CARD' => '455788******1234', 'BRAND' => 'visa']]),
    ]);
    $session = rgSession($order);

    expect($session['embed']['session_key'])->toHaveLength(64)
        ->and($session['embed']['merchant_id'])->toBe('456879852')
        ->and($session['embed']['purchase_number'])->toMatch('/^\d{12}$/')
        ->and($session['embed']['script'])->toContain('static-content-qas.vnforapps.com');
    Http::assertSent(fn (Request $request) => str_contains($request->url(), '/token/session/456879852') && $request->hasHeader('Authorization', 'eyJ.token.niubiz') && $request['channel'] === 'web');

    $declined = rgPay($order, str_repeat('T', 32), $session['session_id'])->assertOk()->json('data');
    expect($declined['payment']['message'])->toContain('Fondos insuficientes');

    $second = rgSession($order);
    $paid = rgPay($order, str_repeat('U', 32), $second['session_id'])->assertOk()->json('data');
    expect($paid['payment']['result'])->toBe('aprobado')
        ->and(rgOrderState($order['code'])->gateway_txn_id)->toBe($second['embed']['purchase_number'].'-261125103015');

    rgWebhook('niubiz', $account, '{}')->assertOk()->assertJsonPath('data.result', 'ignorado');
});

it('reembolsos y anulaciones: cada adaptador llama a su API con el monto y la referencia del cobro', function () {
    Http::fake([
        'api.culqi.com/v2/refunds' => Http::response(['object' => 'refund', 'id' => 'ref_test_1'], 201),
        'api.mercadopago.com/v1/payments/1311772471/refunds' => Http::response(['id' => 77, 'status' => 'approved', 'amount' => 50], 201),
        'api.micuentaweb.pe/api-payment/V4/Transaction/CancelOrRefund' => Http::response(['status' => 'SUCCESS', 'answer' => ['uuid' => 'ref-uuid', 'detailedStatus' => 'CANCELLED']]),
        'apisandbox.vnforappstest.com/api.security/v1/security' => Http::response('eyJ.token.niubiz', 201),
        'apisandbox.vnforappstest.com/api.authorization/v3/reverse/*' => Http::response(['order' => ['transactionId' => '991234567890123'], 'dataMap' => ['STATUS' => 'Voided', 'ACTION_CODE' => '000']]),
    ]);
    $gateways = app(AgencyPaymentGateways::class);
    $connector = fn (string $provider) => $gateways->connector(new GatewayAccount((string) Str::uuid(), (string) tenantA()->getKey(), $provider, 'sandbox', 'PEN', RG_CREDENTIALS[$provider]));

    expect($connector('culqi')->refund('chr_test_1', '50.00', 'PEN', 'cliente')->externalId)->toBe('ref_test_1')
        ->and($connector('mercadopago')->refund('1311772471', '50.00', 'PEN', 'cliente')->status)->toBe('reembolsado')
        ->and($connector('izipay')->refund('a1b2c3', '50.00', 'PEN', 'cliente')->ok)->toBeTrue()
        ->and($connector('niubiz')->refund('261125000001-261125103015', '50.00', 'PEN', 'cliente')->ok)->toBeTrue()
        ->and($connector('niubiz')->refund('sin-fecha', '50.00', 'PEN', 'cliente')->ok)->toBeFalse();

    Http::assertSent(fn (Request $request) => $request->url() === 'https://api.culqi.com/v2/refunds' && $request['amount'] === 5000 && $request['charge_id'] === 'chr_test_1');
    Http::assertSent(fn (Request $request) => str_ends_with($request->url(), '/CancelOrRefund') && $request['uuid'] === 'a1b2c3' && $request['amount'] === 5000);
    Http::assertSent(fn (Request $request) => str_contains($request->url(), '/reverse/ecommerce/456879852') && $request['order']['purchaseNumber'] === '261125000001' && $request['order']['transactionDate'] === '261125103015');
});

it('una pasarela caída responde como transitoria y no confirma el pedido', function () {
    rgHealthy();
    rgConnect('culqi');
    $order = rgOrder();
    $session = rgSession($order);
    Http::fake(['api.culqi.com/v2/charges' => Http::response(['error' => 'down'], 503)]);

    $data = rgPay($order, 'tkn_test_caida', $session['session_id'])->assertOk()->json('data');
    expect($data['payment']['result'])->toBe('rechazado')->and($data['payment']['message'])->toContain('no respondió');
});

it('el sitio informa la pasarela activa y sus dominios para la CSP sin exponer llaves', function () {
    rgHealthy();
    $info = $this->getJson('/api/v1/public/payment-gateway', siteOf())->assertOk()->json('data');
    expect($info['provider'])->toBe('sandbox')->and($info['embedded'])->toBeFalse();

    rgConnect('mercadopago');
    $info = $this->getJson('/api/v1/public/payment-gateway', siteOf())->assertOk()->json('data');

    expect($info['provider'])->toBe('mercadopago')
        ->and($info['embedded'])->toBeTrue()
        ->and($info['sources']['script'])->toContain('https://sdk.mercadopago.com')
        ->and(json_encode($info))->not->toContain('TEST-token-kipu');
});

it('tarjeta de regalo y link de pago: abren su sesión y cobran por la pasarela de la agencia', function () {
    rgHealthy();
    rgConnect('culqi', 'USD');
    Http::fake(['api.culqi.com/v2/charges' => Http::sequence()
        ->push(['object' => 'charge', 'id' => 'chr_test_vale', 'source' => ['card_number' => '411111******1111']], 201)
        ->push(['object' => 'charge', 'id' => 'chr_test_link', 'source' => ['card_number' => '411111******1111']], 201)]);

    $session = $this->postJson('/api/v1/public/gift-cards/payment-session', ['amount' => '150.00', 'currency' => 'PEN', 'buyer_email' => 'mateo@example.com'], siteOf(extra: critical()))->assertCreated()->json('data');
    expect($session['embed']['provider'])->toBe('culqi')->and($session['embed']['amount'])->toBe(15000);

    $bought = $this->postJson('/api/v1/public/gift-cards', ['amount' => '150.00', 'currency' => 'PEN', 'buyer_name' => 'Mateo Ríos', 'buyer_email' => 'mateo@example.com', 'card_token' => 'tkn_test_vale', 'session_id' => $session['session_id']], siteOf(extra: critical()))->assertOk()->json('data');
    expect($bought['redeem_code'])->not->toBeEmpty();
    Http::assertSent(fn (Request $request) => $request->url() === 'https://api.culqi.com/v2/charges' && $request['metadata']['scope'] === 'gift_card' && str_starts_with($request['metadata']['reference'], 'VALE-'));

    actingAsSeed('U07');
    $link = $this->postJson('/api/v1/finance/payment-links', ['receivable_id' => 'CXC-00714', 'amount' => '100.00', 'methods' => ['card'], 'installments_max' => 1], critical())->assertCreated()->json('data');
    $token = (string) substr((string) $link['url'], strrpos((string) $link['url'], '/') + 1);
    $linkSession = $this->postJson("/api/v1/public/pay/{$token}/payment-session", ['email' => 'cliente@example.com'], siteOf(extra: critical()))->assertCreated()->json('data');

    $paid = $this->postJson("/api/v1/public/pay/{$token}/checkout", ['method' => 'card', 'card_token' => 'tkn_test_link', 'session_id' => $linkSession['session_id'], 'email' => 'cliente@example.com'], siteOf(extra: critical()))->assertOk()->json('data');
    expect($paid['result'])->toBe('aprobado')
        ->and(withinTenant(tenantA(), fn () => DB::table('fin_payment_links')->where('code', $link['code'])->value('status')))->toBe('pagado');
});

it('en producción sin conector real el cobro con tarjeta no está disponible; con una cuenta conectada sí', function () {
    rgHealthy();
    config(['integrations.require_real' => true]);
    $body = ['amount' => '80.00', 'currency' => 'PEN', 'buyer_email' => 'mateo@example.com'];

    expect($this->postJson('/api/v1/public/gift-cards/payment-session', $body, siteOf(extra: critical())))->toBeApiError(409, 'PAYMENT_GATEWAY_UNAVAILABLE');

    rgConnect('culqi');
    $this->postJson('/api/v1/public/gift-cards/payment-session', $body, siteOf(extra: critical()))->assertCreated()->assertJsonPath('data.gateway', 'culqi');
});

it('portal del cliente: abre la sesión de su cuota con la pasarela de la agencia y la paga con el token', function () {
    rgHealthy();
    rgConnect('culqi', 'USD');
    Http::fake(['api.culqi.com/v2/charges' => Http::response(['object' => 'charge', 'id' => 'chr_test_portal', 'source' => ['card_number' => '411111******4242']], 201)]);
    actingAsSeed('U14');
    $code = (string) withinTenant(tenantA(), fn () => DB::table('booking_reservations')->where('client_id', DB::table('iam_users')->where('code', 'U14')->value('client_id'))->where('travel_from', '>', BUSINESS_TODAY)->whereNotIn('status', ['cancelada', 'borrador'])->orderBy('travel_from')->value('code'));
    $open = collect($this->getJson("/api/v1/portal/client/reservations/{$code}/web-summary")->assertOk()->json('data.receivables'))->firstWhere('can_pay', true);

    expect($this->getJson('/api/v1/portal/client/payment-gateway')->assertOk()->json('data.provider'))->toBe('culqi');

    $session = $this->postJson("/api/v1/portal/client/receivables/{$open['code']}/payment-session", [], critical())->assertCreated()->json('data');
    expect($session['embed']['provider'])->toBe('culqi')->and($session['receivable'])->toBe($open['code']);

    $paid = $this->postJson("/api/v1/portal/client/receivables/{$open['code']}/payments", ['method' => 'tarjeta', 'card_token' => 'tkn_test_portal', 'session_id' => $session['session_id']], critical())->assertOk()->json('data');
    expect($paid['result'])->toBe('aprobado');
    Http::assertSent(fn (Request $request) => $request->url() === 'https://api.culqi.com/v2/charges' && $request['metadata']['scope'] === 'receivable' && $request['metadata']['reference'] === $open['code']);

    actingAsSeed('U15');
    expect($this->postJson("/api/v1/portal/client/receivables/{$open['code']}/payment-session", [], critical()))->toBeApiError(403, 'PORTAL_CUSTOMER_ONLY');
});
