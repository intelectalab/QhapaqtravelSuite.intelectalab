<?php

use App\Domain\Booking\Rules\RuleResolver;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use Illuminate\Testing\TestResponse;

beforeEach(function () {
    $this->withoutMiddleware(ThrottleRequests::class);
    Queue::fake();
});

function panelSlug(string $code = 'PER-CIR-10D'): string
{
    return (string) withinTenant(tenantA(), fn () => DB::table('catalog_products')->where('code', $code)->value('slug'));
}

function panelDate(string $slug, int $seats = 2): string
{
    foreach (['2026-11', '2026-12', '2027-01', '2027-02'] as $month) {
        foreach (test()->getJson("/api/v1/public/products/{$slug}/calendar?mes={$month}&viajeros={$seats}", siteOf())->assertOk()->json('data.days') as $day) {
            if ($day['sellable']) {
                return $day['date'];
            }
        }
    }

    throw new RuntimeException("Sin fecha vendible para {$slug}");
}

function panelSelection(): array
{
    return [
        'addons' => [['id' => 'ADD-1101'], ['id' => 'ADD-1104']],
        'lodging' => [
            ['leg_id' => 'LEG-1', 'hotel_id' => 'H-LIM-3', 'rooms' => [['type' => 'Doble', 'qty' => 1]]],
            ['leg_id' => 'LEG-4', 'hotel_id' => 'H-CUS-4', 'rooms' => [['type' => 'Doble', 'qty' => 1]]],
        ],
    ];
}

function panelPatch(string $token, int $line, array $body, array $headers = []): TestResponse
{
    return test()->withCredentials()->withUnencryptedCookie('ah_cart', $token)->patchJson("/api/v1/public/carts/current/items/{$line}/removed-lines", $body, siteOf(extra: $headers));
}

function previewRemove(bool $on): void
{
    withinTenant(tenantA(), function () use ($on) {
        DB::table('sys_booking_rules')->where('code', 'R-PREVIEW-REMOVE')->update(['enabled' => $on]);
        RuleResolver::invalidate((string) tenantA()->getKey());
    });
}

it('la ficha pública trae adicionales, alojamiento por ciudad, recojo y modalidades de pago sin datos internos', function () {
    $booking = $this->getJson('/api/v1/public/products/'.panelSlug(), siteOf())->assertOk()->json('data.booking');

    expect(collect($booking['addons'])->pluck('id')->all())->toContain('ADD-1101', 'ADD-1104')
        ->and($booking['lodging']['legs'])->toHaveCount(4)
        ->and($booking['lodging']['legs'][0]['city'])->toBe('Lima')
        ->and($booking['lodging']['legs'][0]['hotels'][0]['rooms'][0])->toHaveKeys(['type', 'capacity', 'price'])
        ->and($booking['payment']['modes'])->toContain('total')
        ->and($booking['can_remove'])->toBeTrue()
        ->and(json_encode($booking))->not->toContain('provider')->not->toContain('cost');
});

