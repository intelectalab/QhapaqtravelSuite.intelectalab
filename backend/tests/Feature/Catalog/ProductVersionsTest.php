<?php

use Illuminate\Support\Facades\DB;

function versionedProduct(): string
{
    return (string) withinTenant(tenantA(), fn () => DB::table('catalog_products')->whereNull('deleted_at')->where('status', 'ACTIVE')->whereExists(fn ($query) => $query->from('catalog_rates as r')->whereColumn('r.product_id', 'catalog_products.id'))->value('code'));
}

it('crea una versión mayor con la copia completa y compara A/B (CAT-BR-31, PRD-BR-017)', function () {
    actingAsSeed('U01');
    $code = versionedProduct();

    $first = $this->postJson("/api/v1/catalog/products/{$code}/versions", ['kind' => 'minor', 'valid_from' => '2026-10-01', 'reason' => 'Ajuste de itinerario'], critical())->assertCreated()->json('data.version');
    withinTenant(tenantA(), fn () => DB::table('catalog_products')->where('code', $code)->update(['name' => 'Nombre nuevo para comparar']));
    $second = $this->postJson("/api/v1/catalog/products/{$code}/versions", ['kind' => 'major', 'valid_from' => '2026-11-01', 'reason' => 'Nueva temporada'], critical())->assertCreated()->json('data.version');

    $snapshot = $this->getJson("/api/v1/catalog/products/{$code}/versions/{$second}")->assertOk()->json('data.snapshot');
    $changes = collect($this->getJson("/api/v1/catalog/products/{$code}/versions/compare?from={$first}&to={$second}")->assertOk()->json('data.changes'));

    expect($snapshot)->toHaveKeys(['product', 'components', 'itinerary', 'rates', 'policies', 'inclusions', 'fx_usd'])
        ->and($changes->firstWhere('field', 'product.name')['after'])->toBe('Nombre nuevo para comparar')
        ->and(collect($this->getJson("/api/v1/catalog/products/{$code}/versions")->json('data'))->where('status', '<>', 'historica')->count())->toBe(1);
});

it('un producto archivado no recibe versiones nuevas ni toca las existentes', function () {
    actingAsSeed('U01');
    $code = versionedProduct();
    withinTenant(tenantA(), fn () => DB::table('catalog_products')->where('code', $code)->update(['status' => 'ARCHIVED']));
    $before = collect($this->getJson("/api/v1/catalog/products/{$code}/versions")->assertOk()->json('data'))->pluck('status', 'version')->all();

    expect($this->postJson("/api/v1/catalog/products/{$code}/versions", ['kind' => 'minor', 'valid_from' => '2026-12-01', 'reason' => 'Intento sobre archivado'], critical()))->toBeApiError(409, 'PRD-ARCHIVED')
        ->and(collect($this->getJson("/api/v1/catalog/products/{$code}/versions")->json('data'))->pluck('status', 'version')->all())->toBe($before);
});

it('duplica el producto como borrador con código -C01, sin salidas y con tarifas de referencia nueva (CAT-BR-09)', function () {
    actingAsSeed('U01');
    $code = versionedProduct();

    $copy = $this->postJson("/api/v1/catalog/products/{$code}/duplicate", [], critical())->assertCreated()->json('data.code');
    $row = rowOf('catalog_products', $copy);
    $source = rowOf('catalog_products', $code);

    expect($copy)->toBe("{$code}-C01")
        ->and($row->status)->toBe('DRAFT')
        ->and($row->name)->toContain('(copia)')
        ->and(withinTenant(tenantA(), fn () => DB::table('catalog_product_departures')->where('product_id', $row->id)->count()))->toBe(0)
        ->and(withinTenant(tenantA(), fn () => DB::table('catalog_rates')->where('product_id', $row->id)->count()))->toBe(withinTenant(tenantA(), fn () => DB::table('catalog_rates')->where('product_id', $source->id)->count()))
        ->and(withinTenant(tenantA(), fn () => DB::table('catalog_rates')->where('product_id', $row->id)->whereIn('ref', DB::table('catalog_rates')->where('product_id', $source->id)->pluck('ref'))->count()))->toBe(0);
});

it('resuelve la tarifa aplicable y explica por qué descarta las demás (CAT-BR-15)', function () {
    actingAsSeed('U01');
    $code = versionedProduct();
    $rate = withinTenant(tenantA(), fn () => DB::table('catalog_rates as r')->join('catalog_products as p', 'p.id', '=', 'r.product_id')->where('p.code', $code)->where('r.status', 'vigente')->first(['r.ref', 'r.segment', 'r.channel', 'r.valid_from']));

    $data = $this->getJson("/api/v1/catalog/products/{$code}/rates/resolve?".http_build_query(['date' => $rate->valid_from, 'segment' => $rate->segment, 'channel' => $rate->channel]))->assertOk()->json('data');

    expect($data['chosen'])->not->toBeNull()
        ->and(collect($data['rates'])->firstWhere('ref', $rate->ref)['selectable'])->toBeTrue()
        ->and(collect($data['rates'])->where('selectable', false)->every(fn (array $row): bool => $row['reason'] !== null))->toBeTrue();
});
