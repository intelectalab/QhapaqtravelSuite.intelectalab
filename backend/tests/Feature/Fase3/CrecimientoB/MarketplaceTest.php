<?php

use Illuminate\Support\Facades\DB;

if (! function_exists('crecbAudited')) {
    function crecbAudited(array $where): bool
    {
        return (bool) withinTenant(tenantA(), fn () => DB::table('audit_events')->where($where)->exists());
    }
}

function crecbPublishFromA(object $test): array
{
    actingAsSeed('U01');
    $product = (string) withinTenant(tenantA(), fn () => DB::table('catalog_products')->whereNull('deleted_at')->where('status', 'ACTIVE')->orderBy('code')->value('code'));

    return $test->postJson('/api/v1/marketplace/listings', ['product' => $product, 'reseller_commission_pct' => 15, 'summary' => 'Salida diaria con guía bilingüe.'])
        ->assertCreated()
        ->json('data');
}

it('SC-11: A publica, B pide la alianza, A la acepta y B vende con comisión y tarifa de plataforma', function () {
    $listing = crecbPublishFromA($this);
    expect($listing['status'])->toBe('publicado');
    $this->postJson('/api/v1/marketplace/listings', ['product' => $listing['product_code'], 'reseller_commission_pct' => 10])->assertStatus(409);

    actingAsTenantBAdmin();
    $network = $this->getJson('/api/v1/marketplace/listings')->assertOk()->json('data.listings');
    $seen = collect($network)->firstWhere('id', $listing['id']);
    expect($seen)->not->toBeNull()
        ->and($seen['product_code'])->toBeNull()
        ->and($seen['seller'])->not->toBeEmpty();

    $this->postJson('/api/v1/marketplace/orders', ['listing' => $listing['id'], 'pax' => 2, 'travel_date' => now()->addDays(20)->toDateString(), 'gross_amount' => 500], critical())->assertStatus(422);

    $partnership = $this->postJson('/api/v1/marketplace/partnerships', ['listing' => $listing['id']])->assertCreated()->assertJsonPath('data.status', 'solicitada')->json('data');
    $this->postJson('/api/v1/marketplace/partnerships', ['listing' => $listing['id']])->assertStatus(409);
    $this->postJson("/api/v1/marketplace/partnerships/{$partnership['id']}/decide", ['decision' => 'aceptar'])->assertStatus(409);

    actingAsSeed('U02');
    $this->getJson('/api/v1/marketplace/partnerships')->assertOk()->assertJsonPath('data.partnerships.0.actions', ['aceptar', 'rechazar']);
    $this->postJson("/api/v1/marketplace/partnerships/{$partnership['id']}/decide", ['decision' => 'aceptar'])->assertOk()->assertJsonPath('data.status', 'activa');

    actingAsTenantBAdmin();
    $key = idem('mkp');
    $order = $this->postJson('/api/v1/marketplace/orders', ['listing' => $listing['id'], 'pax' => 2, 'travel_date' => now()->addDays(20)->toDateString(), 'gross_amount' => 500], critical(null, $key))
        ->assertCreated()
        ->assertJsonPath('data.role', 'compra')
        ->assertJsonPath('data.gross_amount', '500.00')
        ->assertJsonPath('data.commission_amount', '75.00')
        ->assertJsonPath('data.platform_fee_amount', '5.00')
        ->json('data');

    expect($order['code'])->toStartWith('MKP-');
    $this->postJson('/api/v1/marketplace/orders', ['listing' => $listing['id'], 'pax' => 2, 'travel_date' => now()->addDays(20)->toDateString(), 'gross_amount' => 500], critical(null, $key))->assertJsonPath('data.id', $order['id']);
    expect(DB::connection('pgsql_platform')->table('platform_marketplace_orders')->where('idempotency_key', $key)->count())->toBe(1);

    actingAsSeed('U01');
    $this->getJson('/api/v1/marketplace/orders')->assertOk()->assertJsonPath('data.orders.0.role', 'venta')->assertJsonPath('data.kpis.sold_month', 1);

    expect(crecbAudited(['entity' => 'Marketplace', 'entity_id' => $listing['product_code'], 'action' => 'publicar']))->toBeTrue()
        ->and(crecbAudited(['entity' => 'Alianza marketplace', 'entity_id' => $partnership['id'], 'action' => 'aceptar']))->toBeTrue();
});

it('el vendedor pausa su publicación y deja de verse en la red; otro tenant no la edita', function () {
    $listing = crecbPublishFromA($this);

    $this->patchJson("/api/v1/marketplace/listings/{$listing['id']}", ['status' => 'pausado', 'reseller_commission_pct' => 12])
        ->assertOk()
        ->assertJsonPath('data.status', 'pausado')
        ->assertJsonPath('data.reseller_commission_pct', '12.00');
    $this->getJson('/api/v1/marketplace/listings?filter[scope]=mine')->assertOk()->assertJsonPath('data.listings.0.id', $listing['id']);

    actingAsTenantBAdmin();
    expect(collect($this->getJson('/api/v1/marketplace/listings')->json('data.listings'))->pluck('id'))->not->toContain($listing['id']);
    $this->patchJson("/api/v1/marketplace/listings/{$listing['id']}", ['status' => 'retirado'])->assertNotFound();
});

it('el vendedor rechaza una alianza y luego puede volver a pedirse', function () {
    $listing = crecbPublishFromA($this);

    actingAsTenantBAdmin();
    $id = $this->postJson('/api/v1/marketplace/partnerships', ['listing' => $listing['id'], 'payment_terms' => 'credito', 'credit_limit' => 1000])->json('data.id');

    actingAsSeed('U01');
    $this->postJson("/api/v1/marketplace/partnerships/{$id}/decide", ['decision' => 'rechazar'])->assertOk()->assertJsonPath('data.status', 'rechazada');
    $this->postJson("/api/v1/marketplace/partnerships/{$id}/decide", ['decision' => 'aceptar'])->assertStatus(409);

    actingAsTenantBAdmin();
    $this->postJson('/api/v1/marketplace/partnerships', ['listing' => $listing['id']])->assertCreated()->assertJsonPath('data.status', 'solicitada');
});

it('Ventas no entra al marketplace: 403', function () {
    actingAsSeed('U03');

    expect($this->getJson('/api/v1/marketplace/listings'))->toBeApiError(403);
});
