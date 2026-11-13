<?php

use App\Domain\Booking\Rules\RuleResolver;
use Illuminate\Support\Facades\DB;

beforeEach(fn () => freezeBusinessToday());

function pbSlug(): string
{
    return (string) withinTenant(tenantA(), fn () => DB::table('catalog_products')->where('code', 'CUS-HUM-FD')->value('slug'));
}

function pbDate(int $adults = 2): string
{
    foreach (['2026-10', '2026-11'] as $month) {
        foreach (test()->getJson('/api/v1/public/products/'.pbSlug()."/calendar?mes={$month}&viajeros={$adults}", siteOf())->assertOk()->json('data.days') as $day) {
            if ($day['sellable'] && $day['date'] >= '2026-10-01' && $day['date'] <= '2026-10-31') {
                return $day['date'];
            }
        }
    }

    throw new RuntimeException('Sin fecha vendible para Humantay en octubre.');
}

function pbQuote(string $date, int $adults, ?string $promo = null): array
{
    return test()->postJson('/api/v1/public/price-quote', array_filter(['product' => pbSlug(), 'date' => $date, 'adults' => $adults, 'promo' => $promo]), siteOf())->assertOk()->json('data');
}

function pbBuyer(): array
{
    return ['name' => 'Rosa Quispe Mamani', 'email' => 'rosa.quispe@reservas.pe', 'phone' => '+51 955 111 222', 'country' => 'Perú', 'doc_type' => 'DNI', 'doc_number' => '45678912', 'billing_type' => 'Boleta'];
}

function pbRule(string $code, bool $on): void
{
    withinTenant(tenantA(), function () use ($code, $on): void {
        DB::table('sys_booking_rules')->where('code', $code)->update(['enabled' => $on]);
        RuleResolver::invalidate((string) tenantA()->getKey());
    });
}

it('R-PROMO: la promoción del sitio la aplica el motor sobre el subtotal, y el sitio y el motor dan el mismo total', function () {
    $date = pbDate(4);
    $site = pbQuote($date, 4);
    $engine = $this->postJson('/api/v1/public/quote', ['product' => pbSlug(), 'date' => $date, 'pax' => ['adt' => 4]], siteOf())->assertOk()->json('data');
    $promo = collect($engine['adjustments'])->firstWhere('key', 'promo');

    expect($promo)->not->toBeNull()
        ->and($promo['label'])->toBe('Grupo 4+')
        ->and($promo['amount'])->toBe(bcsub('0', bcdiv(bcmul($engine['subtotal'], '10', 4), '100', 2), 2))
        ->and($site['discount']['label'])->toBe('Grupo 4+')
        ->and($engine['total'])->toBe($site['total']);
});

it('con R-PROMO apagada ni el sitio ni el motor descuentan', function () {
    pbRule('R-PROMO', false);
    $date = pbDate(4);

    $site = pbQuote($date, 4);
    $engine = $this->postJson('/api/v1/public/quote', ['product' => pbSlug(), 'date' => $date, 'pax' => ['adt' => 4]], siteOf())->assertOk()->json('data');

    expect($site['discount'])->toBeNull()
        ->and(collect($engine['adjustments'])->firstWhere('key', 'promo'))->toBeNull()
        ->and($engine['total'])->toBe($site['total']);
});

it('el redondeo de la agencia se aplica igual en el sitio y en el motor: lo que se muestra es lo que se cobra', function () {
    withinTenant(tenantA(), fn () => DB::table('catalog_seasons')->insert(['ref' => 'TMP-OCT', 'name' => 'Octubre de prueba', 'type' => 'Baja', 'date_from' => '2026-10-01', 'date_to' => '2026-10-31', 'priority' => 1, 'factor' => '0.88']));
    $date = pbDate();

    $site = pbQuote($date, 2);
    $engine = $this->postJson('/api/v1/public/quote', ['product' => pbSlug(), 'date' => $date, 'pax' => ['adt' => 2]], siteOf())->assertOk()->json('data');
    $line = collect($site['lines'])->firstWhere('key', 'adults');

    expect($line['unit'])->toBe('113.50')
        ->and($line['amount'])->toBe('227.00')
        ->and($engine['total'])->toBe($site['total']);
});

it('POST /public/bookings crea el hold y la reserva pendiente de pago con el total cotizado, y el reintento no la duplica', function () {
    $date = pbDate();
    $quote = pbQuote($date, 2);
    $body = ['quote_token' => $quote['quote_token'], 'product' => pbSlug(), 'date' => $date, 'adults' => 2, ...pbBuyer(), 'passengers' => webTravelers(2), 'pay_mode' => 'total', 'method' => 'yape', 'operation_ref' => 'YP-700100', 'terms' => true, 'privacy' => true];
    $key = idem();

    $first = $this->postJson('/api/v1/public/bookings', $body, siteOf(extra: critical(key: $key)))->assertCreated()->json('data');
    $again = $this->postJson('/api/v1/public/bookings', $body, siteOf(extra: critical(key: $key)))->json('data');

    $order = withinTenant(tenantA(), fn () => DB::table('channel_ecom_orders')->where('code', $first['code'])->first());
    $reservation = withinTenant(tenantA(), fn () => DB::table('booking_reservations')->where('ecom_order_id', $order->id)->first());

    expect($again['code'])->toBe($first['code'])
        ->and($order->total)->toBe($quote['total'])
        ->and($reservation->status)->toBe('pendiente_pago')
        ->and(withinTenant(tenantA(), fn () => DB::table('channel_ecom_orders')->where('customer_email', 'rosa.quispe@reservas.pe')->count()))->toBe(1);
});

it('POST /public/bookings rechaza si el precio cambió, si la fecha ya no tiene cupo o si falta la cotización', function () {
    $date = pbDate();
    $quote = pbQuote($date, 2);
    $base = [...pbBuyer(), 'product' => pbSlug(), 'passengers' => webTravelers(3), 'pay_mode' => 'total', 'method' => 'yape', 'operation_ref' => 'YP-700200', 'terms' => true, 'privacy' => true];

    expect($this->postJson('/api/v1/public/bookings', [...$base, 'quote_token' => $quote['quote_token'], 'date' => $date, 'adults' => 3], siteOf(extra: critical())))->toBeApiError(409, 'QUOTE_CHANGED')
        ->and($this->postJson('/api/v1/public/bookings', [...$base, 'quote_token' => $quote['quote_token'], 'date' => '2026-09-20', 'adults' => 3], siteOf(extra: critical())))->toBeApiError(409, 'AVAIL_CHANGED');

    $this->postJson('/api/v1/public/bookings', [...$base, 'date' => $date, 'adults' => 3], siteOf(extra: critical()))->assertStatus(422)->assertJsonValidationErrors('quote_token');
});
