<?php

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;

function dcProduct(string $code): object
{
    return rowOf('catalog_products', $code);
}

function dcSeason(string $ref): object
{
    return rowOf('catalog_seasons', $ref, column: 'ref');
}

function dcRate(string $ref): object
{
    return rowOf('catalog_rates', $ref, column: 'ref');
}

function dcSetting(string $section, array $values): void
{
    withinTenant(tenantA(), function () use ($section, $values): void {
        $current = (array) json_decode((string) DB::table('sys_settings')->where('section', $section)->value('values'), true);
        DB::table('sys_settings')->updateOrInsert(['tenant_id' => tenantA()->getKey(), 'section' => $section], ['values' => json_encode([...$current, ...$values])]);
    });
}

function dcRateBody(string $ref, array $overrides = []): array
{
    $rate = dcRate($ref);

    return [
        'rate_type' => $rate->rate_type,
        'segment' => $rate->segment,
        'channel' => $rate->channel,
        'currency' => trim($rate->currency),
        'price_basis' => $rate->price_basis,
        'cost' => (float) $rate->cost,
        'price' => (float) $rate->price,
        'min_price' => $rate->min_price === null ? null : (float) $rate->min_price,
        'max_price' => $rate->max_price === null ? null : (float) $rate->max_price,
        'valid_from' => $rate->valid_from,
        'valid_to' => $rate->valid_to,
        'season_id' => $rate->season_id,
        'conditions' => $rate->conditions,
        'lock_version' => (int) $rate->lock_version,
        ...$overrides,
    ];
}

function dcPatchRate(string $product, string $ref, array $overrides = [])
{
    $body = dcRateBody($ref, $overrides);

    return test()->patchJson("/api/v1/catalog/products/{$product}/rates/{$ref}/price", $body, critical($body['lock_version']));
}

beforeEach(function () {
    lockCatalogProducts();
    Queue::fake();
});

it('muestra en la ficha el precio que calcula el motor para la primera fecha vendible de cada temporada', function () {
    actingAsSeed('U01');
    $product = dcProduct('CUS-HUM-FD');
    $low = dcSeason('TMP-03');
    $ended = dcSeason('TMP-01');
    withinTenant(tenantA(), fn () => DB::table('catalog_product_seasons')->insertOrIgnore([
        ['product_id' => $product->id, 'season_id' => $low->id],
        ['product_id' => $product->id, 'season_id' => $ended->id],
    ]));

    $prices = $this->getJson('/api/v1/catalog/products/CUS-HUM-FD/overview')->assertOk()->json('data.season_prices');
    $current = $prices[dcSeason('TMP-02')->id];

    expect($current['date'])->toBe('2026-09-29')
        ->and($current['amount'])->toBe('140.00')
        ->and($current['currency'])->toBe('PEN')
        ->and($current['applied_season_id'])->toBe(dcSeason('TMP-02')->id)
        ->and($prices[$low->id]['date'])->toBe('2026-12-01')
        ->and($prices[$low->id]['ended'])->toBeFalse()
        ->and($prices[$ended->id]['ended'])->toBeTrue()
        ->and($prices[$ended->id]['amount'])->toBeNull();
});

it('rechaza un componente con una unidad distinta de la de su servicio y acepta la misma', function () {
    actingAsSeed('U01');
    $service = rowOf('catalog_services', 'SRV-016', column: 'ref');
    $other = trim((string) $service->unit) === 'vehículo' ? 'pax' : 'vehículo';

    expect($this->postJson('/api/v1/catalog/products/LOR-AMZ-4D/components', ['service_id' => $service->id, 'quantity' => 1, 'unit' => $other], critical()))->toBeApiError(422, 'CAT-BR-10');

    $this->postJson('/api/v1/catalog/products/LOR-AMZ-4D/components', ['service_id' => $service->id, 'quantity' => 1, 'unit' => $service->unit], critical())->assertCreated();
    $stored = withinTenant(tenantA(), fn () => DB::table('catalog_product_items')->where('product_id', dcProduct('LOR-AMZ-4D')->id)->where('service_id', $service->id)->value('unit'));
    expect($stored)->toBe($service->unit);
});

it('marca el producto publicado en la tienda en línea sin tarifa vigente E-commerce, Directo o Todos', function () {
    actingAsSeed('U01');
    $product = dcProduct('CUS-HUM-FD');

    $row = collect($this->getJson('/api/v1/catalog/products')->assertOk()->json('data'))->firstWhere('code', 'CUS-HUM-FD');
    expect($row['store_without_rate'])->toBeFalse()
        ->and($row['price_from']['channel'])->toBe('Directo');

    withinTenant(tenantA(), function () use ($product): void {
        DB::table('catalog_product_channels')->updateOrInsert(['product_id' => $product->id, 'channel' => 'ecommerce'], ['is_published' => true]);
        DB::table('catalog_rates')->where('product_id', $product->id)->whereIn('channel', ['E-commerce', 'Directo', 'Todos'])->update(['status' => 'inactiva']);
    });

    $row = collect($this->getJson('/api/v1/catalog/products')->assertOk()->json('data'))->firstWhere('code', 'CUS-HUM-FD');
    expect($row['store_without_rate'])->toBeTrue()
        ->and($this->getJson('/api/v1/catalog/products/CUS-HUM-FD')->assertOk()->json('data.store_without_rate'))->toBeTrue();
});

