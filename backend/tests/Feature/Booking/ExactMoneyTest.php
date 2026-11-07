<?php

function halfUp(string $value): string
{
    return bccomp($value, '0', 6) >= 0 ? bcadd($value, '0.005', 2) : bcsub($value, '0.005', 2);
}

beforeEach(fn () => freezeBusinessToday());

it('la cotización del sitio devuelve montos exactos en texto y aplica la promoción por cantidad', function () {
    $quote = $this->postJson('/api/v1/public/price-quote', ['product' => 'laguna-humantay-full-day', 'date' => '2026-10-02', 'adults' => 4], siteOf())->assertOk()->json('data');
    $line = collect($quote['lines'])->firstWhere('key', 'adults');

    expect($line['unit'])->toMatch('/^\d+\.\d{2}$/')
        ->and($line['amount'])->toBe(bcmul($line['unit'], '4', 2))
        ->and($quote['subtotal'])->toBe($line['amount'])
        ->and($quote['discount']['amount'])->toBe(halfUp(bcdiv(bcmul($quote['subtotal'], '10', 6), '100', 6)))
        ->and($quote['total'])->toBe(bcsub($quote['subtotal'], $quote['discount']['amount'], 2));
});

it('el carrito suma las líneas sin perder céntimos', function () {
    $token = (string) $this->postJson('/api/v1/public/carts/current/items', ['product' => 'laguna-humantay-full-day', 'date' => '2026-10-02', 'adults' => 3], siteOf(extra: critical()))->assertCreated()->json('data.token');
    $this->withCredentials()->withUnencryptedCookie('ah_cart', $token)->postJson('/api/v1/public/carts/current/items', ['product' => 'laguna-humantay-full-day', 'date' => '2026-10-04', 'adults' => 5], siteOf(extra: critical()))->assertCreated();
    $cart = $this->withCredentials()->withUnencryptedCookie('ah_cart', $token)->getJson('/api/v1/public/carts/current', siteOf())->assertOk()->json('data');
    $sum = collect($cart['items'])->filter(fn (array $item): bool => $item['quote'] !== null && $item['quote']['currency'] === 'PEN')->reduce(fn (string $carry, array $item): string => bcadd($carry, $item['quote']['total'], 2), '0.00');

    expect($cart['items'])->toHaveCount(2)
        ->and(collect($cart['totals'])->firstWhere('currency', 'PEN')['total'])->toBe($sum);
});

it('la cotización B2B calcula neto, comisión y crédito con decimal exacto', function () {
    actingAsSeed('U13');

    $quote = $this->postJson('/api/v1/b2b/reservations/quote-price', ['product' => 'CUS-HUM-FD', 'date' => '2026-10-02', 'adults' => 3])->assertOk()->json('data');

    expect($quote['net_total'])->toBe(bcmul($quote['net_unit'], '3', 2))
        ->and($quote['commission'])->toBe(halfUp(bcdiv(bcmul($quote['net_total'], (string) $quote['commission_pct'], 6), '100', 6)))
        ->and($quote['credit']['after'])->toBe(bcsub($quote['credit']['available'], $quote['credit']['amount'], 2));
    if ($quote['pvp_total'] !== null) {
        expect($quote['margin'])->toBe(bcsub($quote['pvp_total'], $quote['net_total'], 2));
    }
});

it('la penalidad de cancelación cuadra al céntimo con lo pagado y el reembolso', function () {
    actingAsSeed('U01');

    $preview = $this->postJson('/api/v1/reservations/RES-2026-000348/cancellation/preview')->assertOk()->json('data');
    $penaltyServices = collect($preview['lines'])->reduce(fn (string $carry, array $line): string => bcadd($carry, $line['penalty'], 2), '0.00');

    expect($preview['penalty'])->toMatch('/^\d+\.\d{2}$/')
        ->and($preview['penalty_services'])->toBe($penaltyServices)
        ->and(bcsub($preview['refund'], $preview['owed'], 2))->toBe(bcsub($preview['paid'], $preview['penalty'], 2))
        ->and(bccomp($preview['penalty'], $preview['total'], 2))->toBeLessThanOrEqual(0);
    if (collect($preview['lines'])->every(fn (array $line): bool => $line['pct'] === 100) && bccomp($preview['consumed'], '0', 2) === 0) {
        expect($preview['penalty'])->toBe($preview['total']);
    }
});
