<?php

use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;

beforeEach(function () {
    $this->withoutMiddleware(ThrottleRequests::class);
    Queue::fake();
});

function publicSlug(string $code): string
{
    return (string) withinTenant(tenantA(), fn () => DB::table('catalog_products')->where('code', $code)->value('slug'));
}

it('§6.6: reglas activas, monedas con tipo de cambio y disponibilidad del mes con la próxima fecha', function () {
    $rules = $this->getJson('/api/v1/public/booking-rules', siteOf())->assertOk()->json('data');
    expect(collect($rules)->pluck('id'))->toContain('R-DEPOSIT')->and($rules[0])->toHaveKeys(['id', 'params']);

    $currencies = $this->getJson('/api/v1/public/currencies', siteOf())->assertOk()->json('data');
    expect(collect($currencies['items'])->pluck('code'))->toContain('PEN')->and($currencies)->toHaveKeys(['charge_currencies', 'rate_updated_at']);

    $slug = publicSlug('CUS-HUM-FD');
    $month = $this->getJson("/api/v1/public/products/{$slug}/availability?month=2026-11&pax=2", siteOf())->assertOk()->json('data');
    expect($month['days'])->not->toBeEmpty()->and($month)->toHaveKey('next_available');
    $this->getJson("/api/v1/public/products/{$slug}/availability?month=noviembre", siteOf())->assertStatus(422);
});

it('§6.2: salidas por producto y salidas garantizadas próximas', function () {
    $slug = publicSlug('CUS-PKG-5D4N');
    $departures = $this->getJson("/api/v1/public/products/{$slug}/departures?from=2026-09-01&to=2026-12-31", siteOf())->assertOk()->json('data');
    expect($departures['product']['slug'])->toBe($slug)->and($departures['items'])->toBeArray();

    $guaranteed = $this->getJson('/api/v1/public/departures/guaranteed?limit=5', siteOf())->assertOk()->json('data');
    expect(count($guaranteed))->toBeLessThanOrEqual(5)->and(collect($guaranteed)->every(fn (array $d): bool => $d['guaranteed'] === true))->toBeTrue();
});

it('RVW-10: las reseñas públicas solo muestran las propias publicadas y filtran por estrellas', function () {
    $all = $this->getJson('/api/v1/public/reviews', siteOf())->assertOk()->json('data');
    $published = (int) withinTenant(tenantA(), fn () => DB::table('crm_own_reviews')->whereNull('deleted_at')->where('status', 'publicada')->count());
    expect($all['count'])->toBe($published)->and(collect($all['items'])->every(fn (array $r): bool => $r['verified']))->toBeTrue();

    $five = $this->getJson('/api/v1/public/reviews?stars=5', siteOf())->assertOk()->json('data.items');
    expect(collect($five)->every(fn (array $r): bool => $r['stars'] === 5))->toBeTrue();
});

it('SIT-BR-08: el código promocional del carrito se aplica si alguna línea lo admite y se puede quitar', function () {
    $promo = withinTenant(tenantA(), fn () => DB::table('catalog_product_promotions as m')->join('catalog_products as p', 'p.id', '=', 'm.product_id')
        ->whereNotNull('m.promo_code')->whereNull('m.deleted_at')->where('m.status', 'activa')->whereIn('m.channel', ['E-commerce', 'Todos'])
        ->where('m.date_from', '<=', BUSINESS_TODAY)->where('m.date_to', '>=', BUSINESS_TODAY)->orderBy('m.ref')
        ->first(['m.promo_code', 'p.slug']));

    if ($promo === null) {
        $this->markTestSkipped('La demo no tiene códigos promocionales activos para el sitio.');
    }

    $date = null;
    foreach (['2026-10', '2026-11', '2026-12'] as $month) {
        foreach ($this->getJson("/api/v1/public/products/{$promo->slug}/calendar?mes={$month}&viajeros=2", siteOf())->assertOk()->json('data.days') as $day) {
            if ($day['sellable']) {
                $date = $day['date'];
                break 2;
            }
        }
    }
    $token = (string) $this->postJson('/api/v1/public/carts/current/items', ['product' => $promo->slug, 'date' => $date, 'adults' => 2], siteOf(extra: critical()))->assertCreated()->json('data.token');
    $cart = fn () => $this->withCredentials()->withUnencryptedCookie('ah_cart', $token);

    expect($cart()->putJson('/api/v1/public/carts/current/promo', ['code' => 'NOEXISTE99'], siteOf()))->toBeApiError(422, 'SIT-BR-08');
    $applied = $cart()->putJson('/api/v1/public/carts/current/promo', ['code' => strtolower($promo->promo_code)], siteOf())->assertOk()->json('data');
    expect($applied['promo'])->toBe(strtoupper($promo->promo_code))->and($applied['items'][0]['quote']['discount'])->not->toBeNull();

    $cleared = $cart()->deleteJson('/api/v1/public/carts/current/promo', [], siteOf())->assertOk()->json('data');
    expect($cleared['promo'])->toBeNull();
});