it('POST public/quote cotiza con el motor adicionales y alojamiento, quita ítems removibles y firma la cotización', function () {
    $slug = panelSlug();
    $date = panelDate($slug);
    $base = $this->postJson('/api/v1/public/quote', ['product' => $slug, 'date' => $date, 'pax' => ['adt' => 2]], siteOf())->assertOk()->json('data');
    $full = $this->postJson('/api/v1/public/quote', ['product_id' => 'PER-CIR-10D', 'date' => $date, 'pax' => ['adt' => 2], ...panelSelection()], siteOf())->assertOk()->json('data');
    $lines = collect($full['lines'])->keyBy('key');

    expect($lines->keys()->all())->toContain('addon-ADD-1101', 'addon-ADD-1104', 'lodge-LEG-1-Doble', 'lodge-LEG-4-Doble')
        ->and($lines['addon-ADD-1104']['qty'])->toBe(2)
        ->and($lines['lodge-LEG-4-Doble']['qty'])->toBe(4)
        ->and($lines['lodge-LEG-4-Doble']['removable'])->toBeTrue()
        ->and($full['rooms'])->toBe(2)
        ->and($full['nights'])->toBe(5)
        ->and($full['quote_token'])->toBeString()
        ->and($full)->toHaveKeys(['modes', 'deposit_pct', 'deposit', 'balance', 'hold_hours', 'fx_rate', 'warnings', 'ok']);

    $extras = $lines->filter(fn ($line) => $line['kind'] !== 'base')->sum(fn ($line) => (float) $line['amount']);
    expect(round((float) $full['total'], 2))->toBe(round((float) $base['total'] + $extras, 2));

    $removed = $this->postJson('/api/v1/public/quote', ['product' => $slug, 'date' => $date, 'pax' => ['adt' => 2], ...panelSelection(), 'removed' => ['addon-ADD-1104', 'base-adt']], siteOf())->assertOk()->json('data');
    $line = collect($removed['lines'])->firstWhere('key', 'addon-ADD-1104');

    expect($line['removed'])->toBeTrue()
        ->and(round((float) $full['total'] - (float) $removed['total'], 2))->toBe(round((float) $line['amount'], 2))
        ->and(collect($removed['lines'])->firstWhere('key', 'base-adt')['removed'])->toBeFalse()
        ->and($full['currency'])->toBe('USD');

    expect($this->postJson('/api/v1/public/quote', ['product' => $slug, 'date' => $date, 'pax' => ['adt' => 2], 'currency' => 'PEN'], siteOf())->assertOk()->json('data.currency'))->toBe('PEN');

    expect($this->postJson('/api/v1/public/quote', ['product' => $slug, 'date' => $date, 'pax' => ['adt' => 2], 'lodging' => [['leg_id' => 'LEG-1', 'hotel_id' => 'H-NO-EXISTE', 'rooms' => [['type' => 'Doble', 'qty' => 1]]]]], siteOf()))->toBeApiError(422);
});

it('el carrito guarda la selección, quita y restaura adicionales o alojamiento con control de versión', function () {
    $slug = panelSlug();
    $date = panelDate($slug);
    $quote = $this->postJson('/api/v1/public/price-quote', ['product' => $slug, 'date' => $date, 'adults' => 2, ...panelSelection()], siteOf())->assertOk()->json('data');
    $engine = $this->postJson('/api/v1/public/quote', ['product' => $slug, 'date' => $date, 'pax' => ['adt' => 2], ...panelSelection()], siteOf())->assertOk()->json('data');

    expect(collect($quote['lines'])->where('kind', 'lodging')->pluck('amount')->all())->toBe(collect($engine['lines'])->where('kind', 'lodging')->pluck('amount')->all());
    $data = $this->postJson('/api/v1/public/carts/current/items', ['product' => $slug, 'date' => $date, 'adults' => 2, 'quote_token' => $quote['quote_token'], ...panelSelection()], siteOf(extra: critical()))->assertCreated()->json('data');
    $token = $data['token'];
    $cart = $data['cart'];
    $line = $cart['items'][0];

    expect($line['quote']['total'])->toBe($quote['total'])
        ->and($line['quote']['extras']['lodging'])->toHaveCount(2);

    $after = panelPatch($token, $line['line'], ['key' => 'lodge-LEG-4-Doble', 'removed' => true], ['If-Match' => (string) $cart['lock_version']])->assertOk()->json('data');
    $removed = collect($after['items'][0]['quote']['lines'])->firstWhere('key', 'lodge-LEG-4-Doble');

    expect($removed['removed'])->toBeTrue()
        ->and($after['lock_version'])->toBe($cart['lock_version'] + 1)
        ->and(round((float) $quote['total'] - (float) $after['items'][0]['quote']['total'], 2))->toBe(round((float) $removed['amount'], 2))
        ->and(withinTenant(tenantA(), fn () => DB::table('audit_events')->where(['entity' => 'Carrito', 'entity_id' => $cart['code'], 'action' => 'quitar_item'])->exists()))->toBeTrue();

    expect(panelPatch($token, $line['line'], ['key' => 'addon-ADD-1101', 'removed' => true, 'lock_version' => $cart['lock_version']]))->toBeApiError(409);
    expect(panelPatch($token, $line['line'], ['key' => 'adults', 'removed' => true]))->toBeApiError(422);

    $restored = panelPatch($token, $line['line'], ['key' => 'lodge-LEG-4-Doble', 'removed' => false])->assertOk()->json('data');
    expect($restored['items'][0]['quote']['total'])->toBe($quote['total']);

    $terms = $this->withCredentials()->withUnencryptedCookie('ah_cart', $token)->postJson('/api/v1/public/checkout/validate', [], siteOf(extra: critical()))->assertOk()->json('data.terms');
    expect($terms['total'])->toBe($quote['total']);

    previewRemove(false);
    try {
        expect(panelPatch($token, $line['line'], ['key' => 'addon-ADD-1101', 'removed' => true]))->toBeApiError(422, 'R-PREVIEW-REMOVE');
    } finally {
        previewRemove(true);
    }
});

