<?php

use App\Domain\Booking\Rules\RuleResolver;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;

function pdtCurrency(): void
{
    withinTenant(tenantA(), function (): void {
        $current = (array) json_decode((string) DB::table('sys_settings')->where('section', 'currency')->value('values'), true);
        DB::table('sys_settings')->updateOrInsert(['tenant_id' => tenantA()->getKey(), 'section' => 'currency'], ['values' => json_encode([...$current, 'price_with_tax' => true, 'rounding' => '0.01'])]);
    });
}

function pdtRule(string $code, string $adjust, array $channels, array $extra = []): void
{
    withinTenant(tenantA(), fn () => DB::table('catalog_dynamic_price_rules')->insert([
        'id' => (string) Str::uuid7(),
        'code' => $code,
        'name' => $extra['name'] ?? "Regla {$code}",
        'basis' => 'dia_semana',
        'conditions' => json_encode(['weekdays' => [1, 2, 3, 4, 5, 6, 7]]),
        'adjust_pct' => $adjust,
        'floor_pct' => $extra['floor_pct'] ?? '-30',
        'ceiling_pct' => $extra['ceiling_pct'] ?? '50',
        'priority' => $extra['priority'] ?? 10,
        'channels' => '{'.implode(',', $channels).'}',
        'active' => true,
    ]));
}

function pdtDate(): string
{
    return (string) departureRow('SAL-0403')->departure_date;
}

function pdtQuote(): array
{
    return [
        'client_code' => 'CLI-0003',
        'title' => 'Laguna Humantay',
        'currency' => 'PEN',
        'travel_from' => pdtDate(),
        'travel_to' => pdtDate(),
        'pax_adt' => 2,
        'tax_pct' => 18,
        'items' => [['product_code' => 'CUS-HUM-FD', 'date' => pdtDate(), 'qty' => 1, 'pax' => 2, 'segment' => 'Adulto']],
    ];
}

function pdtDirect(): array
{
    return ['client_id' => 'CLI-0003', 'product_id' => 'CUS-HUM-FD', 'adt' => 2, 'departure_id' => departureRow('SAL-0403')->id, 'channel' => 'Directo'];
}

function pdtTimes(string $amount, string $factor): string
{
    return bcadd(bcmul($amount, $factor, 4), '0.005', 2);
}

beforeEach(function () {
    lockSeededBookings();
    Queue::fake();
    freezeBusinessToday();
    pdtCurrency();
    withinTenant(tenantA(), fn () => DB::table('catalog_dynamic_price_rules')->update(['active' => false]));
});

it('SC-12: la cotización aplica la regla dinámica, muestra cuál se usó y la conserva en el snapshot aunque la regla cambie', function () {
    actingAsSeed('U01');
    $base = $this->postJson('/api/v1/quotes/pricing/preview', pdtQuote())->assertOk()->json('data.lines.0');
    expect($base['pricing'])->toBeNull();

    pdtRule('PDN-T01', '20.00', ['interno'], ['name' => 'Alta demanda interna']);

    $line = $this->postJson('/api/v1/quotes/pricing/preview', pdtQuote())->assertOk()->json('data.lines.0');
    expect($line['unit_price'])->toBe(pdtTimes($base['unit_price'], '1.20'))
        ->and($line['price_source'])->toBe('rate')
        ->and($line['pricing']['dynamic']['pct'])->toBe('20.00')
        ->and($line['pricing']['dynamic']['rules'][0]['code'])->toBe('PDN-T01')
        ->and($line['pricing']['dynamic']['label'])->toBe('Alta demanda interna (+20 %)');

    $code = $this->postJson('/api/v1/quotes', pdtQuote())->assertCreated()->json('data.code');
    withinTenant(tenantA(), fn () => DB::table('catalog_dynamic_price_rules')->where('code', 'PDN-T01')->update(['active' => false, 'adjust_pct' => '-10.00']));

    $item = $this->getJson("/api/v1/quotes/{$code}")->assertOk()->json('data.versions.0.items.0');
    expect($item['unit_price'])->toBe($line['unit_price'])
        ->and($item['pricing']['dynamic']['pct'])->toBe('20.00')
        ->and($item['pricing']['dynamic']['rules'][0]['name'])->toBe('Alta demanda interna');

    expect($this->postJson('/api/v1/quotes/pricing/preview', pdtQuote())->assertOk()->json('data.lines.0.unit_price'))->toBe($base['unit_price']);
});

