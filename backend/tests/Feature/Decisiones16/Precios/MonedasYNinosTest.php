<?php

use App\Domain\Booking\Actions\TripBooking;
use App\Domain\Booking\Data\FxTable;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Site\Support\CheckoutRules;
use App\Domain\Site\Support\CheckoutTerms;
use App\Domain\Site\Support\SiteCurrency;
use Brick\Math\BigDecimal;
use Brick\Math\RoundingMode;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;

beforeEach(function () {
    $this->withoutMiddleware(ThrottleRequests::class);
    Queue::fake();
});

function pr16TripSlug(): string
{
    return (string) withinTenant(tenantA(), fn () => DB::table('catalog_products')->where('code', 'PER-CIR-10D')->value('slug'));
}

function pr16TripDate(string $slug): string
{
    foreach (['2026-10', '2026-11', '2026-12'] as $month) {
        foreach (test()->getJson("/api/v1/public/products/{$slug}/calendar?mes={$month}&viajeros=3", siteOf())->assertOk()->json('data.days') as $day) {
            if ($day['sellable']) {
                return $day['date'];
            }
        }
    }

    throw new RuntimeException('Sin fecha vendible para el circuito');
}

function pr16Vinicunca(int $fit): array
{
    $slug = pr16TripSlug();

    return ['product' => $slug, 'date' => pr16TripDate($slug), 'adults' => 2, 'children' => 1,
        'lodging' => [['leg_id' => 'LEG-4', 'hotel_id' => 'H-CUS-3', 'rooms' => [['type' => 'Doble', 'qty' => 1]]]],
        'tours' => [['id' => 'TT-CUS-1']], 'tour_children' => ['TT-CUS-1' => $fit]];
}

it('duda 4 (b): toda conversión a una moneda de cobro suma el margen de conversión', function () {
    $fx = FxTable::fromArray([['code' => 'PEN', 'rate' => '1'], ['code' => 'USD', 'rate' => '3.75'], ['code' => 'EUR', 'rate' => '4.10']], ['PEN', 'USD']);

    expect((string) $fx->display(BigDecimal::of('375'), 'PEN', 'USD', '3')->toScale(2))->toBe('103.00')
        ->and((string) $fx->display(BigDecimal::of('100'), 'USD', 'PEN', '3')->toScale(2))->toBe('386.25')
        ->and((string) $fx->display(BigDecimal::of('100'), 'PEN', 'PEN', '3'))->toBe('100');
});

it('duda 4 (c): sin precio propio el sitio cobra en la moneda de cobro elegida y EUR se cobra en USD', function () {
    $body = ['product' => 'laguna-humantay-full-day', 'date' => '2026-10-02', 'adults' => 2];
    $pen = $this->postJson('/api/v1/public/price-quote', $body, siteOf())->assertOk()->json('data');
    $usd = $this->postJson('/api/v1/public/price-quote', $body, siteOf('andes', ['X-Site-Currency' => 'USD']))->assertOk()->json('data');

    expect($pen['currency'])->toBe('PEN')
        ->and($usd['currency'])->toBe('USD')
        ->and($usd['converted'])->toBeTrue();

    $expected = withinTenant(tenantA(), fn () => (string) app(SiteCurrency::class)->convert($pen['lines'][0]['unit'], 'PEN', 'USD')->toScale(2, RoundingMode::HALF_UP));
    expect(abs((float) $usd['lines'][0]['unit'] - (float) $expected))->toBeLessThan(0.11);

    $charge = withinTenant(tenantA(), function (): array {
        $pen = app(SiteCurrency::class)->charge('PEN');
        foreach ([['PEN', 'Sol peruano', 'S/', true], ['USD', 'Dólar estadounidense', 'US$', true]] as [$code, $name, $symbol, $charge]) {
            DB::table('fin_currencies')->updateOrInsert(['tenant_id' => tenantA()->getKey(), 'code' => $code], ['name' => $name, 'symbol' => $symbol, 'active' => true, 'is_charge' => $charge]);
        }
        DB::table('fin_currencies')->updateOrInsert(['tenant_id' => tenantA()->getKey(), 'code' => 'EUR'], ['name' => 'Euro', 'symbol' => '€', 'active' => true, 'is_charge' => false]);
        if (! DB::table('fin_fx_rates')->where('currency_code', 'EUR')->exists()) {
            DB::table('fin_fx_rates')->insert(['tenant_id' => tenantA()->getKey(), 'currency_code' => 'EUR', 'rate_pen' => '4.100000', 'rate_date' => BUSINESS_TODAY, 'source' => 'Prueba']);
        }

        return [app()->build(SiteCurrency::class)->charge('EUR'), $pen];
    });
    expect($charge)->toBe(['USD', 'PEN']);
});

