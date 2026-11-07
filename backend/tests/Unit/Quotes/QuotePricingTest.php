<?php

use App\Domain\Quotes\Actions\QuoteLifecycle;
use App\Domain\Quotes\Support\QuotePricing;

it('calcula los totales de la versión con decimales exactos', function () {
    $totals = QuotePricing::totals([['unit_cost' => '10.10', 'unit_price' => '33.33', 'qty' => 3, 'pax' => 1]], '5', '18');

    expect($totals)->toBe([
        'cost_total' => '30.30',
        'sale_total' => '99.99',
        'discount_total' => '5.00',
        'net_total' => '94.99',
        'tax_total' => '17.10',
        'grand_total' => '112.09',
        'profit_total' => '64.69',
        'margin_pct' => '68.10',
    ]);
});

it('no pierde céntimos al sumar muchas líneas de 0.10', function () {
    $items = array_fill(0, 30, ['unit_cost' => '0.00', 'unit_price' => '0.10', 'qty' => 1, 'pax' => 1]);

    expect(QuotePricing::totals($items, '0', '0')['sale_total'])->toBe('3.00');
});

it('QTE-BR-11: descuento sobre 5 % o margen bajo 15 % piden aprobación interna', function (string $discount, string $margin, bool $expected) {
    expect(QuoteLifecycle::needsInternalApproval($discount, $margin))->toBe($expected);
})->with([
    'sin excepción' => ['5', '15', false],
    'descuento alto' => ['5.01', '30', true],
    'margen bajo' => ['0', '14.99', true],
]);