it('SC-12: el ajuste acumulado de varias reglas queda dentro del techo', function () {
    actingAsSeed('U01');
    $base = $this->postJson('/api/v1/quotes/pricing/preview', pdtQuote())->assertOk()->json('data.lines.0.unit_price');

    pdtRule('PDN-T02', '40.00', ['interno'], ['priority' => 10, 'ceiling_pct' => '50']);
    pdtRule('PDN-T03', '30.00', ['interno'], ['priority' => 20]);

    $line = $this->postJson('/api/v1/quotes/pricing/preview', pdtQuote())->assertOk()->json('data.lines.0');
    expect($line['unit_price'])->toBe(pdtTimes($base, '1.50'))
        ->and($line['pricing']['dynamic']['pct'])->toBe('50.00')
        ->and($line['pricing']['dynamic']['clamped'])->toBeTrue()
        ->and(collect($line['pricing']['dynamic']['rules'])->pluck('code')->all())->toBe(['PDN-T02', 'PDN-T03']);
});

it('SC-12: una regla solo para agencias no cambia la cotización y el precio manual no lleva ajuste', function () {
    actingAsSeed('U01');
    $base = $this->postJson('/api/v1/quotes/pricing/preview', pdtQuote())->assertOk()->json('data.lines.0.unit_price');

    pdtRule('PDN-T04', '10.00', ['b2b']);
    expect($this->postJson('/api/v1/quotes/pricing/preview', pdtQuote())->assertOk()->json('data.lines.0.unit_price'))->toBe($base);

    pdtRule('PDN-T05', '10.00', ['interno']);
    $manual = pdtQuote();
    $manual['items'][0]['unit_price'] = '99.90';
    $line = $this->postJson('/api/v1/quotes/pricing/preview', $manual)->assertOk()->json('data.lines.0');
    expect($line['unit_price'])->toBe('99.90')->and($line['price_source'])->toBe('manual')->and($line['pricing'])->toBeNull();
});

it('SC-12: sin la regla R-DYNAMIC-PRICING del plan no se aplica ningún ajuste', function () {
    actingAsSeed('U01');
    $base = $this->postJson('/api/v1/quotes/pricing/preview', pdtQuote())->assertOk()->json('data.lines.0.unit_price');
    pdtRule('PDN-T06', '25.00', ['interno']);
    withinTenant(tenantA(), function (): void {
        DB::table('sys_booking_rules')->where('code', 'R-DYNAMIC-PRICING')->update(['enabled' => false]);
        RuleResolver::invalidate((string) tenantA()->getKey());
    });

    $line = $this->postJson('/api/v1/quotes/pricing/preview', pdtQuote())->assertOk()->json('data.lines.0');
    expect($line['unit_price'])->toBe($base)->and($line['pricing'])->toBeNull();
});

it('CAT-BR-18: la temporada de la fecha multiplica la tarifa y la cotización dice cuál se aplicó', function () {
    actingAsSeed('U01');
    $base = $this->postJson('/api/v1/quotes/pricing/preview', pdtQuote())->assertOk()->json('data.lines.0.unit_price');
    withinTenant(tenantA(), fn () => DB::table('catalog_seasons')->insert([
        'id' => (string) Str::uuid7(), 'ref' => 'TMP-T1', 'name' => 'Feria de prueba', 'type' => 'Fecha especial',
        'date_from' => pdtDate(), 'date_to' => pdtDate(), 'priority' => 0, 'factor' => '1.25', 'status' => 'activa',
    ]));

    $line = $this->postJson('/api/v1/quotes/pricing/preview', pdtQuote())->assertOk()->json('data.lines.0');
    expect($line['unit_price'])->toBe(pdtTimes($base, '1.25'))
        ->and($line['season_factor'])->toBe('1.25')
        ->and($line['pricing']['season']['ref'])->toBe('TMP-T1')
        ->and($line['pricing']['season']['label'])->toBe('Feria de prueba ×1.25')
        ->and($line['pricing']['dynamic'])->toBeNull();
});

