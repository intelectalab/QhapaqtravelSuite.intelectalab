<?php

use App\Domain\Booking\Rules\RuleResolver;
use App\Jobs\ExpireAvailabilityHolds;
use App\Jobs\ReleasePayLaterHolds;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use Illuminate\Testing\TestResponse;

beforeEach(function () {
    $this->withoutMiddleware(ThrottleRequests::class);
    Queue::fake();
});

function payLaterOn(bool $on = true): void
{
    withinTenant(tenantA(), function () use ($on) {
        DB::table('sys_booking_rules')->where('code', 'R-PAY-LATER')->update(['enabled' => $on, 'params' => json_encode(['holdHours' => 24])]);
        RuleResolver::invalidate((string) tenantA()->getKey());
    });
}

function payLaterCart(): string
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

function payLaterPost(string $token, string $path, array $body): TestResponse
{
    return test()->withCredentials()->withUnencryptedCookie('ah_cart', $token)->postJson("/api/v1/public/{$path}", $body, siteOf(extra: critical()));
}

function payLaterOrder(string $token, array $extra = []): TestResponse
{
    return payLaterPost($token, 'checkout/orders', [
        'name' => 'Rosa Quispe Huamán', 'email' => 'rosa.paylater@checkout.pe', 'phone' => '+51 955 111 222', 'country' => 'Perú', 'doc_type' => 'DNI', 'doc_number' => '44556677', 'billing_type' => 'Boleta',
        'passengers' => webTravelers(2), 'pay_mode' => 'pagar_despues', 'terms' => true, 'privacy' => true, ...$extra,
    ]);
}

it('R-PAY-LATER apagada: el checkout no ofrece pagar después', function () {
    payLaterOn(false);
    $terms = payLaterPost(payLaterCart(), 'checkout/validate', [])->assertOk()->json('data.terms');

    expect(collect($terms['modes'])->pluck('value')->all())->not->toContain('pagar_despues');
});

it('R-PAY-LATER encendida: reserva sin cobro, bloquea los cupos 24 h y deja la CxC total pendiente', function () {
    payLaterOn();
    $token = payLaterCart();
    $mode = collect(payLaterPost($token, 'checkout/validate', [])->assertOk()->json('data.terms.modes'))->firstWhere('value', 'pagar_despues');

    expect($mode)->not->toBeNull()->and($mode['hold_hours'])->toBe(24)->and($mode['amount'])->toBe('0.00');
    expect(payLaterOrder($token, ['method' => 'tarjeta', 'card_token' => 'tok_ok_1111', 'card_holder' => 'ROSA QUISPE']))->toBeApiError(422);

    $data = payLaterOrder($token)->assertCreated()->json('data');
    $order = withinTenant(tenantA(), fn () => DB::table('channel_ecom_orders')->where('code', $data['code'])->first());
    $snapshot = withinTenant(tenantA(), fn () => DB::table('booking_reservation_web_snapshots')->where('order_code', $data['code'])->first());
    $holds = withinTenant(tenantA(), fn () => DB::table('catalog_availability_holds')->where('reference_id', $order->id)->get());

    expect($data['payment'])->toBeNull()
        ->and($order->status)->toBe('pago_pendiente')
        ->and((string) $order->amount_due_now)->toBe('0.00')
        ->and(abs(strtotime((string) $order->hold_expires_at) - now()->addHours(24)->getTimestamp()))->toBeLessThan(120)
        ->and($snapshot->payment_mode)->toBe('pagar_despues')
        ->and($holds->every(fn ($hold) => abs(strtotime((string) $hold->expires_at) - now()->addHours(24)->getTimestamp()) < 120))->toBeTrue();

    withinTenant(tenantA(), fn () => DB::table('channel_ecom_orders')->where('id', $order->id)->update(['hold_expires_at' => now()->subMinute()]));
    withinTenant(tenantA(), fn () => (new ExpireAvailabilityHolds)->handle());
    expect(withinTenant(tenantA(), fn () => DB::table('channel_ecom_orders')->where('id', $order->id)->value('status')))->toBe('pago_pendiente');

    withinTenant(tenantA(), fn () => (new ReleasePayLaterHolds)->handle());
    expect(withinTenant(tenantA(), fn () => DB::table('channel_ecom_orders')->where('id', $order->id)->value('status')))->toBe('expirado');
});
