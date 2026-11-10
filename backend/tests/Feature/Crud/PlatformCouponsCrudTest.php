<?php

use Illuminate\Support\Facades\DB;
use Illuminate\Testing\TestResponse;

beforeEach(fn () => lockPlatformBilling());

function couponRow(string $code): ?object
{
    return DB::connection('pgsql_platform')->table('coupons')->where('code', $code)->first();
}

function couponBody(array $overrides = []): array
{
    return ['type' => 'percent', 'value' => 25, 'duration_cycles' => 3, 'plans' => ['professional', 'enterprise'], 'max_redemptions' => 10, 'valid_to' => '2026-12-31', 'note' => 'Campaña de verano', ...$overrides];
}

function couponPlanIds(array $codes): array
{
    return DB::connection('pgsql_platform')->table('plans')->whereIn('code', $codes)->pluck('id')->sort()->values()->all();
}

function couponStoredPlans(string $code): array
{
    return collect(explode(',', trim((string) couponRow($code)->plan_ids, '{}')))->filter()->sort()->values()->all();
}

function couponTrial(): void
{
    DB::connection('pgsql_platform')->table('subscriptions')->where('tenant_id', tenantA()->getKey())->update(['status' => 'trialing', 'trial_ends_at' => '2026-10-05', 'trial_extended_days' => 0, 'coupon_redemption_id' => null]);
}

function couponConvert(string $coupon): TestResponse
{
    return test()->postJson('/api/v1/platform/trials/TNT-0001/convert', ['coupon' => $coupon], critical());
}

function couponAudit(string $code, string $action): ?string
{
    return DB::connection('pgsql_platform')->table('audit_events')->whereNull('tenant_id')->where(['entity' => 'Cupón', 'entity_id' => $code, 'action' => $action])->orderByDesc('occurred_at')->value('after_value');
}

it('crea un cupón activo con su código en mayúsculas, sus planes y lo audita', function () {
    actingAsPlatform();

    $this->postJson('/api/v1/platform/coupons', ['code' => ' verano26 ', ...couponBody()])->assertCreated()->assertJsonPath('data.code', 'VERANO26');
    $coupon = couponRow('VERANO26');

    expect($coupon->status)->toBe('active')
        ->and((string) $coupon->value)->toBe('25.00')
        ->and((int) $coupon->duration_cycles)->toBe(3)
        ->and((int) $coupon->max_redemptions)->toBe(10)
        ->and((int) $coupon->redeemed_count)->toBe(0)
        ->and($coupon->valid_to)->toBe('2026-12-31')
        ->and(couponStoredPlans('VERANO26'))->toBe(couponPlanIds(['professional', 'enterprise']))
        ->and(couponAudit('VERANO26', 'crear'))->toBe('25 % · 3 ciclos · professional, enterprise')
        ->and(collect($this->getJson('/api/v1/platform/coupons')->assertOk()->json('data'))->pluck('code'))->toContain('VERANO26');
});

it('no repite códigos de cupón', function () {
    actingAsPlatform();

    expect($this->postJson('/api/v1/platform/coupons', ['code' => 'quedate20', ...couponBody()]))->toBeApiError(422, 'COUPON_EXISTS');
});

it('valida el código, el descuento, los ciclos, los planes y la vigencia', function (array $body, string $field) {
    actingAsPlatform();

    $this->postJson('/api/v1/platform/coupons', ['code' => 'NUEVO26', ...couponBody($body)])->assertStatus(422)->assertJsonValidationErrors($field);
    expect(couponRow('NUEVO26'))->toBeNull();
})->with([
    'SUB-BR-08 porcentaje sobre 50' => [['value' => 51], 'value'],
    'descuento cero' => [['type' => 'fixed', 'value' => 0], 'value'],
    'código con espacios' => [['code' => 'MI CUPON'], 'code'],
    'trece ciclos' => [['duration_cycles' => 13], 'duration_cycles'],
    'sin planes' => [['plans' => []], 'plans'],
    'plan inexistente' => [['plans' => ['premium']], 'plans.0'],
    'vigencia pasada' => [['valid_to' => '2026-09-28'], 'valid_to'],
]);

it('edita el cupón y conserva el código y los canjes', function () {
    actingAsPlatform();

    $this->patchJson('/api/v1/platform/coupons/quedate20', couponBody(['value' => 30, 'plans' => ['starter'], 'max_redemptions' => 40, 'note' => null]))->assertOk()->assertJsonPath('data.code', 'QUEDATE20');
    $coupon = couponRow('QUEDATE20');

    expect((string) $coupon->value)->toBe('30.00')
        ->and((int) $coupon->max_redemptions)->toBe(40)
        ->and((int) $coupon->redeemed_count)->toBe(4)
        ->and($coupon->note)->toBeNull()
        ->and(couponStoredPlans('QUEDATE20'))->toBe(couponPlanIds(['starter']))
        ->and(couponAudit('QUEDATE20', 'editar'))->toBe('30 % · 3 ciclos · starter');
});

it('el máximo de canjes no baja de los ya usados y un cupón inexistente responde 404', function () {
    actingAsPlatform();

    expect($this->patchJson('/api/v1/platform/coupons/QUEDATE20', couponBody(['max_redemptions' => 3])))->toBeApiError(422, 'COUPON_MAX')
        ->and($this->patchJson('/api/v1/platform/coupons/NOEXISTE', couponBody()))->toBeApiError(404);
    expect((int) couponRow('QUEDATE20')->max_redemptions)->toBe(30);
});

