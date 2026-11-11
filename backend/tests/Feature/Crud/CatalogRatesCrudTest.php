<?php

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;

function catRateAudit(array $where): bool
{
    return withinTenant(tenantA(), fn () => DB::table('audit_events')->where($where)->exists());
}

function catRateRow(string $ref): object
{
    return rowOf('catalog_rates', $ref, column: 'ref');
}

function catRateBody(string $ref, array $overrides = []): array
{
    $rate = catRateRow($ref);

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

function catRatePatch(string $product, string $ref, array $overrides = [], ?int $lock = null)
{
    $body = catRateBody($ref, $overrides);

    return test()->patchJson("/api/v1/catalog/products/{$product}/rates/{$ref}/price", $body, critical($lock ?? $body['lock_version']));
}

function catSitePrice(string $date = '2026-10-02'): string
{
    return (string) test()->postJson('/api/v1/public/price-quote', ['product' => 'laguna-humantay-full-day', 'date' => $date, 'adults' => 2], siteOf())->assertOk()->json('data.lines.0.unit');
}

function catDeskPrice(): string
{
    return (string) test()->postJson('/api/v1/reservations/availability-check', ['product_id' => 'CUS-HUM-FD', 'departure_id' => departureRow('SAL-0403')->id, 'adt' => 2])->assertOk()->json('data.adult_price');
}

beforeEach(function () {
    lockCatalogProducts();
    Queue::fake();
});

it('cambiar el precio de la tarifa directa cambia el precio del cotizador y lo audita', function () {
    actingAsSeed('U01');
    expect(catDeskPrice())->toBe('140.00');
    $lock = (int) catRateRow('TAR-031')->lock_version;

    catRatePatch('CUS-HUM-FD', 'TAR-031', ['price' => 155, 'cost' => 70, 'reason' => 'Alza de entradas'])->assertOk()->assertJsonPath('data.ref', 'TAR-031');

    $rate = catRateRow('TAR-031');
    expect((string) $rate->price)->toBe('155.00')
        ->and((string) $rate->cost)->toBe('70.00')
        ->and((int) $rate->lock_version)->toBe($lock + 1)
        ->and(catRateAudit(['entity' => 'Tarifa', 'entity_id' => 'TAR-031', 'action' => 'cambio_precio']))->toBeTrue()
        ->and(catDeskPrice())->toBe('155.00');
});

it('cambiar el precio de la tarifa web cambia el precio del sitio para esa fecha', function () {
    actingAsSeed('U02');
    expect(catSitePrice())->toBe('129.00');

    catRatePatch('CUS-HUM-FD', 'TAR-033', ['price' => 119, 'reason' => 'Campaña de octubre'])->assertOk();

    expect(catSitePrice())->toBe('119.00');
});

it('una tarifa nueva más baja pasa a ser el precio del sitio', function () {
    actingAsSeed('U01');

    $this->postJson('/api/v1/catalog/products/CUS-HUM-FD/rates', [
        'rate_type' => 'Promocional', 'segment' => 'Adulto', 'channel' => 'E-commerce', 'currency' => 'PEN',
        'cost' => 60, 'price' => 99, 'valid_from' => '2026-10-01', 'valid_to' => '2026-10-15', 'season_id' => rowOf('catalog_seasons', 'TMP-02', column: 'ref')->id,
    ])->assertCreated();

    expect(catSitePrice())->toBe('99.00')
        ->and(catSitePrice('2026-10-20'))->toBe('129.00');
});

it('editar condiciones sin tocar el precio no pide motivo', function () {
    actingAsSeed('U01');

    catRatePatch('CUS-HUM-FD', 'TAR-031', ['conditions' => 'Incluye bastones'])->assertOk()->assertJsonPath('data.warning', null);

    expect(catRateRow('TAR-031')->conditions)->toBe('Incluye bastones')
        ->and(catRateAudit(['entity' => 'Tarifa', 'entity_id' => 'TAR-031', 'action' => 'modificar']))->toBeTrue();
});

it('avisa cuando el precio queda por debajo del costo', function () {
    actingAsSeed('U01');

    catRatePatch('CUS-HUM-FD', 'TAR-031', ['price' => 50, 'cost' => 80, 'reason' => 'Liquidación'])
        ->assertOk()->assertJsonPath('data.warning', 'El precio quedó por debajo del costo.');
});

it('valida el cambio de precio y protege tarifas inactivas o ajenas', function () {
    actingAsSeed('U01');

    expect(catRatePatch('CUS-HUM-FD', 'TAR-031', ['price' => 150]))->toBeApiError(422, 'CAT-BR-14');
    catRatePatch('CUS-HUM-FD', 'TAR-031', ['price' => 0, 'reason' => 'x'])->assertStatus(422)->assertJsonValidationErrors('price');
    expect(catRatePatch('CUS-HUM-FD', 'TAR-031', ['price' => 100, 'min_price' => 120, 'reason' => 'Ajuste']))->toBeApiError(422, 'CAT-BR-13');
    expect(catRatePatch('CUS-HUM-FD', 'TAR-031', ['valid_to' => '2026-09-01', 'valid_from' => '2026-01-01']))->toBeApiError(422, 'PRD-BR-005');
    expect(catRatePatch('CUS-MAPI-FD', 'TAR-004', ['price' => 400, 'reason' => 'Ajuste']))->toBeApiError(409, 'PRD-BR-005');
    expect(catRatePatch('CUS-HUM-FD', 'TAR-031', ['price' => 150, 'reason' => 'Ajuste', 'lock_version' => 9], 9))->toBeApiError(409, 'STALE_VERSION');
    catRatePatch('CUS-MAPI-FD', 'TAR-031', ['price' => 150, 'reason' => 'Ajuste'])->assertNotFound();
    expect((string) catRateRow('TAR-031')->price)->toBe('140.00');
});

it('solo quien gestiona tarifas cambia precios', function (string $user) {
    actingAsSeed($user);

    expect(catRatePatch('CUS-HUM-FD', 'TAR-031', ['price' => 150, 'reason' => 'Ajuste']))->toBeApiError(403);
    expect((string) catRateRow('TAR-031')->price)->toBe('140.00');
})->with(['U03', 'U05', 'U07']);
