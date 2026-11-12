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

    $past = $this->postJson('/api/v1/public/availability', ['product' => $slug, 'date' => '2026-01-05', 'pax' => 2], siteOf())->assertOk()->json('data');
    expect($past['sellable'])->toBeFalse()->and($past['reason'])->not->toBeNull();

    $this->postJson('/api/v1/public/availability', ['product' => $slug, 'pax' => 0], siteOf())->assertStatus(422)->assertJsonValidationErrors(['date', 'pax']);
});

it('v2.5 (15 §11, 08 §6.5): ya no existen los alias de la tienda ni del portal del cliente', function () {
    $slug = shopSlug();

    foreach ([['GET', '/api/v1/public/shop/products'], ['GET', "/api/v1/public/shop/products/{$slug}"], ['POST', '/api/v1/public/shop/price'], ['POST', '/api/v1/public/shop/orders']] as [$method, $uri]) {
        expect($this->json($method, $uri, [], siteOf())->status())->toBe(404);
    }

    actingAsSeed('U01');
    expect($this->postJson('/api/v1/portal/customer/receivables/CXC-0001/pay', [])->status())->toBe(404);
});