it('SC-12: la reserva directa aplica la regla del canal y guarda el ajuste en su snapshot', function () {
    actingAsSeed('U01');
    $base = $this->postJson('/api/v1/reservations/availability-check', [...pdtDirect(), 'step' => 2])->assertOk()->json('data');
    pdtRule('PDN-T07', '10.00', ['interno'], ['name' => 'Fin de semana largo']);

    $plan = $this->postJson('/api/v1/reservations/availability-check', [...pdtDirect(), 'step' => 2])->assertOk()->json('data');
    expect($plan['adult_price'])->toBe(pdtTimes($base['adult_price'], '1.10'))
        ->and($plan['subtotal'])->toBe(bcmul($plan['adult_price'], '2', 2))
        ->and($plan['pricing']['dynamic']['label'])->toBe('Fin de semana largo (+10 %)');

    $code = $this->postJson('/api/v1/reservations', pdtDirect(), ['Idempotency-Key' => idem('pdt-direct')])->assertCreated()->json('data.code');
    $snapshot = json_decode((string) reservationRow($code)->catalog_snapshot, true);
    expect($snapshot['adult_price'])->toBe($plan['adult_price'])
        ->and($snapshot['rate']['dynamic']['pct'])->toBe('10.00')
        ->and($snapshot['rate']['dynamic']['rules'][0]['code'])->toBe('PDN-T07');
});

it('portal B2B: el neto sale del motor con la regla de agencias y la reserva conserva el ajuste', function () {
    actingAsSeed('U13');
    $body = ['product' => 'CUS-HUM-FD', 'date' => '2026-10-06', 'adults' => 2];
    $base = $this->postJson('/api/v1/b2b/reservations/quote-price', $body)->assertOk()->json('data');
    expect($base['net_unit'])->toBe($base['net_list'])->and($base['pricing'])->toBeNull();

    pdtRule('PDN-T08', '10.00', ['b2b'], ['name' => 'Recargo de agencias']);
    pdtRule('PDN-T09', '30.00', ['interno']);

    $quote = $this->postJson('/api/v1/b2b/reservations/quote-price', $body)->assertOk()->json('data');
    expect($quote['net_unit'])->toBe(pdtTimes($base['net_list'], '1.10'))
        ->and($quote['net_total'])->toBe(bcmul($quote['net_unit'], '2', 2))
        ->and($quote['pvp_total'])->toBe($base['pvp_total'])
        ->and($quote['pricing']['dynamic']['rules'][0]['code'])->toBe('PDN-T08');

    $card = collect($this->getJson('/api/v1/b2b/catalog')->assertOk()->json('data.products'))->firstWhere('code', 'CUS-HUM-FD');
    expect($card['net_list'])->toBe($base['net_list'])->and($card['net'])->toBe(pdtTimes($base['net_list'], '1.10'));

    $code = (string) $this->postJson('/api/v1/b2b/reservations', [...$body, 'pay_mode' => 'prepago', 'agency_ref' => 'PDT-1'], critical())->assertOk()->json('data.code');
    $row = reservationRow($code);
    $snapshot = json_decode((string) $row->catalog_snapshot, true);
    expect((string) $row->total_amount)->toBe($quote['net_total'])
        ->and($snapshot['net_unit'])->toBe($quote['net_unit'])
        ->and($snapshot['net_list'])->toBe($base['net_list'])
        ->and($snapshot['pricing']['dynamic']['pct'])->toBe('10.00');
});
