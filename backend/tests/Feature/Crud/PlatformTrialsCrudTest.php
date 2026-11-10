<?php

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Testing\TestResponse;

beforeEach(fn () => lockPlatformBilling());

function trialSubscription(): object
{
    return DB::connection('pgsql_platform')->table('subscriptions')->where('tenant_id', tenantA()->getKey())->first();
}

function trialStart(array $extra = []): void
{
    DB::connection('pgsql_platform')->table('subscriptions')->where('tenant_id', tenantA()->getKey())->update(['status' => 'trialing', 'trial_ends_at' => '2026-10-05', 'trial_extended_days' => 0, 'current_period_end' => '2026-10-05', 'coupon_redemption_id' => null, ...$extra]);
    DB::connection('pgsql_platform')->table('tenants')->where('id', tenantA()->getKey())->update(['status' => 'prueba']);
}

function trialConvert(?string $coupon = null): TestResponse
{
    return test()->postJson('/api/v1/platform/trials/TNT-0001/convert', array_filter(['coupon' => $coupon]), critical());
}

function trialInvoice(string $number): object
{
    return DB::connection('pgsql_platform')->table('platform_invoices')->where('series', 'FQ01')->where('number', (int) substr($number, 5))->first();
}

it('extender la prueba mueve su fecha de fin en la suscripción y en la agencia y lo audita', function () {
    trialStart();
    actingAsPlatform();

    $this->postJson('/api/v1/platform/trials/TNT-0001/extend', ['days' => 7])->assertOk()->assertJsonPath('data.extended', true);
    $subscription = trialSubscription();

    expect($subscription->trial_ends_at)->toBe('2026-10-12')
        ->and((int) $subscription->trial_extended_days)->toBe(7)
        ->and($subscription->current_period_end)->toBe('2026-10-12')
        ->and(Carbon::parse(DB::connection('pgsql_platform')->table('tenants')->where('id', tenantA()->getKey())->value('trial_ends_at'))->timezone('America/Lima')->toDateString())->toBe('2026-10-12')
        ->and(DB::connection('pgsql_platform')->table('audit_events')->whereNull('tenant_id')->where(['entity' => 'Tenant', 'entity_id' => 'TNT-0001', 'action' => 'extender_trial'])->value('after_value'))->toBe('12/10/2026 · +7 días')
        ->and(json_encode($this->getJson('/api/v1/platform/trials')->assertOk()->json('data')))->toContain('2026-10-12');
});

it('SUB-BR-10: la prueba admite como máximo 14 días de extensión acumulados', function () {
    trialStart();
    actingAsPlatform();
    $this->postJson('/api/v1/platform/trials/TNT-0001/extend', ['days' => 7])->assertOk();

    $over = $this->postJson('/api/v1/platform/trials/TNT-0001/extend', ['days' => 14]);
    expect($over)->toBeApiError(422, 'SUB-BR-10')
        ->and($over->json('message'))->toContain('7 días más');

    $this->postJson('/api/v1/platform/trials/TNT-0001/extend', ['days' => 7])->assertOk();
    expect(trialSubscription()->trial_ends_at)->toBe('2026-10-19')
        ->and((int) trialSubscription()->trial_extended_days)->toBe(14);
    expect($this->postJson('/api/v1/platform/trials/TNT-0001/extend', ['days' => 7]))->toBeApiError(422, 'SUB-BR-10');
});

it('la extensión es de 7 o 14 días y solo para agencias en prueba', function () {
    actingAsPlatform();

    $this->postJson('/api/v1/platform/trials/TNT-0001/extend', ['days' => 5])->assertStatus(422)->assertJsonValidationErrors('days');
    expect($this->postJson('/api/v1/platform/trials/TNT-0001/extend', ['days' => 7]))->toBeApiError(409, 'NOT_TRIALING')
        ->and($this->postJson('/api/v1/platform/trials/TNT-9999/extend', ['days' => 7]))->toBeApiError(404);
    expect(trialSubscription()->status)->toBe('active');
});

it('convertir la prueba activa la suscripción, la agencia y emite la primera factura exacta', function () {
    trialStart();
    actingAsPlatform();
    $price = (string) DB::connection('pgsql_platform')->table('plans')->where('code', 'enterprise')->value('price_month');

    $number = trialConvert()->assertOk()->json('data.invoice');
    $subscription = trialSubscription();
    $tenant = DB::connection('pgsql_platform')->table('tenants')->where('id', tenantA()->getKey())->first();
    $invoice = trialInvoice($number);

    expect($number)->toStartWith('FQ01-')
        ->and($subscription->status)->toBe('active')
        ->and($subscription->current_period_start)->toBe('2026-09-29')
        ->and($subscription->current_period_end)->toBe('2026-10-28')
        ->and($tenant->status)->toBe('activo')
        ->and((string) $tenant->mrr)->toBe($price)
        ->and($invoice->status)->toBe('open')
        ->and((string) $invoice->subtotal)->toBe($price)
        ->and((string) $invoice->igv)->toBe(bcdiv(bcmul($price, '18', 4), '100', 2))
        ->and((string) $invoice->total)->toBe(bcadd($price, (string) $invoice->igv, 2))
        ->and(DB::connection('pgsql_platform')->table('audit_events')->whereNull('tenant_id')->where(['entity' => 'Tenant', 'entity_id' => 'TNT-0001', 'action' => 'convertir_trial'])->exists())->toBeTrue();
    expect(trialConvert())->toBeApiError(409, 'NOT_TRIALING');
});

it('la conversión exige Idempotency-Key y repite la misma respuesta sin doble factura', function () {
    trialStart();
    actingAsPlatform();
    $before = DB::connection('pgsql_platform')->table('platform_invoices')->count();

    expect($this->postJson('/api/v1/platform/trials/TNT-0001/convert'))->toBeApiError(422, 'IDEMPOTENCY_KEY_REQUIRED');

    $key = idem();
    $first = $this->postJson('/api/v1/platform/trials/TNT-0001/convert', [], critical(null, $key))->assertOk()->json();
    $again = $this->postJson('/api/v1/platform/trials/TNT-0001/convert', [], critical(null, $key))->assertOk();

    expect($again->json())->toBe($first)
        ->and(DB::connection('pgsql_platform')->table('platform_invoices')->count())->toBe($before + 1);
});

it('el Tenant Admin no extiende ni convierte pruebas', function () {
    trialStart();
    actingAsSeed('U01');

    expect($this->postJson('/api/v1/platform/trials/TNT-0001/extend', ['days' => 7])->status())->toBeIn([401, 403])
        ->and(trialConvert()->status())->toBeIn([401, 403]);
    expect(trialSubscription()->status)->toBe('trialing');
});
