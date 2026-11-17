<?php

use App\Domain\Admin\Support\PriceTax;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;

function pr16Currency(array $values): void
{
    withinTenant(tenantA(), function () use ($values): void {
        $current = (array) json_decode((string) DB::table('sys_settings')->where('section', 'currency')->value('values'), true);
        DB::table('sys_settings')->updateOrInsert(['tenant_id' => tenantA()->getKey(), 'section' => 'currency'], ['values' => json_encode([...$current, ...$values])]);
    });
}

function pr16QuoteBody(array $overrides = []): array
{
    $date = (string) departureRow('SAL-0403')->departure_date;

    return [
        'client_code' => 'CLI-0003',
        'title' => 'Laguna Humantay',
        'currency' => 'PEN',
        'travel_from' => $date,
        'travel_to' => $date,
        'pax_adt' => 2,
        'tax_pct' => 18,
        'items' => [['product_code' => 'CUS-HUM-FD', 'date' => $date, 'qty' => 1, 'pax' => 2, 'segment' => 'Adulto']],
        ...$overrides,
    ];
}

function pr16Direct(): array
{
    return ['step' => 2, 'client_id' => 'CLI-0003', 'product_id' => 'CUS-HUM-FD', 'adt' => 2, 'departure_id' => departureRow('SAL-0403')->id, 'channel' => 'Directo'];
}

function pr16SiteDate(): string
{
    for ($offset = 2; $offset < 30; $offset++) {
        $date = date('Y-m-d', strtotime(BUSINESS_TODAY." +{$offset} days"));
        if (test()->postJson('/api/v1/public/price-quote', ['product' => 'laguna-humantay-full-day', 'date' => $date, 'adults' => 2], siteOf())->status() === 200) {
            return $date;
        }
    }

    throw new RuntimeException('Humantay no tiene una fecha vendible.');
}

beforeEach(function () {
    lockSeededBookings();
    Queue::fake();
    freezeBusinessToday();
});

it('O5: el servicio de impuestos desglosa desde adentro o suma encima según price_with_tax', function () {
    expect(PriceTax::view(PriceTax::split('280', '18', true)))->toMatchArray(['taxable' => '237.29', 'tax' => '42.71', 'total' => '280.00', 'included' => true])
        ->and(PriceTax::view(PriceTax::split('280', '18', false)))->toMatchArray(['taxable' => '280.00', 'tax' => '50.40', 'total' => '330.40', 'included' => false]);
});

it('O5: Humantay en cotización con IGV incluido da 280.00 = 237.29 + 42.71 y el margen se calcula sobre el neto sin IGV', function () {
    actingAsSeed('U01');
    pr16Currency(['price_with_tax' => true, 'rounding' => '0.01']);

    $totals = $this->postJson('/api/v1/quotes/pricing/preview', pr16QuoteBody())->assertOk()->json('data.totals');

    expect($totals['grand_total'])->toBe('280.00')
        ->and($totals['net_total'])->toBe('237.29')
        ->and($totals['tax_total'])->toBe('42.71')
        ->and($totals['tax_included'])->toBeTrue();

    if ($totals['cost_total'] !== null) {
        $expected = bcdiv(bcmul(bcsub('237.29', $totals['cost_total'], 2), '100', 6), '237.29', 2);
        expect(abs((float) $totals['margin_pct'] - (float) $expected))->toBeLessThan(0.011);
    }

    $code = $this->postJson('/api/v1/quotes', pr16QuoteBody())->assertCreated()->json('data.code');
    $version = $this->getJson("/api/v1/quotes/{$code}")->assertOk()->json('data.versions.0');
    expect($version['totals']['grand'])->toBe('280.00')->and($version['totals']['tax_included'])->toBeTrue();
});

it('O5: Humantay en cotización con el interruptor apagado suma el IGV encima (330.40)', function () {
    actingAsSeed('U01');
    pr16Currency(['price_with_tax' => false, 'rounding' => '0.01']);

    $totals = $this->postJson('/api/v1/quotes/pricing/preview', pr16QuoteBody())->assertOk()->json('data.totals');

    expect($totals['grand_total'])->toBe('330.40')
        ->and($totals['net_total'])->toBe('280.00')
        ->and($totals['tax_total'])->toBe('50.40')
        ->and($totals['tax_included'])->toBeFalse();
});

it('O5: la reserva directa de Humantay usa el mismo servicio de impuestos (280.00 encendido, 330.40 apagado)', function () {
    actingAsSeed('U01');
    pr16Currency(['price_with_tax' => true, 'rounding' => '0.01']);

    $on = $this->postJson('/api/v1/reservations/availability-check', pr16Direct())->assertOk()->json('data');
    expect($on['total'])->toBe('280.00')
        ->and($on['tax'])->toMatchArray(['taxable' => '237.29', 'tax' => '42.71', 'included' => true]);

    pr16Currency(['price_with_tax' => false]);
    $off = $this->postJson('/api/v1/reservations/availability-check', pr16Direct())->assertOk()->json('data');
    expect($off['subtotal'])->toBe('280.00')->and($off['total'])->toBe('330.40');

    $body = array_diff_key(pr16Direct(), ['step' => true]);
    $code = $this->postJson('/api/v1/reservations', $body, ['Idempotency-Key' => idem('pr16-direct-off')])->assertCreated()->json('data.code');
    expect((string) reservationRow($code)->total_amount)->toBe('330.40');
});

it('O5: el sitio desglosa el IGV del precio final y, apagado, lo suma como ajuste del total', function () {
    pr16Currency(['price_with_tax' => true, 'rounding' => '0.01']);
    $date = pr16SiteDate();

    $on = $this->postJson('/api/v1/public/price-quote', ['product' => 'laguna-humantay-full-day', 'date' => $date, 'adults' => 2], siteOf())->assertOk()->json('data');
    $split = PriceTax::view(PriceTax::split($on['total'], '18', true));
    expect($on['tax'])->toMatchArray(['included' => true, 'taxable' => $split['taxable'], 'tax' => $split['tax']])
        ->and(collect($on['adjustments'])->pluck('key'))->not->toContain('tax');

    pr16Currency(['price_with_tax' => false]);
    $off = $this->postJson('/api/v1/public/price-quote', ['product' => 'laguna-humantay-full-day', 'date' => $date, 'adults' => 2], siteOf())->assertOk()->json('data');
    expect($off['total'])->toBe(PriceTax::view(PriceTax::split($on['total'], '18', false))['total'])
        ->and(collect($off['adjustments'])->firstWhere('key', 'tax')['label'])->toBe('IGV (18 %)');
});

it('O5: el redondeo de la agencia se aplica al precio por persona de la tarifa en cotización y reserva directa, nunca al precio manual', function () {
    actingAsSeed('U01');
    pr16Currency(['price_with_tax' => true, 'rounding' => '50', 'round_mode' => 'up']);

    $line = $this->postJson('/api/v1/quotes/pricing/preview', pr16QuoteBody())->assertOk()->json('data.lines.0');
    expect($line['unit_price'])->toBe('150.00')->and($line['price_source'])->toBe('rate');

    $manual = pr16QuoteBody(['items' => [[...pr16QuoteBody()['items'][0], 'unit_price' => '141.30']]]);
    expect($this->postJson('/api/v1/quotes/pricing/preview', $manual)->assertOk()->json('data.lines.0.unit_price'))->toBe('141.30');

    $direct = $this->postJson('/api/v1/reservations/availability-check', pr16Direct())->assertOk()->json('data');
    expect($direct['adult_price'])->toBe('150.00')->and($direct['total'])->toBe('300.00');
});
