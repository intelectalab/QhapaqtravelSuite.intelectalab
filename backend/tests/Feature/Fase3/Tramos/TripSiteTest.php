<?php

use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;

beforeEach(function () {
    $this->withoutMiddleware(ThrottleRequests::class);
    Queue::fake();
});

function tramosSlug(): string
{
    return (string) withinTenant(tenantA(), fn () => DB::table('catalog_products')->where('code', 'PER-CIR-10D')->value('slug'));
}

function tramosDate(string $slug): string
{
    foreach (['2026-10', '2026-11', '2026-12'] as $month) {
        foreach (test()->getJson("/api/v1/public/products/{$slug}/calendar?mes={$month}&viajeros=2", siteOf())->assertOk()->json('data.days') as $day) {
            if ($day['sellable']) {
                return $day['date'];
            }
        }
    }

    throw new RuntimeException('Sin fecha vendible para el circuito');
}

function tramosExtras(): array
{
    return [
        'lodging' => [['leg_id' => 'LEG-4', 'hotel_id' => 'H-CUS-3', 'rooms' => [['type' => 'Doble', 'qty' => 1]]]],
        'nights' => ['LEG-4' => 5],
        'tours' => [['id' => 'TT-CUS-2']],
        'transport' => [['id' => 'TR-LIM-AQP-B'], ['id' => 'TR-LIM-AQP-V']],
    ];
}

it('la ficha pública trae noches por ciudad, tours y movilidad por tramo', function () {
    $slug = tramosSlug();
    $trip = $this->getJson("/api/v1/public/products/{$slug}", siteOf())->assertOk()->json('data.booking.trip');
    $cusco = collect($trip['legs'])->firstWhere('id', 'LEG-4');

    expect($trip['legs'])->toHaveCount(4)
        ->and($cusco['min_nights'])->toBe(3)
        ->and($cusco['max_nights'])->toBe(6)
        ->and(collect($cusco['tours'])->pluck('id')->all())->toContain('TT-CUS-2')
        ->and(collect(collect($trip['legs'])->firstWhere('id', 'LEG-2')['arrivals'])->pluck('id')->all())->toContain('TR-LIM-AQP-V', 'TR-LIM-AQP-B');
});

it('el sitio cotiza con el motor: noche extra en Cusco, Valle Sagrado y solo el vuelo Lima → Arequipa, con gasto por categoría', function () {
    $slug = tramosSlug();
    $date = tramosDate($slug);
    $quote = $this->postJson('/api/v1/public/price-quote', ['product' => $slug, 'date' => $date, 'adults' => 2, ...tramosExtras()], siteOf(extra: critical()))->assertOk()->json('data');
    $kinds = collect($quote['lines'])->pluck('key')->all();
    $sum = collect($quote['by_category'])->reduce(fn ($carry, $amount) => bcadd($carry, (string) $amount, 2), '0');

    expect($kinds)->toContain('tour-TT-CUS-2', 'trans-TR-LIM-AQP-V')
        ->and($kinds)->not->toContain('trans-TR-LIM-AQP-B')
        ->and(collect($quote['legs'])->firstWhere('leg_id', 'LEG-4')['nights'])->toBe(5)
        ->and($quote['trip_end'])->not->toBeNull()
        ->and($sum)->toBe(bcadd((string) $quote['subtotal'], '0', 2))
        ->and($quote['extras']['transport'])->toBe(['TR-LIM-AQP-V']);
});

it('TB-08: el carrito guarda el armado y al confirmar cada tour y movilidad queda como servicio con su tramo', function () {
    $slug = tramosSlug();
    $date = tramosDate($slug);
    $token = (string) $this->postJson('/api/v1/public/carts/current/items', ['product' => $slug, 'date' => $date, 'adults' => 2, ...tramosExtras()], siteOf(extra: critical()))->assertCreated()->json('data.token');
    $stored = withinTenant(tenantA(), fn () => json_decode((string) DB::table('channel_web_cart_items')->orderByDesc('created_at')->value('extras'), true));

    $data = $this->withCredentials()->withUnencryptedCookie('ah_cart', $token)->postJson('/api/v1/public/checkout/orders', [
        'name' => 'Lucía Benavides Ortiz', 'email' => 'lucia.tramos@checkout.pe', 'phone' => '+51 944 222 333', 'country' => 'Perú', 'doc_type' => 'DNI', 'doc_number' => '41236587', 'billing_type' => 'Boleta',
        'passengers' => webTravelers(2), 'lines' => [['line' => 1, 'pickup_point' => 'Hotel en Miraflores o Barranco', 'pickup_address' => 'Av. Larco 101, Miraflores']],
        'pay_mode' => 'total', 'method' => 'tarjeta', 'card_token' => 'tok_ok_1111', 'card_holder' => 'LUCIA BENAVIDES', 'terms' => true, 'privacy' => true,
    ], siteOf(extra: critical()))->assertCreated()->json('data');

    [$reservation, $legs, $items, $services] = withinTenant(tenantA(), function () use ($data): array {
        $order = DB::table('channel_ecom_orders')->where('code', $data['code'])->first();
        $reservation = DB::table('booking_reservations')->where('ecom_order_id', $order->id)->first();

        return [
            $reservation,
            DB::table('booking_trip_legs')->where('reservation_id', $reservation->id)->orderBy('sequence')->get(),
            DB::table('booking_trip_items')->where('reservation_id', $reservation->id)->get(),
            DB::table('booking_reservation_services')->where('reservation_id', $reservation->id)->get(),
        ];
    });

    expect($stored['tours'])->toBe(['TT-CUS-2'])
        ->and($stored['nights'])->toBe(['LEG-4' => 5])
        ->and($legs)->toHaveCount(4)
        ->and((int) $legs[3]->nights)->toBe(5)
        ->and($items)->toHaveCount(2)
        ->and($items->pluck('kind')->sort()->values()->all())->toBe(['tour', 'transporte'])
        ->and($items->every(fn ($item) => $item->reservation_service_id !== null))->toBeTrue()
        ->and($services)->toHaveCount(3)
        ->and(bcadd((string) $services->sum(fn ($s) => (float) $s->price_amount), '0', 2))->toBe(bcadd((string) $reservation->total_amount, '0', 2));
});
