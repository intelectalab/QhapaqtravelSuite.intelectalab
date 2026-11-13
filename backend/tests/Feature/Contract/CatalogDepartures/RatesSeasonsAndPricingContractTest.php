<?php

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;

function ctrRateId(string $ref): string
{
    return (string) withinTenant(tenantA(), fn () => DB::table('catalog_rates')->where('ref', $ref)->value('id'));
}

function ctrConfigGroup(string $product, string $name, array $options): void
{
    withinTenant(tenantA(), function () use ($product, $name, $options) {
        $groupId = (string) DB::table('catalog_product_config_groups')->insertGetId(['product_id' => idOf('catalog_products', $product), 'name' => $name, 'sort_order' => 1]);
        foreach ($options as $index => [$label, $delta]) {
            DB::table('catalog_product_config_options')->insert(['group_id' => $groupId, 'label' => $label, 'price_delta' => $delta, 'sort_order' => $index]);
        }
    });
}

beforeEach(function () {
    lockCatalogProducts();
    Queue::fake();
});

it('GET /catalog/seasons lista las temporadas con los solapamientos detectados', function () {
    actingAsSeed('U03');

    $response = $this->getJson('/api/v1/catalog/seasons?page[size]=100')->assertOk();

    expect(collect($response->json('data'))->pluck('ref'))->toContain('TMP-01', 'TMP-05')
        ->and($response->json('meta.overlaps'))->toBeArray()
        ->and(collect($response->json('meta.overlaps'))->firstWhere('winner', 'TMP-05'))->not->toBeNull();
    expect(collect($this->getJson('/api/v1/catalog/seasons?filter[date]=2026-12-30')->json('data'))->pluck('ref')->sort()->values()->all())->toBe(['TMP-03', 'TMP-05']);
});

it('GET /catalog/seasons/resolve elige la temporada de mayor prioridad y lista las otras vigentes', function () {
    actingAsSeed('U03');

    $data = $this->getJson('/api/v1/catalog/seasons/resolve?date=2026-12-30')->assertOk()->json('data');

    expect($data['season']['ref'])->toBe('TMP-05')
        ->and($data['factor'])->toBe((float) rowOf('catalog_seasons', 'TMP-05', column: 'ref')->factor)
        ->and(collect($data['others'])->pluck('ref')->all())->toBe(['TMP-03']);
    expect($this->getJson('/api/v1/catalog/seasons/resolve?date=30-12-2026'))->toBeApiError(422);
});

it('DELETE /catalog/seasons/{id} borra una temporada sin uso y la audita', function () {
    actingAsSeed('U02');

    $this->deleteJson('/api/v1/catalog/seasons/TMP-04')->assertNoContent();

    expect(rowOf('catalog_seasons', 'TMP-04', column: 'ref')->deleted_at)->not->toBeNull()
        ->and(withinTenant(tenantA(), fn () => DB::table('audit_events')->where(['entity' => 'Temporada', 'entity_id' => 'TMP-04', 'action' => 'eliminar'])->exists()))->toBeTrue()
        ->and(collect($this->getJson('/api/v1/catalog/seasons?page[size]=100')->json('data'))->pluck('ref'))->not->toContain('TMP-04');
});

it('DELETE /catalog/seasons/{id} responde 409 si la temporada está en uso y 403 sin manage_rates', function () {
    actingAsSeed('U02');
    expect($this->deleteJson('/api/v1/catalog/seasons/TMP-01'))->toBeApiError(409, 'CAT-SEASON-IN-USE');

    actingAsSeed('U03');
    $denied = $this->deleteJson('/api/v1/catalog/seasons/TMP-05');
    expect($denied)->toBeApiError(403)
        ->and($denied->json('required_permissions'))->toContain('catalog.products.manage_rates');
});

it('GET /catalog/products/{id}/rates oculta las tarifas netas a quien no debe verlas', function () {
    actingAsSeed('U03');
    $sales = collect($this->getJson('/api/v1/catalog/products/CUS-MAPI-FD/rates')->assertOk()->json('data'));

    expect($sales->pluck('ref'))->toContain('TAR-001')->not->toContain('TAR-003')
        ->and($sales->pluck('cost')->filter()->all())->toBe([]);

    actingAsSeed('U01');
    expect(collect($this->getJson('/api/v1/catalog/products/CUS-MAPI-FD/rates')->json('data'))->pluck('ref'))->toContain('TAR-003');
});

it('GET /catalog/products/{id}/seasons lista las temporadas asociadas al producto', function () {
    actingAsSeed('U03');

    $refs = collect($this->getJson('/api/v1/catalog/products/CUS-MAPI-FD/seasons')->assertOk()->json('data'))->pluck('ref')->all();

    expect($refs)->toBe(['TMP-01', 'TMP-02']);
});

it('GET /catalog/products/{id}/providers lista el proveedor principal y los de componentes', function () {
    actingAsSeed('U01');

    $data = $this->getJson('/api/v1/catalog/products/CUS-PKG-5D4N/providers')->assertOk()->json('data');

    expect($data)->not->toBeEmpty()
        ->and($data[0])->toHaveKeys(['ref', 'name', 'main', 'usable']);
});

