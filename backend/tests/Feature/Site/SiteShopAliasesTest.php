<?php

use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;

beforeEach(function () {
    $this->withoutMiddleware(ThrottleRequests::class);
    Queue::fake();
});

function shopSlug(): string
{
    return (string) withinTenant(tenantA(), fn () => DB::table('catalog_products')->where('code', 'CUS-HUM-FD')->value('slug'));
}

function shopDate(string $slug): string
{
    foreach (['2026-10', '2026-11', '2026-12'] as $month) {
        foreach (test()->getJson("/api/v1/public/products/{$slug}/calendar?mes={$month}&viajeros=2", siteOf())->assertOk()->json('data.days') as $day) {
            if ($day['sellable'] && $day['date'] >= '2026-10-25') {
                return $day['date'];
            }
        }
    }

    throw new RuntimeException('Sin fecha vendible');
}

it('SIT-BR-04: la consulta de disponibilidad dice si se puede vender, con cupos o el motivo', function () {
    $slug = shopSlug();
    $date = shopDate($slug);

    $ok = $this->postJson('/api/v1/public/availability', ['product' => $slug, 'date' => $date, 'pax' => 2], siteOf())->assertOk()->json('data');
    expect($ok['sellable'])->toBeTrue()->and($ok['reason'])->toBeNull()->and($ok['price'])->not->toBeNull();

    $past = $this->postJson('/api/v1/public/shop/availability', ['product' => $slug, 'date' => '2026-01-05', 'pax' => 2], siteOf())->assertOk()->json('data');
    expect($past['sellable'])->toBeFalse()->and($past['reason'])->not->toBeNull();

    $this->postJson('/api/v1/public/availability', ['product' => $slug, 'pax' => 0], siteOf())->assertStatus(422)->assertJsonValidationErrors(['date', 'pax']);
});

it('§6.3 (08): los alias de la tienda devuelven lo mismo que el sitio y crean el pedido con su pago', function () {
    $slug = shopSlug();
    $date = shopDate($slug);

    expect($this->getJson('/api/v1/public/shop/products', siteOf())->assertOk()->json('data.items'))->toBe($this->getJson('/api/v1/public/products', siteOf())->json('data.items'));
    $this->getJson("/api/v1/public/shop/products/{$slug}", siteOf())->assertOk()->assertJsonPath('data.product.slug', $slug);
    $price = $this->postJson('/api/v1/public/shop/price', ['product' => $slug, 'date' => $date, 'adults' => 2], siteOf())->assertOk()->json('data');
    expect($price)->toHaveKeys(['total', 'currency']);

    $order = $this->postJson('/api/v1/public/shop/orders', [
        'product' => $slug, 'date' => $date, 'adults' => 2,
        'name' => 'Pedro Lima Soto', 'email' => 'tienda.alias@viajes.pe', 'phone' => '+51 977 100 200', 'country' => 'Perú', 'doc_type' => 'DNI', 'doc_number' => '43211234', 'billing_type' => 'Boleta',
        'passengers' => webTravelers(2), 'terms' => true, 'privacy' => true, 'pay_mode' => 'total',
    ], siteOf(extra: critical()))->assertCreated()->json('data');
    $code = $order['code'];

    $this->getJson("/api/v1/public/shop/orders/{$code}", siteOf(extra: ['X-Order-Token' => $order['token']]))->assertOk()->assertJsonPath('data.status', 'pago_pendiente');
    $paid = $this->postJson("/api/v1/public/shop/orders/{$code}/payments", ['method' => 'tarjeta', 'card_token' => 'tok_ok_4242', 'card_holder' => 'PEDRO LIMA'], siteOf(extra: [...critical(), 'X-Order-Token' => $order['token']]))->assertOk()->json('data');
    expect($paid['status'])->toBe('confirmado');
});
