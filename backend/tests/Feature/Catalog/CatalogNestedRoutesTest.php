<?php

use App\Domain\Catalog\Support\CatalogAccess;
use Illuminate\Support\Facades\DB;

function catalogLiveRate(): object
{
    return withinTenant(tenantA(), fn () => DB::table('catalog_rates as r')->join('catalog_products as p', 'p.id', '=', 'r.product_id')
        ->where('r.status', 'vigente')->where('r.valid_to', '>=', CatalogAccess::today())->whereNull('p.deleted_at')
        ->orderBy('r.ref')->first(['r.ref', 'r.lock_version', 'p.code as product', 'p.id as product_id']));
}

function catalogRangeProduct(): object
{
    return withinTenant(tenantA(), fn () => DB::table('catalog_products')->whereNull('deleted_at')->where('status', 'ACTIVE')->orderBy('code')->first(['id', 'code']));
}

it('crea, inactiva y reactiva tarifas bajo /catalog/products/{id}/rates', function () {
    actingAsSeed('U01');
    $rate = catalogLiveRate();
    $today = CatalogAccess::today();

    $this->postJson("/api/v1/catalog/products/{$rate->product_id}/rates", [
        'rate_type' => 'Venta', 'segment' => 'Adulto', 'channel' => 'Directo', 'currency' => 'USD',
        'cost' => 40, 'price' => 90, 'valid_from' => $today, 'valid_to' => now()->addDays(30)->toDateString(),
    ])->assertCreated()->assertJsonStructure(['data' => ['ref']]);

    $this->postJson("/api/v1/catalog/products/{$rate->product}/rates/{$rate->ref}/deactivate", ['reason' => 'Prueba de ruta'])->assertOk();
    expect(rowOf('catalog_rates', $rate->ref, column: 'ref')->status)->toBe('inactiva');

    $this->postJson("/api/v1/catalog/products/{$rate->product}/rates/{$rate->ref}/activate")->assertOk();
    expect(rowOf('catalog_rates', $rate->ref, column: 'ref')->status)->toBe('vigente');
});

it('rechaza una tarifa que no pertenece al producto de la ruta', function () {
    actingAsSeed('U01');
    $rate = catalogLiveRate();
    $other = withinTenant(tenantA(), fn () => DB::table('catalog_products')->whereNull('deleted_at')->where('id', '<>', $rate->product_id)->value('code'));

    $this->postJson("/api/v1/catalog/products/{$other}/rates/{$rate->ref}/activate")->assertNotFound();
});

it('el cambio de precio vive en PATCH /catalog/products/{id}/rates/{rateId}/price', function () {
    expect(routeExists('PATCH', '/api/v1/catalog/products/P-1/rates/TAR-001/price'))->toBeTrue()
        ->and(routeExists('PATCH', '/api/v1/catalog/rates/TAR-001'))->toBeFalse();
});

it('gestiona los rangos de disponibilidad bajo /catalog/products/{id}/availability-ranges', function () {
    actingAsSeed('U01');
    $product = catalogRangeProduct();
    $range = ['date_from' => '2027-03-01', 'date_to' => '2027-03-05', 'status' => 'cerrado', 'note' => 'Prueba de ruta'];

    $code = $this->postJson("/api/v1/catalog/products/{$product->code}/availability-ranges", $range)->assertCreated()->json('data.code');
    expect(rowOf('catalog_availability_ranges', $code)->product_id)->toBe($product->id);

    $this->patchJson("/api/v1/catalog/products/{$product->code}/availability-ranges/{$code}", [...$range, 'date_to' => '2027-03-06'])->assertOk();
    $this->deleteJson("/api/v1/catalog/products/{$product->code}/availability-ranges/{$code}", ['reason' => 'Prueba de ruta'])->assertOk();
    expect(rowOf('catalog_availability_ranges', $code)->deleted_at)->not->toBeNull();
});

it('las rutas antiguas de tarifas y rangos ya no existen', function (string $method, string $path) {
    actingAsSeed('U01');

    expect($this->json($method, "/api/v1/{$path}")->status())->toBeIn([404, 405]);
})->with([
    ['POST', 'catalog/rates'],
    ['PATCH', 'catalog/rates/TAR-001'],
    ['POST', 'catalog/rates/TAR-001/activate'],
    ['POST', 'catalog/rates/TAR-001/deactivate'],
    ['POST', 'catalog/availability/ranges'],
    ['PATCH', 'catalog/availability/ranges/RG-0001'],
    ['DELETE', 'catalog/availability/ranges/RG-0001'],
]);
