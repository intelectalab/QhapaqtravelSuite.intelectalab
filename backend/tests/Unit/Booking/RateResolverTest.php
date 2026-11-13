<?php

use App\Domain\Catalog\Support\RateResolver;

function rateRow(array $overrides = []): array
{
    return ['segment' => 'Adulto', 'channel' => 'Directo', 'rate_type' => 'Venta', 'status' => 'vigente', 'valid_from' => '2026-01-01', 'valid_to' => '2026-12-31', 'price' => '100.00', 'season_id' => null, 'season_factor' => null, ...$overrides];
}

it('CAT-BR-15: prefiere la tarifa del canal pedido, luego la de Todos y por último la de Directo, aunque la de Directo esté primero', function () {
    $rates = [rateRow(['price' => '140.00']), rateRow(['channel' => 'Todos', 'price' => '135.00']), rateRow(['channel' => 'B2B', 'rate_type' => 'B2B', 'price' => '120.00'])];

    expect(RateResolver::pick($rates, '2026-10-01', ['Adulto'], 'B2B')['price'])->toBe('120.00')
        ->and(RateResolver::pick($rates, '2026-10-01', ['Adulto'], 'E-commerce')['price'])->toBe('135.00')
        ->and(RateResolver::pick([rateRow(['price' => '140.00'])], '2026-10-01', ['Adulto'], 'Corporativo')['price'])->toBe('140.00')
        ->and(RateResolver::pick([rateRow(['channel' => 'B2B'])], '2026-10-01', ['Adulto'], 'E-commerce'))->toBeNull();
});

it('nunca usa como precio de venta una tarifa de costo o de proveedor, ni una inactiva o fuera de vigencia', function () {
    $rates = [
        rateRow(['rate_type' => 'Costo', 'price' => '60.00']),
        rateRow(['rate_type' => 'Proveedor', 'price' => '55.00']),
        rateRow(['status' => 'inactiva', 'price' => '90.00']),
        rateRow(['valid_to' => '2026-09-30', 'price' => '95.00']),
        rateRow(['price' => '140.00']),
    ];

    expect(RateResolver::pick($rates, '2026-10-05', ['Adulto'], 'Directo')['price'])->toBe('140.00')
        ->and(RateResolver::isSale(rateRow(['rate_type' => 'Costo'])))->toBeFalse();
});

it('entre tarifas válidas prefiere la de la temporada vigente, luego las de venta al público y, entre ellas, la más barata', function () {
    $rates = [
        rateRow(['price' => '345.00', 'season_id' => 'media']),
        rateRow(['price' => '395.00', 'season_id' => 'alta']),
        rateRow(['rate_type' => 'Especial', 'price' => '300.00']),
        rateRow(['rate_type' => 'Promocional', 'price' => '330.00']),
    ];

    expect(RateResolver::pick($rates, '2026-07-10', ['Adulto'], 'Directo', 'alta')['price'])->toBe('395.00')
        ->and(RateResolver::pick($rates, '2026-10-10', ['Adulto'], 'Directo')['price'])->toBe('330.00');
});

it('respeta el orden de los segmentos pedidos: Adulto antes que Pasajero', function () {
    $rates = [rateRow(['segment' => 'Pasajero', 'price' => '80.00']), rateRow(['price' => '100.00'])];

    expect(RateResolver::pick($rates, '2026-10-01', ['Adulto', 'Pasajero'], 'Directo')['price'])->toBe('100.00')
        ->and(RateResolver::pick([rateRow(['segment' => 'Pasajero', 'price' => '80.00'])], '2026-10-01', ['Adulto', 'Pasajero'], 'Directo')['price'])->toBe('80.00');
});

it('spec 16 §6 paso 2: el precio de la tarifa se multiplica por el factor de la temporada de la fecha, sin factor si R-SEASON no aplica', function () {
    $alta = rateRow(['price' => '360.00', 'season_id' => 'alta', 'season_factor' => '1.20']);

    expect((string) RateResolver::seasonal($alta, '1.20')->toScale(2))->toBe('432.00')
        ->and((string) RateResolver::seasonal(rateRow(['price' => '140.00']), '0.88')->toScale(2))->toBe('123.20')
        ->and((string) RateResolver::seasonal($alta, null)->toScale(2))->toBe('360.00');
});