it('guarda el precio de la tarifa en otra moneda solo con el ajuste encendido y lo audita', function () {
    actingAsSeed('U01');

    expect(dcPatchRate('CUS-HUM-FD', 'TAR-033', ['alt_prices' => [['currency' => 'USD', 'price' => 36]]]))->toBeApiError(422, 'CAT-BR-MULTICURRENCY');

    $currency = $this->getJson('/api/v1/settings')->json('data.sections.currency.values');
    $version = (int) withinTenant(tenantA(), fn () => DB::table('sys_settings')->where('section', 'currency')->value('lock_version'));
    $this->patchJson('/api/v1/settings/currency', [...$currency, 'charge_multi_currency' => true], ['If-Match' => (string) $version])->assertOk()->assertJsonPath('data.changed', ['charge_multi_currency']);

    expect(dcPatchRate('CUS-HUM-FD', 'TAR-033', ['alt_prices' => [['currency' => 'PEN', 'price' => 36]]]))->toBeApiError(422, 'CAT-BR-MULTICURRENCY');

    dcPatchRate('CUS-HUM-FD', 'TAR-033', ['alt_prices' => [['currency' => 'USD', 'price' => 36]]])->assertOk();

    $rate = dcRate('TAR-033');
    $stored = withinTenant(tenantA(), fn () => DB::table('catalog_rate_prices')->where('rate_id', $rate->id)->first());
    expect(trim($stored->currency))->toBe('USD')
        ->and((string) $stored->price)->toBe('36.00')
        ->and(withinTenant(tenantA(), fn () => DB::table('audit_events')->where(['entity' => 'Tarifa', 'entity_id' => 'TAR-033', 'action' => 'precios_por_moneda'])->exists()))->toBeTrue();

    $listed = collect($this->getJson('/api/v1/catalog/rates')->assertOk()->json('data.rates'))->firstWhere('ref', 'TAR-033');
    expect($listed['alt_prices'])->toBe([['currency' => 'USD', 'price' => '36.00']]);

    dcPatchRate('CUS-HUM-FD', 'TAR-033', ['alt_prices' => []])->assertOk();
    expect(withinTenant(tenantA(), fn () => DB::table('catalog_rate_prices')->where('rate_id', $rate->id)->count()))->toBe(0);
});

it('valida el precio alternativo contra el precio mínimo convertido al tipo de cambio', function () {
    actingAsSeed('U01');
    dcSetting('currency', ['charge_multi_currency' => true]);

    expect(dcPatchRate('CUS-HUM-FD', 'TAR-033', ['min_price' => 120, 'alt_prices' => [['currency' => 'USD', 'price' => 5]]]))->toBeApiError(422, 'CAT-BR-13');
});

it('cobra en el sitio el precio propio de la moneda elegida y, sin él, lo convierte con el tipo de cambio y el margen (duda 4)', function () {
    $rate = dcRate('TAR-033');
    $body = ['product' => 'laguna-humantay-full-day', 'date' => '2026-10-02', 'adults' => 2];

    $plain = $this->postJson('/api/v1/public/price-quote', $body, siteOf('andes', ['X-Site-Currency' => 'USD']))->assertOk();
    expect($plain->json('data.currency'))->toBe('USD')
        ->and($plain->json('data.own_price'))->toBeFalse()
        ->and($plain->json('data.converted'))->toBeTrue();

    dcSetting('currency', ['charge_multi_currency' => true]);
    withinTenant(tenantA(), fn () => DB::table('catalog_rate_prices')->insert(['rate_id' => $rate->id, 'currency' => 'USD', 'price' => '36.00']));

    $own = $this->postJson('/api/v1/public/price-quote', $body, siteOf('andes', ['X-Site-Currency' => 'USD']))->assertOk();
    expect($own->json('data.currency'))->toBe('USD')
        ->and($own->json('data.rate_currency'))->toBe('PEN')
        ->and($own->json('data.own_price'))->toBeTrue()
        ->and($own->json('data.lines.0.unit'))->toBe('36.00');

    $cart = $this->postJson('/api/v1/public/carts/current/items', [...$body, 'currency' => 'USD'], siteOf(extra: critical()));
    expect($cart->status())->toBe(201, (string) $cart->getContent());
    expect($cart->json('data.cart.totals.0.currency'))->toBe('USD');

    $site = $this->getJson('/api/v1/public/site', siteOf())->assertOk()->json('data.currency');
    expect($site['charge_multi'])->toBeTrue()
        ->and(collect($site['currencies'])->pluck('code')->all())->toContain('USD');
});

it('ofrece crear la promoción desde la campaña solo a quien edita el catálogo', function () {
    $admin = actingAsSeed('U01');
    $overview = $this->getJson('/api/v1/marketing/campaigns')->assertOk();
    expect($overview->json('data.can.create_promotion'))->toBeTrue()
        ->and($overview->json('data.promotion_form.kinds'))->toContain('Código promocional');

    $product = dcProduct('CUS-HUM-FD');
    $this->postJson('/api/v1/catalog/products/CUS-HUM-FD/promotions', ['name' => 'Campaña de verano', 'kind' => 'Código promocional', 'value' => 10, 'channel' => 'E-commerce', 'promo_code' => 'VERANO26', 'valid_from' => '2026-09-29', 'valid_to' => '2026-12-31'], critical())->assertCreated();
    expect(withinTenant(tenantA(), fn () => DB::table('catalog_product_promotions')->where('product_id', $product->id)->where('promo_code', 'VERANO26')->exists()))->toBeTrue();

    $user = actingAsSeed('U03');
    $response = $this->getJson('/api/v1/marketing/campaigns');
    if ($response->status() === 200) {
        expect($response->json('data.can.create_promotion'))->toBe($user->can('catalog.products.update'))
            ->and($response->json('data.promotion_form') === null)->toBe(! $user->can('catalog.products.update'));
    } else {
        expect($response->status())->toBe(403);
    }
    expect($admin->can('catalog.products.update'))->toBeTrue();
});
