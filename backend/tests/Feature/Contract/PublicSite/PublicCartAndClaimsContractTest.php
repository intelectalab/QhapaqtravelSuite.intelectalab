<?php

use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;

function ctrPubSellableDate(string $slug, int $adults): string
{
    foreach (['2026-10', '2026-11'] as $month) {
        foreach (test()->getJson("/api/v1/public/products/{$slug}/calendar?mes={$month}&viajeros={$adults}", siteOf())->assertOk()->json('data.days') as $day) {
            if ($day['sellable'] && $day['date'] >= '2026-10-05') {
                return $day['date'];
            }
        }
    }

    throw new RuntimeException("Sin fecha vendible para {$slug}");
}

function ctrPubCart(string $slug, string $date, int $adults): string
{
    return (string) test()->postJson('/api/v1/public/carts/current/items', ['product' => $slug, 'date' => $date, 'adults' => $adults], siteOf(extra: critical()))->assertCreated()->json('data.token');
}

function ctrPubWithCart(string $token): mixed
{
    return test()->withCredentials()->withUnencryptedCookie((string) config('sites.cart_cookie'), $token);
}

function ctrPubLiveHolds(string $cartCode): Collection
{
    return withinTenant(tenantA(), fn () => DB::table('catalog_availability_holds')->where('reference', $cartCode)->where('status', 'hold')->get()
        ->filter(fn (object $hold): bool => Carbon::parse($hold->expires_at)->isFuture()));
}

beforeEach(function () {
    lockSeededBookings();
    lockCatalogProducts();
    Queue::fake();
    $this->withoutMiddleware(ThrottleRequests::class);
});

it('PATCH /public/carts/current/items/{line} cambia los viajeros y reajusta el bloqueo de cupos', function () {
    $date = ctrPubSellableDate('laguna-humantay-full-day', 3);
    $token = ctrPubCart('laguna-humantay-full-day', $date, 2);
    $code = (string) ctrPubWithCart($token)->getJson('/api/v1/public/carts/current', siteOf())->json('data.code');
    $before = ctrPubLiveHolds($code);

    $response = ctrPubWithCart($token)->patchJson('/api/v1/public/carts/current/items/1', ['adults' => 3], siteOf())->assertOk();

    $after = ctrPubLiveHolds($code);
    expect($response->json('data.pax.adults'))->toBe(3)
        ->and($response->json('meta.cart.code'))->toBe($code)
        ->and(withinTenant(tenantA(), fn () => DB::table('audit_events')->where(['entity' => 'Carrito', 'entity_id' => $code, 'action' => 'modificar_linea'])->exists()))->toBeTrue();
    if ($before->isNotEmpty()) {
        expect($after->sum('quantity'))->toBe(3)
            ->and($after->pluck('id')->intersect($before->pluck('id')))->toBeEmpty();
    }
});

it('PATCH /public/carts/current/items/{line} responde 404 sin carrito o sin la línea', function () {
    expect($this->patchJson('/api/v1/public/carts/current/items/1', ['adults' => 2], siteOf()))->toBeApiError(404);

    $token = ctrPubCart('laguna-humantay-full-day', ctrPubSellableDate('laguna-humantay-full-day', 2), 2);
    expect(ctrPubWithCart($token)->patchJson('/api/v1/public/carts/current/items/9', ['adults' => 2], siteOf()))->toBeApiError(404)
        ->and(ctrPubWithCart($token)->patchJson('/api/v1/public/carts/current/items/1', ['adults' => 0], siteOf()))->toBeApiError(422);
});

it('PUT /public/carts/current/preferences guarda la moneda y el idioma del carrito', function () {
    $token = ctrPubCart('laguna-humantay-full-day', ctrPubSellableDate('laguna-humantay-full-day', 2), 2);

    $data = ctrPubWithCart($token)->putJson('/api/v1/public/carts/current/preferences', ['currency' => 'USD', 'locale' => 'en'], siteOf())->assertOk()->json('data');

    $cart = withinTenant(tenantA(), fn () => DB::table('channel_web_carts')->where('code', $data['cart']['code'])->first());
    expect($data['currency'])->toBe('USD')
        ->and($data['locale'])->toBe('en')
        ->and(trim((string) $cart->currency))->toBe('USD')
        ->and($cart->locale)->toBe('en');
    expect($this->putJson('/api/v1/public/carts/current/preferences', ['currency' => 'EUR'], siteOf()))->toBeApiError(422);
});

it('POST /public/claims registra la hoja de reclamación y devuelve la constancia', function () {
    $sede = (string) withinTenant(tenantA(), fn () => DB::table('iam_sedes')->where('name', 'like', 'Lima%')->value('id'));
    $body = [
        'name' => 'Jorge Salas Paredes',
        'doc_type' => 'DNI',
        'doc_number' => '41523698',
        'email' => 'jorge.salas@correo.pe',
        'phone' => '+51 944 556 677',
        'address' => 'Av. Larco 1234, Miraflores',
        'sede_id' => $sede,
        'good_kind' => 'servicio',
        'good_description' => 'Tour Laguna Humantay',
        'good_amount' => 320,
        'good_currency' => 'PEN',
        'type' => 'reclamo',
        'detail' => 'El transporte llegó dos horas tarde y perdimos la caminata.',
        'request' => 'Devolución parcial del servicio.',
        'declaration' => true,
    ];
    $key = idem('claim');

    $first = $this->postJson('/api/v1/public/claims', $body, siteOf(extra: critical(key: $key)))->assertCreated()->json('data');
    $again = $this->postJson('/api/v1/public/claims', $body, siteOf(extra: critical(key: $key)))->json('data');

    expect($first['number'])->toStartWith('LR-LIM-2026-')
        ->and($again['number'])->toBe($first['number'])
        ->and(withinTenant(tenantA(), fn () => DB::table('crm_cases')->where('book_number', $first['number'])->count()))->toBe(1);
    expect($this->postJson('/api/v1/public/claims', $body, siteOf()))->toBeApiError(422, 'IDEMPOTENCY_KEY_REQUIRED');
});
