<?php

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;

beforeEach(function () {
    lockCatalogProducts();
    Queue::fake();
});

function b2bRate(string $product, string $agency): ?object
{
    return withinTenant(tenantA(), fn () => DB::table('catalog_product_b2b_rates as r')
        ->join('catalog_products as p', 'p.id', '=', 'r.product_id')->join('channel_b2b_agencies as a', 'a.id', '=', 'r.agency_id')
        ->where('p.code', $product)->where('a.code', $agency)->whereNull('r.deleted_at')->first(['r.*']));
}

function b2bPublic(string $product): object
{
    return withinTenant(tenantA(), fn () => DB::table('catalog_rates')->where('product_id', rowOf('catalog_products', $product)->id)->where('status', 'vigente')->where('rate_type', '<>', 'B2B')->where('channel', '<>', 'B2B')->whereIn('segment', ['Adulto', 'Pasajero'])->whereNotIn('rate_type', ['Proveedor', 'Costo'])
        ->where('valid_from', '<=', now('America/Lima')->toDateString())->where('valid_to', '>=', now('America/Lima')->toDateString())->orderBy('price')->first());
}

it('B2B-BR-10: asigna, edita y quita la tarifa B2B de una agencia y marca el producto como B2B', function () {
    actingAsSeed('U01');
    $public = b2bPublic('CUS-HUM-FD');
    withinTenant(tenantA(), fn () => DB::table('catalog_product_b2b_rates')->where('product_id', rowOf('catalog_products', 'CUS-HUM-FD')->id)->where('agency_id', rowOf('channel_b2b_agencies', 'AGB-01')->id)->update(['deleted_at' => now()]));
    $net = bcsub((string) $public->price, '5', 2);

    $this->postJson('/api/v1/catalog/products/CUS-HUM-FD/b2b-rates', ['agency' => 'AGB-01', 'net_price' => $net, 'currency' => $public->currency, 'commission_pct' => 8, 'credit_allowed' => true], critical())->assertCreated();
    $rate = b2bRate('CUS-HUM-FD', 'AGB-01');
    expect((string) $rate->price)->toBe($net)
        ->and((bool) $rate->is_credit)->toBeTrue()
        ->and($rate->price_list)->toBe('Mayorista 2026')
        ->and((bool) rowOf('catalog_products', 'CUS-HUM-FD')->is_b2b)->toBeTrue();

    expect($this->postJson('/api/v1/catalog/products/CUS-HUM-FD/b2b-rates', ['agency' => 'AGB-01', 'net_price' => $net], critical()))->toBeApiError(409, 'B2B-BR-10');

    $this->patchJson('/api/v1/catalog/products/CUS-HUM-FD/b2b-rates/AGB-01', ['commission_pct' => 12, 'conditions' => 'Pago a 15 días'], critical())->assertOk();
    expect((string) b2bRate('CUS-HUM-FD', 'AGB-01')->commission_pct)->toBe('12.00')->and(b2bRate('CUS-HUM-FD', 'AGB-01')->conditions)->toBe('Pago a 15 días');

    $this->putJson('/api/v1/catalog/products/CUS-HUM-FD/b2b-rates/AGB-01', ['net_price' => $net, 'currency' => $public->currency, 'credit_allowed' => false], critical())->assertOk();
    expect((bool) b2bRate('CUS-HUM-FD', 'AGB-01')->is_credit)->toBeFalse();

    $list = $this->getJson('/api/v1/catalog/products/CUS-HUM-FD/b2b-rates')->assertOk()->json('data');
    expect(collect($list)->pluck('agency.code'))->toContain('AGB-01');
    $agencies = $this->getJson('/api/v1/channels/b2b')->assertOk()->json('data.items');
    expect(collect(collect($agencies)->firstWhere('code', 'AGB-01')['rates'])->pluck('product.code'))->toContain('CUS-HUM-FD');

    $this->deleteJson('/api/v1/catalog/products/CUS-HUM-FD/b2b-rates/AGB-01', [], critical())->assertNoContent();
    expect(b2bRate('CUS-HUM-FD', 'AGB-01'))->toBeNull()
        ->and(withinTenant(tenantA(), fn () => DB::table('audit_events')->where(['entity' => 'Tarifa B2B', 'entity_id' => 'CUS-HUM-FD/AGB-01', 'action' => 'quitar'])->exists()))->toBeTrue();
});

it('B2B-BR-10: el neto no supera el público, el crédito exige línea y la agencia debe estar activa', function () {
    actingAsSeed('U01');
    $public = b2bPublic('CUS-HUM-FD');

    expect($this->putJson('/api/v1/catalog/products/CUS-HUM-FD/b2b-rates/AGB-02', ['net_price' => bcadd((string) $public->price, '1', 2), 'currency' => $public->currency, 'credit_allowed' => false], critical()))->toBeApiError(422, 'B2B-BR-10')
        ->and($this->putJson('/api/v1/catalog/products/CUS-HUM-FD/b2b-rates/AGB-02', ['net_price' => $public->price, 'currency' => $public->currency, 'credit_allowed' => true], critical()))->toBeApiError(422, 'B2B-BR-10')
        ->and($this->putJson('/api/v1/catalog/products/CUS-HUM-FD/b2b-rates/AGB-03', ['net_price' => $public->price, 'currency' => $public->currency, 'credit_allowed' => false], critical()))->toBeApiError(422, 'B2B-BR-10');

    $this->postJson('/api/v1/catalog/products/CUS-HUM-FD/b2b-rates', ['net_price' => -1, 'commission_pct' => 40], critical())->assertStatus(422)->assertJsonValidationErrors(['agency', 'net_price', 'commission_pct']);
});

it('la vista de listas de precios trae productos con precio público, asignaciones y agencias', function () {
    actingAsSeed('U01');

    $data = $this->getJson('/api/v1/channels/b2b/product-rates')->assertOk()->json('data');
    $lists = $this->getJson('/api/v1/channels/b2b/price-lists')->assertOk()->json('data');

    expect($data)->toHaveKeys(['products', 'agencies'])
        ->and($data['products'])->not->toBeEmpty()
        ->and($data['products'][0])->toHaveKeys(['code', 'public', 'general', 'assignments'])
        ->and(collect($lists)->pluck('name'))->toContain('Mayorista 2026');
});

it('Operaciones no administra tarifas B2B', function () {
    actingAsSeed('U05');

    expect($this->putJson('/api/v1/catalog/products/CUS-HUM-FD/b2b-rates/AGB-01', ['net_price' => 10], critical()))->toBeApiError(403)
        ->and($this->getJson('/api/v1/channels/b2b/product-rates'))->toBeApiError(403);
});