it('rechaza agregar al carrito si el precio cambió desde la cotización firmada', function () {
    $slug = panelSlug();
    $date = panelDate($slug);
    $quote = $this->postJson('/api/v1/public/price-quote', ['product' => $slug, 'date' => $date, 'adults' => 2], siteOf())->assertOk()->json('data');
    $engine = $this->postJson('/api/v1/public/quote', ['product' => $slug, 'date' => $date, 'pax' => ['adt' => 2]], siteOf())->assertOk()->json('data');

    $response = $this->postJson('/api/v1/public/carts/current/items', ['product' => $slug, 'date' => $date, 'adults' => 2, 'quote_token' => $quote['quote_token'], ...panelSelection()], siteOf(extra: critical()));

    expect($response)->toBeApiError(409, 'QUOTE_CHANGED');
    expect($this->postJson('/api/v1/public/carts/current/items', ['product' => $slug, 'date' => $date, 'adults' => 2, 'quote_token' => $engine['quote_token']], siteOf(extra: critical())))->toBeApiError(422, 'QUOTE_TOKEN_INVALID');
    expect($this->postJson('/api/v1/public/carts/current/items', ['product' => $slug, 'date' => $date, 'adults' => 2, 'quote_token' => 'x.y'], siteOf(extra: critical())))->toBeApiError(422);
});

it('el traspaso del widget lleva los adicionales y el alojamiento al carrito', function () {
    $slug = panelSlug();
    $date = panelDate($slug);
    $handoff = $this->postJson('/api/v1/public/widget-handoffs', ['product' => 'PER-CIR-10D', 'date' => $date, 'adults' => 2, ...panelSelection()], siteOf(extra: critical()))->assertCreated()->json('data');
    $cart = $this->postJson('/api/v1/public/carts', ['handoff' => $handoff['code']], siteOf(extra: critical()))->assertCreated()->json('data.cart');

    expect($cart['items'][0]['source'])->toBe('widget')
        ->and($cart['items'][0]['quote']['total'])->toBe($handoff['total'])
        ->and(collect($cart['items'][0]['quote']['lines'])->pluck('key')->all())->toContain('addon-ADD-1104', 'lodge-LEG-1-Doble');
});

it('GET public/reviews en modo widget devuelve reseñas externas de plataformas conectadas con atribución', function () {
    $feed = $this->getJson('/api/v1/public/reviews?sources=google,tripadvisor,trustpilot&min_rating=4&count=3&layout=cuadricula', siteOf())->assertOk()->json('data');

    expect($feed['settings'])->toMatchArray(['sources' => ['google', 'tripadvisor'], 'min_rating' => 4, 'count' => 3, 'layout' => 'cuadricula'])
        ->and(count($feed['items']))->toBeLessThanOrEqual(3)
        ->and(collect($feed['items'])->every(fn ($item) => $item['rating'] >= 4 && in_array($item['source']['provider'], ['google', 'tripadvisor'], true)))->toBeTrue()
        ->and(collect($feed['sources'])->pluck('name')->all())->toBe(['Google', 'TripAdvisor']);

    expect($this->getJson('/api/v1/public/reviews?widget=1', siteOf())->assertOk()->json('data.settings.count'))->toBeGreaterThan(0);
    expect($this->getJson('/api/v1/public/reviews?count=50', siteOf()))->toBeApiError(422);
});
