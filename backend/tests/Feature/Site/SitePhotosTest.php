<?php

use Illuminate\Support\Facades\DB;

it('las tarjetas de tours y destinos traen la foto principal del producto, o null si no tiene', function () {
    $product = withinTenant(tenantA(), fn () => DB::table('catalog_products')->where('slug', 'machu-picchu-full-day')->first(['id', 'tenant_id']));
    withinTenant(tenantA(), fn () => DB::table('catalog_product_media')->insert([
        ['tenant_id' => $product->tenant_id, 'product_id' => $product->id, 'storage_path' => 'https://fotos.agencia.pe/secundaria.jpg', 'alt_text' => 'Secundaria', 'is_main' => false, 'sort_order' => 0],
        ['tenant_id' => $product->tenant_id, 'product_id' => $product->id, 'storage_path' => 'https://fotos.agencia.pe/machu-picchu.jpg', 'alt_text' => 'Machu Picchu al amanecer', 'is_main' => true, 'sort_order' => 1],
    ]));

    $items = collect($this->getJson('/api/v1/public/products', siteOf())->assertOk()->json('data.items'));
    expect($items->firstWhere('slug', 'machu-picchu-full-day')['image'])->toBe(['url' => 'https://fotos.agencia.pe/machu-picchu.jpg', 'alt' => 'Machu Picchu al amanecer']);
    expect($items->first(fn (array $item): bool => $item['slug'] !== 'machu-picchu-full-day' && $item['image'] === null))->not->toBeNull();

    $destinations = collect($this->getJson('/api/v1/public/destinations', siteOf())->assertOk()->json('data.items'));
    expect($destinations->pluck('image.url')->filter()->values()->all())->toContain('https://fotos.agencia.pe/machu-picchu.jpg');
});