it('duda 4 (c): Yape y Plin cobran siempre en soles', function () {
    $usd = collect(CheckoutTerms::methods('USD'))->keyBy('value');
    $pen = collect(CheckoutTerms::methods('PEN'))->keyBy('value');

    expect($usd['yape']['available'])->toBeFalse()
        ->and($usd['plin']['available'])->toBeFalse()
        ->and($usd['tarjeta']['available'])->toBeTrue()
        ->and($pen['yape']['available'])->toBeTrue()
        ->and(fn () => CheckoutTerms::assertMethod('plin', 'USD'))->toThrow(ApiException::class);

    CheckoutTerms::assertMethod('yape', 'PEN');
});

it('O6: Vinicunca (edad mínima 8) con la niña de 8 años cobra 2 × 48 + 1 × 30 = USD 126 sin aviso', function () {
    $quote = $this->postJson('/api/v1/public/price-quote', pr16Vinicunca(1), siteOf(extra: critical()))->assertOk()->json('data');
    $tour = collect($quote['lines'])->firstWhere('key', 'tour-TT-CUS-1');

    expect($tour['amount'])->toBe('126.00')
        ->and(collect($quote['warnings'])->filter(fn (string $w): bool => str_contains($w, 'No puede ir'))->all())->toBe([]);
});

it('O6: con una niña de 6 años Vinicunca cobra USD 96, la menor no ocupa cupo y se avisa', function () {
    $quote = $this->postJson('/api/v1/public/price-quote', pr16Vinicunca(0), siteOf(extra: critical()))->assertOk()->json('data');
    $tour = collect($quote['lines'])->firstWhere('key', 'tour-TT-CUS-1');

    expect($tour['amount'])->toBe('96.00')
        ->and(collect($quote['warnings'])->contains(fn (string $w): bool => str_starts_with($w, 'No puede ir a Montaña de Colores (Vinicunca): edad mínima 8 años')))->toBeTrue();
});

it('O6: la ficha pública marca qué tours preguntan la edad de los niños', function () {
    $slug = pr16TripSlug();
    $trip = $this->getJson("/api/v1/public/products/{$slug}", siteOf())->assertOk()->json('data.booking.trip');
    $tours = collect($trip['legs'])->flatMap(fn (array $leg): array => $leg['tours'])->keyBy('id');

    expect($tours['TT-CUS-1']['children_rule'])->toBe('ask')
        ->and($tours['TT-CUS-2']['children_rule'])->toBe('all');
});

it('O6: el checkout valida con las fechas de nacimiento cuántos niños cumplen la edad mínima', function () {
    $terms = [
        'group' => ['adt' => 2, 'chd' => 1, 'inf' => 0],
        'companions' => ['when' => 'al_reservar', 'require_document' => false],
        'first_date' => '2026-11-10',
        'items' => [['product' => ['min_age' => 0], 'tours' => [['id' => 'TT-CUS-1', 'name' => 'Vinicunca', 'min_age' => 8, 'date' => '2026-11-12', 'children' => 1]]]],
    ];
    $passenger = fn (string $name, string $birth): array => ['first_name' => $name, 'last_name' => 'Castañeda', 'birth_date' => $birth, 'nationality' => 'Peruana'];
    $adults = [$passenger('Luis', '1985-03-02'), $passenger('Ana', '1987-06-10')];

    expect(CheckoutRules::passengers(['passengers' => [...$adults, $passenger('Sofía', '2018-05-01')]], $terms))->toHaveCount(3)
        ->and(fn () => CheckoutRules::passengers(['passengers' => [...$adults, $passenger('Sofía', '2020-05-01')]], $terms))->toThrow(ApiException::class);
});

it('O6: vuelo y bus toman el nombre de su medio real', function () {
    expect(TripBooking::serviceName('transport', 'vuelo', 'Lima → Arequipa · 12/11'))->toBe('Vuelo Lima → Arequipa · 12/11')
        ->and(TripBooking::serviceName('transport', 'bus', 'Bus Cruz del Sur Puno → Cusco'))->toBe('Bus Cruz del Sur Puno → Cusco')
        ->and(TripBooking::serviceName('transport', 'traslado', 'Aeropuerto → hotel'))->toBe('Movilidad Aeropuerto → hotel')
        ->and(TripBooking::serviceName('tour', null, 'Vinicunca'))->toBe('Tour Vinicunca');
});
