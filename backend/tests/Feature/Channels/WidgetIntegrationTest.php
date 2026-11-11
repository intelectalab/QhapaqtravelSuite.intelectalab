<?php

use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;

beforeEach(function () {
    $this->withoutMiddleware(ThrottleRequests::class);
    Queue::fake();
});

function widgetKey(): string
{
    return (string) withinTenant(tenantA(), fn () => DB::table('channel_widget_config')->value('public_key'));
}

function widgetProduct(): object
{
    return withinTenant(tenantA(), fn () => DB::table('catalog_products as p')
        ->join('catalog_product_channels as c', fn ($join) => $join->on('c.product_id', '=', 'p.id')->where('c.channel', 'ecommerce')->where('c.is_published', true))
        ->where('p.code', 'CUS-PKG-5D4N')->first(['p.code', 'p.slug']));
}

function widgetDate(string $slug): string
{
    foreach (['2026-11', '2026-12', '2027-01'] as $month) {
        foreach (test()->getJson("/api/v1/public/products/{$slug}/calendar?mes={$month}&viajeros=2", siteOf())->assertOk()->json('data.days') as $day) {
            if ($day['sellable']) {
                return $day['date'];
            }
        }
    }

    throw new RuntimeException('Sin fecha vendible');
}

it('WG-01: la configuración pública del widget se resuelve con la clave pública y devuelve producto, valores y dominios verificados', function () {
    $product = widgetProduct();

    $data = $this->getJson("/api/v1/public/widget/config?product={$product->code}", ['X-KipuControl-Key' => widgetKey()])->assertOk()->json('data');

    expect($data['agency']['subdomain'])->toBe('andes')
        ->and($data['product']['slug'])->toBe($product->slug)
        ->and($data['domains'])->not->toBeEmpty()
        ->and($data['site_url'])->toEndWith('/sitio/andes')
        ->and($data['products'])->not->toBeEmpty();

    $this->getJson('/api/v1/public/widget/config', ['X-KipuControl-Key' => 'pk_live_no_existe'])->assertStatus(401);
});

it('el traspaso del widget crea la selección y el carrito la toma una sola vez; al comprar queda convertida', function () {
    $product = widgetProduct();
    $date = widgetDate($product->slug);
    $headers = ['X-KipuControl-Key' => widgetKey(), ...critical()];

    $handoff = $this->postJson('/api/v1/public/widget-handoffs', ['product' => $product->code, 'date' => $date, 'adults' => 2, 'lang' => 'es', 'currency' => 'USD', 'origin' => 'https://blog.andeshorizonte.pe/tours'], $headers)
        ->assertCreated()->json('data');

    expect($handoff['code'])->toStartWith('WHO-')->and($handoff['checkout_url'])->toEndWith("/carrito/widget/{$handoff['code']}");
    $row = withinTenant(tenantA(), fn () => DB::table('channel_widget_handoffs')->where('code', $handoff['code'])->first());
    expect($row->status)->toBe('pendiente')->and($row->origin_domain)->toBe('blog.andeshorizonte.pe')->and($row->currency_display)->toBe('USD');

    $cart = $this->postJson('/api/v1/public/carts', ['handoff' => $handoff['code']], siteOf(extra: critical()))->assertCreated()->json('data');
    expect($cart['token'])->toBeString()->and($cart['cart']['items'])->toHaveCount(1);
    $row = withinTenant(tenantA(), fn () => DB::table('channel_widget_handoffs')->where('code', $handoff['code'])->first());
    expect($row->status)->toBe('en_carrito')->and($row->cart_id)->not->toBeNull()
        ->and(withinTenant(tenantA(), fn () => DB::table('channel_web_cart_items')->where('cart_id', $row->cart_id)->value('source')))->toBe('widget');

    expect($this->postJson('/api/v1/public/carts', ['handoff' => $handoff['code']], siteOf(extra: critical())))->toBeApiError(409, 'WG-HANDOFF-USED');

    $this->withCredentials()->withUnencryptedCookie('ah_cart', $cart['token'])->postJson('/api/v1/public/checkout/orders', [
        'name' => 'Lucía Benavides Ortiz', 'email' => 'lucia.widget@checkout.pe', 'phone' => '+51 944 222 333', 'country' => 'Perú', 'doc_type' => 'DNI', 'doc_number' => '41236587', 'billing_type' => 'Boleta',
        'passengers' => webTravelers(2), 'pay_mode' => 'total', 'method' => 'transferencia', 'operation_ref' => 'OP-778899', 'terms' => true, 'privacy' => true,
    ], siteOf(extra: critical()))->assertCreated();

    expect(withinTenant(tenantA(), fn () => DB::table('channel_widget_handoffs')->where('code', $handoff['code'])->value('status')))->toBe('convertido');
});

it('POST public/carts sin traspaso crea el carrito con la línea indicada', function () {
    $product = widgetProduct();

    $this->postJson('/api/v1/public/carts', ['product' => $product->slug, 'date' => widgetDate($product->slug), 'adults' => 2], siteOf(extra: critical()))
        ->assertCreated()->assertJsonPath('data.cart.items.0.product.slug', $product->slug);
});

it('WG-02: regenerar la clave exige motivo, deja la anterior 24 h de gracia y queda auditado; Manager recibe 403', function () {
    $old = widgetKey();

    actingAsSeed('U02');
    $this->postJson('/api/v1/channels/widget/rotate-key', ['reason' => 'Clave expuesta en un repositorio'], critical())->assertForbidden();

    actingAsSeed('U01');
    $this->postJson('/api/v1/channels/widget/rotate-key', [], critical())->assertStatus(422)->assertJsonValidationErrors(['reason']);
    $data = $this->postJson('/api/v1/channels/widget/rotate-key', ['reason' => 'Clave expuesta en un repositorio'], critical())->assertOk()->json('data');

    $config = withinTenant(tenantA(), fn () => DB::table('channel_widget_config')->first());
    expect($data['public_key'])->not->toBe($old)->toStartWith('pk_live_')
        ->and($config->public_key_prev)->toBe($old)
        ->and(abs(strtotime((string) $config->prev_expires_at) - now()->addDay()->getTimestamp()))->toBeLessThan(120)
        ->and(withinTenant(tenantA(), fn () => DB::table('audit_events')->where(['entity' => 'Widget web', 'action' => 'regenerar_clave'])->exists()))->toBeTrue();

    $this->getJson('/api/v1/channels/widget')->assertOk()->assertJsonPath('data.config.public_key', $data['public_key'])->assertJsonPath('data.can_rotate', true);
});
