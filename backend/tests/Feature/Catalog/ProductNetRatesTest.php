<?php

use Illuminate\Support\Facades\DB;

function productWithNetRate(): string
{
    $code = withinTenant(tenantA(), fn () => DB::table('catalog_rates as r')->join('catalog_products as p', 'p.id', '=', 'r.product_id')->whereNull('p.deleted_at')
        ->where(fn ($query) => $query->whereIn('r.rate_type', ['Proveedor', 'Costo', 'B2B', 'Mayorista'])->orWhereIn('r.channel', ['B2B', 'Mayorista']))->value('p.code'));
    expect($code)->not->toBeNull();

    return (string) $code;
}

function hasNet(array $rates, string $typeKey): bool
{
    return collect($rates)->contains(fn (array $rate): bool => in_array($rate[$typeKey], ['Proveedor', 'Costo', 'B2B', 'Mayorista'], true) || in_array($rate['channel'], ['B2B', 'Mayorista'], true));
}

it('Ventas y Operaciones no ven las tarifas netas en la ficha ni en el editor del producto (CAT-BR-40)', function (string $user) {
    $code = productWithNetRate();
    actingAsSeed($user);

    expect(hasNet($this->getJson("/api/v1/catalog/products/{$code}")->assertOk()->json('data.rates'), 'type'))->toBeFalse();

    $editor = $this->getJson("/api/v1/catalog/products/{$code}/editor");
    if ($editor->status() === 200) {
        expect(hasNet($editor->json('data.rates'), 'rate_type'))->toBeFalse();
    }
})->with(['U04', 'U05']);

it('quien gestiona tarifas sí ve las netas', function () {
    $code = productWithNetRate();
    actingAsSeed('U01');

    expect(hasNet($this->getJson("/api/v1/catalog/products/{$code}")->assertOk()->json('data.rates'), 'type'))->toBeTrue()
        ->and(hasNet($this->getJson("/api/v1/catalog/products/{$code}/editor")->assertOk()->json('data.rates'), 'rate_type'))->toBeTrue();
});
