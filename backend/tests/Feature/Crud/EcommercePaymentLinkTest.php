<?php

use App\Jobs\SendPlainMail;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;

beforeEach(function () {
    $this->withoutMiddleware(ThrottleRequests::class);
    Queue::fake();
});

function linkOrder(string $email, array $payment): array
{
    $slug = (string) withinTenant(tenantA(), fn () => DB::table('catalog_products')->where('code', 'CUS-HUM-FD')->value('slug'));
    $date = null;
    foreach (['2026-10', '2026-11', '2026-12'] as $month) {
        foreach (test()->getJson("/api/v1/public/products/{$slug}/calendar?mes={$month}&viajeros=2", siteOf())->assertOk()->json('data.days') as $day) {
            if ($day['sellable'] && $day['date'] >= '2026-10-25') {
                $date = $day['date'];
                break 2;
            }
        }
    }
    $token = (string) test()->postJson('/api/v1/public/carts/current/items', ['product' => $slug, 'date' => $date, 'adults' => 2], siteOf(extra: critical()))->assertCreated()->json('data.token');

    return test()->withCredentials()->withUnencryptedCookie('ah_cart', $token)->postJson('/api/v1/public/checkout/orders', [
        'name' => 'Mario Salas Vega', 'email' => $email, 'phone' => '+51 966 300 400', 'country' => 'Perú', 'doc_type' => 'DNI', 'doc_number' => '40998877', 'billing_type' => 'Boleta',
        'passengers' => webTravelers(2), 'terms' => true, 'privacy' => true, 'pay_mode' => 'total', ...$payment,
    ], siteOf(extra: critical()))->assertCreated()->json('data');
}

it('ECO-BR-14: el detalle del pedido web muestra los intentos de pago y se envía un enlace de pago que abre el pedido', function () {
    $order = linkOrder('enlace.pago@viajes.pe', ['method' => 'tarjeta', 'card_token' => 'tok_51_0002', 'card_holder' => 'MARIO SALAS']);
    $code = $order['code'];
    actingAsSeed('U01');

    $detail = $this->getJson("/api/v1/channels/ecommerce/orders/{$order['code']}")->assertOk()->json('data');
    expect($detail['status'])->toBe('pago_rechazado')->and($detail['can_send_link'])->toBeTrue()
        ->and($detail['attempts'][0]['result'])->toBe('rechazado')->and($detail['attempts'][0]['code'])->toBe('51')
        ->and($detail['passengers'])->toHaveCount(2)->and($detail['reservations'])->not->toBeEmpty();

    $sent = $this->postJson("/api/v1/channels/ecommerce/orders/{$code}/payment-link", ['note' => 'Puedes pagar con otra tarjeta.'], critical())->assertOk()->json('data');
    expect($sent['sent_to'])->toBe('enlace.pago@viajes.pe');

    $link = null;
    Queue::assertPushed(SendPlainMail::class, function (SendPlainMail $mail) use (&$link): bool {
        if (preg_match('#/confirmacion/[^/]+/acceso\?token=(p\.[0-9-]+\.[a-f0-9]{64})#', $mail->body, $match)) {
            $link = $match[1];
        }

        return true;
    });
    expect($link)->not->toBeNull();

    $this->getJson("/api/v1/public/orders/{$order['code']}", siteOf(extra: ['X-Order-Token' => (string) $link]))->assertOk()->assertJsonPath('data.code', $order['code']);
    $this->getJson("/api/v1/public/orders/{$order['code']}", siteOf(extra: ['X-Order-Token' => 'p.2099-01-01.'.str_repeat('a', 64)]))->assertNotFound();

    $listed = collect($this->getJson('/api/v1/channels/ecommerce/orders?status=pago_rechazado')->assertOk()->json('data'))->firstWhere('code', $order['code']);
    expect($listed['links'])->toHaveCount(1);
    $this->getJson('/api/v1/channels/ecommerce/summary')->assertOk()->assertJsonStructure(['data' => ['kpis', 'funnel']]);
    $this->getJson('/api/v1/channels/ecommerce/products')->assertOk();
});

it('ECO-BR-14: no se envía el enlace a un pedido pagado', function () {
    $order = linkOrder('ya.pago@viajes.pe', ['method' => 'tarjeta', 'card_token' => 'tok_ok_1111', 'card_holder' => 'MARIO SALAS']);
    $code = $order['code'];
    actingAsSeed('U01');

    expect($this->postJson("/api/v1/channels/ecommerce/orders/{$code}/payment-link", [], critical()))->toBeApiError(409, 'ECO-BR-14');
    expect($this->getJson('/api/v1/channels/ecommerce/orders/WEB-NO-EXISTE'))->toBeApiError(404);
});