it('POST /catalog/products/{id}/price-quote suma las diferencias de las opciones a la tarifa base', function () {
    ctrConfigGroup('CUS-MAPI-FD', 'Guiado', [['Compartido', '0'], ['Privado', '85.50']]);
    actingAsSeed('U03');

    $data = $this->postJson('/api/v1/catalog/products/CUS-MAPI-FD/price-quote', [
        'rate_id' => ctrRateId('TAR-001'),
        'selections' => ['Guiado' => 'Privado'],
        'date' => '2026-10-10',
        'pax' => 2,
        'price' => '1.00',
    ])->assertOk()->json('data');

    expect($data['base_price'])->toBe('345.00')
        ->and($data['unit_price'])->toBe('430.50')
        ->and($data['total'])->toBe('861.00')
        ->and($data['currency'])->toBe('USD');
});

it('POST /catalog/products/{id}/price-quote rechaza opciones desconocidas, tarifas no vigentes y netas', function () {
    ctrConfigGroup('CUS-MAPI-FD', 'Guiado', [['Compartido', '0']]);
    actingAsSeed('U03');

    expect($this->postJson('/api/v1/catalog/products/CUS-MAPI-FD/price-quote', ['rate_id' => ctrRateId('TAR-001'), 'selections' => ['Guiado' => 'VIP']]))->toBeApiError(422, 'CAT-BR-30')
        ->and($this->postJson('/api/v1/catalog/products/CUS-MAPI-FD/price-quote', ['rate_id' => ctrRateId('TAR-004'), 'date' => '2026-07-10']))->toBeApiError(422, 'PRD-BR-005')
        ->and($this->postJson('/api/v1/catalog/products/CUS-MAPI-FD/price-quote', ['rate_id' => ctrRateId('TAR-003')]))->toBeApiError(422, 'PRD-BR-005');
});

it('GET /catalog/products/{id}/profitability desglosa venta, costos, comisión y utilidad', function () {
    actingAsSeed('U01');

    $data = $this->getJson('/api/v1/catalog/products/CUS-MAPI-FD/profitability?rate_id='.ctrRateId('TAR-001').'&pax=2&other_cost=10&commission_pct=5')->assertOk()->json('data');

    expect($data['breakdown'])->toMatchArray([
        'sale' => '690.00',
        'provider_cost' => '536.00',
        'other_costs' => '20.00',
        'commission' => '34.50',
        'profit' => '99.50',
        'margin_pct' => 14.4,
    ])
        ->and(collect($data['rates'])->pluck('ref'))->toContain('TAR-001', 'TAR-004');
});

it('GET /catalog/products/{id}/profitability exige view_profitability', function () {
    actingAsSeed('U03');

    $denied = $this->getJson('/api/v1/catalog/products/CUS-MAPI-FD/profitability');

    expect($denied)->toBeApiError(403)
        ->and($denied->json('required_permissions'))->toContain('catalog.products.view_profitability');
});

it('GET /catalog/products/quoteable lista todos los productos con su motivo de bloqueo y el precio desde', function () {
    actingAsSeed('U03');
    withinTenant(tenantA(), fn () => DB::table('catalog_products')->where('code', 'CUS-HUM-FD')->update(['is_quoteable' => false]));

    $products = collect($this->getJson('/api/v1/catalog/products/quoteable?date=2026-10-10&currency=USD')->assertOk()->json('data.products'))->keyBy('code');

    expect($products['CUS-MAPI-FD']['blocked_reason'])->toBeNull()
        ->and($products['CUS-MAPI-FD']['from'])->toBe(['amount' => '345.00', 'currency' => 'USD'])
        ->and(collect($products['CUS-MAPI-FD']['rates'])->pluck('ref'))->toContain('TAR-001')->not->toContain('TAR-004')
        ->and($products['CUS-HUM-FD']['blocked_reason'])->toContain('PRD-BR-002');
});

it('GET /catalog/products/{id}/rate-suggestion sugiere la tarifa por defecto con el precio de la temporada', function () {
    actingAsSeed('U03');

    $data = $this->getJson('/api/v1/catalog/products/CUS-MAPI-FD/rate-suggestion?date=2026-10-10&currency=USD')->assertOk()->json('data');

    expect($data['rate']['ref'])->toBe('TAR-001')
        ->and($data['unit_price'])->not->toBeNull()
        ->and($data['manual'])->toBeFalse()
        ->and(collect($data['rates'])->firstWhere('ref', 'TAR-004')['disabled_reason'])->toContain('PRD-BR-005');
    expect($this->getJson('/api/v1/catalog/products/CUS-MAPI-FD/rate-suggestion?date=2026-10-10&currency=USD&rate_id='.ctrRateId('TAR-004')))->toBeApiError(422, 'PRD-BR-005')
        ->and($this->getJson('/api/v1/catalog/products/CUS-MAPI-FD/rate-suggestion'))->toBeApiError(422);
});

it('quoteable y rate-suggestion exigen quotes.create', function () {
    actingAsSeed('U07');

    $denied = $this->getJson('/api/v1/catalog/products/quoteable');

    expect($denied)->toBeApiError(403)
        ->and($denied->json('required_permissions'))->toContain('quotes.create');
});