it('desactiva y reactiva el cupón y rechaza repetir el mismo estado', function () {
    actingAsPlatform();

    $this->postJson('/api/v1/platform/coupons/QUEDATE20/status', ['active' => false])->assertOk();
    expect(couponRow('QUEDATE20')->status)->toBe('inactive')
        ->and(couponAudit('QUEDATE20', 'desactivar'))->toBe('inactive');
    expect($this->postJson('/api/v1/platform/coupons/QUEDATE20/status', ['active' => false]))->toBeApiError(409, 'COUPON_STATUS');

    $this->postJson('/api/v1/platform/coupons/QUEDATE20/status', ['active' => true])->assertOk();
    expect(couponRow('QUEDATE20')->status)->toBe('active');
    $this->postJson('/api/v1/platform/coupons/QUEDATE20/status', [])->assertStatus(422)->assertJsonValidationErrors('active');
});

it('SUB-BR-07: el cupón aplica su descuento en la primera factura y consume un canje', function () {
    couponTrial();
    actingAsPlatform();

    $number = couponConvert('QUEDATE20')->assertOk()->json('data.invoice');
    $invoice = DB::connection('pgsql_platform')->table('platform_invoices')->where('series', 'FQ01')->where('number', (int) substr($number, 5))->first();
    $discount = DB::connection('pgsql_platform')->table('platform_invoice_lines')->where('invoice_id', $invoice->id)->where('line_type', 'discount')->first();
    $redemption = DB::connection('pgsql_platform')->table('coupon_redemptions')->where('coupon_id', couponRow('QUEDATE20')->id)->where('tenant_id', tenantA()->getKey())->first();

    expect((string) $discount->amount)->toBe('-578.00')
        ->and((string) $invoice->subtotal)->toBe('2312.00')
        ->and((string) $invoice->igv)->toBe('416.16')
        ->and((string) $invoice->total)->toBe('2728.16')
        ->and((int) couponRow('QUEDATE20')->redeemed_count)->toBe(5)
        ->and((int) $redemption->remaining_cycles)->toBe(2)
        ->and(DB::connection('pgsql_platform')->table('subscriptions')->where('tenant_id', tenantA()->getKey())->value('coupon_redemption_id'))->toBe($redemption->id);
});

it('un cupón de monto fijo recién creado descuenta su valor exacto', function () {
    couponTrial();
    actingAsPlatform();
    $this->postJson('/api/v1/platform/coupons', ['code' => 'MENOS300', ...couponBody(['type' => 'fixed', 'value' => 300, 'duration_cycles' => 1, 'plans' => ['enterprise']])])->assertCreated();

    $number = couponConvert('menos300')->assertOk()->json('data.invoice');
    $invoice = DB::connection('pgsql_platform')->table('platform_invoices')->where('series', 'FQ01')->where('number', (int) substr($number, 5))->first();

    expect((string) $invoice->subtotal)->toBe('2590.00')
        ->and((string) $invoice->total)->toBe('3056.20');
});

it('SUB-BR-07: el cupón desactivado, agotado o de otro plan no se canjea', function (Closure $prepare, string $message) {
    couponTrial();
    actingAsPlatform();
    $code = $prepare();

    $response = couponConvert($code);

    expect($response)->toBeApiError(422, 'COUPON_INVALID')
        ->and($response->json('message'))->toBe($message);
    expect(DB::connection('pgsql_platform')->table('subscriptions')->where('tenant_id', tenantA()->getKey())->value('status'))->toBe('trialing');
})->with([
    'desactivado' => [function () {
        test()->postJson('/api/v1/platform/coupons/QUEDATE20/status', ['active' => false])->assertOk();

        return 'QUEDATE20';
    }, 'El cupón está desactivado.'],
    'agotado' => [function () {
        test()->patchJson('/api/v1/platform/coupons/QUEDATE20', couponBody(['max_redemptions' => 4, 'plans' => ['starter', 'professional', 'enterprise']]))->assertOk();

        return 'QUEDATE20';
    }, 'El cupón ya no tiene canjes disponibles.'],
    'de otro plan' => [function () {
        test()->patchJson('/api/v1/platform/coupons/QUEDATE20', couponBody(['max_redemptions' => 30, 'plans' => ['starter']]))->assertOk();

        return 'QUEDATE20';
    }, 'El cupón no aplica al plan de esta agencia.'],
    'inexistente' => [fn () => 'NOEXISTE', 'El cupón no existe.'],
]);

it('el Tenant Admin no gestiona cupones de la plataforma', function () {
    actingAsSeed('U01');

    expect($this->postJson('/api/v1/platform/coupons', ['code' => 'HACK26', ...couponBody()])->status())->toBeIn([401, 403])
        ->and($this->patchJson('/api/v1/platform/coupons/QUEDATE20', couponBody())->status())->toBeIn([401, 403])
        ->and($this->postJson('/api/v1/platform/coupons/QUEDATE20/status', ['active' => false])->status())->toBeIn([401, 403]);
    expect(couponRow('QUEDATE20')->status)->toBe('active');
});
