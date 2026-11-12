<?php

use App\Domain\Booking\Rules\RuleResolver;
use App\Domain\Site\Support\SiteAltitude;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use Illuminate\Testing\TestResponse;

beforeEach(function () {
    $this->withoutMiddleware(ThrottleRequests::class);
    Queue::fake();
});

function altitudeRule(bool $on, int $min = 3300): void
{
    withinTenant(tenantA(), function () use ($on, $min) {
        DB::table('sys_booking_rules')->where('code', 'R-ALTITUDE')->update(['enabled' => $on, 'params' => json_encode(['minAltitude' => $min])]);
        RuleResolver::invalidate((string) tenantA()->getKey());
    });
}

function altitudeCart(): string
{
    $slug = (string) withinTenant(tenantA(), fn () => DB::table('catalog_products')->where('code', 'CUS-PKG-5D4N')->value('slug'));
    foreach (['2026-11', '2026-12', '2027-01'] as $month) {
        foreach (test()->getJson("/api/v1/public/products/{$slug}/calendar?mes={$month}&viajeros=2", siteOf())->assertOk()->json('data.days') as $day) {
            if ($day['sellable']) {
                return (string) test()->postJson('/api/v1/public/carts/current/items', ['product' => $slug, 'date' => $day['date'], 'adults' => 2], siteOf(extra: critical()))->assertCreated()->json('data.token');
            }
        }
    }

    throw new RuntimeException('Sin fecha vendible');
}

function altitudePost(string $token, string $path, array $body): TestResponse
{
    return test()->withCredentials()->withUnencryptedCookie('ah_cart', $token)->postJson("/api/v1/public/{$path}", $body, siteOf(extra: critical()));
}

function altitudeOrder(string $token, array $extra = []): TestResponse
{
    return altitudePost($token, 'checkout/orders', [
        'name' => 'Rosa Quispe Huamán', 'email' => 'rosa.altura@checkout.pe', 'phone' => '+51 955 111 333', 'country' => 'Perú', 'doc_type' => 'DNI', 'doc_number' => '44556678', 'billing_type' => 'Boleta',
        'passengers' => webTravelers(2), 'pay_mode' => 'total', 'method' => 'transferencia', 'operation_ref' => 'OP-778899', 'terms' => true, 'privacy' => true, ...$extra,
    ]);
}

it('lee la altitud en metros del texto del destino', function () {
    expect(SiteAltitude::meters('3 399 m s. n. m.'))->toBe(3399)
        ->and(SiteAltitude::meters('100–200 m s. n. m.'))->toBe(100)
        ->and(SiteAltitude::meters('Nivel del mar'))->toBe(0);
});

it('R-ALTITUDE apagada: el checkout no pide la declaración', function () {
    altitudeRule(false);
    $terms = altitudePost(altitudeCart(), 'checkout/validate', [])->assertOk()->json('data.terms');

    expect($terms['altitude'])->toBe([]);
});

it('R-ALTITUDE encendida: exige la declaración y la guarda en el snapshot y en los consentimientos', function () {
    altitudeRule(true);
    $token = altitudeCart();
    $terms = altitudePost($token, 'checkout/validate', [])->assertOk()->json('data.terms');

    expect($terms['altitude'])->not->toBeEmpty()->and($terms['altitude'][0]['max_altitude'])->toBeGreaterThanOrEqual(3300);
    expect(altitudeOrder($token))->toBeApiError(422);

    $code = altitudeOrder($token, ['altitude_accepted' => true])->assertCreated()->json('data.code');
    [$snapshot, $consents] = withinTenant(tenantA(), fn () => [
        DB::table('booking_reservation_web_snapshots')->where('order_code', $code)->value('altitude_declaration'),
        DB::table('channel_ecom_orders')->where('code', $code)->value('consents'),
    ]);

    expect(json_decode((string) $snapshot, true))->toMatchArray(['accepted' => true, 'min_altitude' => 3300])
        ->and(json_decode((string) $consents, true)['altitude_at'])->not->toBeNull();
});
