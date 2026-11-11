<?php

use App\Domain\Platform\Support\Entitlements;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;

beforeEach(function () {
    $this->withoutMiddleware(ThrottleRequests::class);
    Queue::fake();
    lockPlatformBilling();
});

function subDb(): ConnectionInterface
{
    return DB::connection('pgsql_platform');
}

function subPlanId(string $code): string
{
    return (string) subDb()->table('plans')->where('code', $code)->value('id');
}

function subSetPlan(string $plan, string $cycle = 'monthly', string $status = 'active'): object
{
    $tenant = tenantA()->getKey();
    $today = Carbon::today('America/Lima');
    subDb()->table('subscription_changes')->whereIn('subscription_id', subDb()->table('subscriptions')->where('tenant_id', $tenant)->pluck('id'))->where('status', 'scheduled')->update(['status' => 'voided']);
    subDb()->table('subscriptions')->where('tenant_id', $tenant)->where('status', '<>', 'canceled')->update([
        'plan_id' => subPlanId($plan),
        'cycle' => $cycle,
        'status' => $status,
        'auto_renew' => true,
        'cancel_at' => null,
        'coupon_redemption_id' => null,
        'credit_balance' => 0,
        'current_period_start' => $today->copy()->subDays(10)->toDateString(),
        'current_period_end' => $today->copy()->addDays(19)->toDateString(),
    ]);
    subDb()->table('subscription_items')->whereIn('subscription_id', subDb()->table('subscriptions')->where('tenant_id', $tenant)->pluck('id'))->delete();
    subDb()->table('tenants')->where('id', $tenant)->update(['plan_id' => subPlanId($plan)]);
    Entitlements::flush();

    return subDb()->table('subscriptions')->where('tenant_id', $tenant)->where('status', '<>', 'canceled')->first();
}

function subAudited(string $action): bool
{
    return withinTenant(tenantA(), fn () => DB::table('audit_events')->where('entity', 'Suscripción')->where('action', $action)->exists());
}

function subCurrent(): object
{
    return subDb()->table('subscriptions')->where('tenant_id', tenantA()->getKey())->where('status', '<>', 'canceled')->first();
}

it('cambio de plan: la vista previa calcula el prorrateo y el upgrade se aplica al instante con su factura', function () {
    subSetPlan('professional');
    actingAsSeed('U01');

    $preview = $this->postJson('/api/v1/billing/subscription/preview-change', ['plan' => 'enterprise', 'cycle' => 'monthly'])->assertOk()->json('data');
    expect($preview['kind'])->toBe('upgrade')
        ->and($preview['immediate'])->toBeTrue()
        ->and($preview['proration']['days_left'])->toBe(20)
        ->and($preview['proration']['period_days'])->toBe(30)
        ->and((float) $preview['proration']['net'])->toEqualWithDelta((float) $preview['proration']['charge'] - (float) $preview['proration']['credit'], 0.001)
        ->and($preview['blockers'])->toBe([]);

    $result = $this->postJson('/api/v1/billing/subscription/change', ['plan' => 'enterprise', 'cycle' => 'monthly'], critical())->assertOk()->json('data');
    expect($result['invoice']['number'])->toStartWith('FQ01-')
        ->and($result['charge'])->not->toBeNull()
        ->and(subCurrent()->plan_id)->toBe(subPlanId('enterprise'))
        ->and(subDb()->table('tenants')->where('id', tenantA()->getKey())->value('plan_id'))->toBe(subPlanId('enterprise'))
        ->and(subDb()->table('platform_invoices')->where('tenant_id', tenantA()->getKey())->where('kind', 'proration')->exists())->toBeTrue()
        ->and(subDb()->table('subscription_changes')->where('subscription_id', subCurrent()->id)->where('kind', 'upgrade')->where('status', 'applied')->exists())->toBeTrue();
    expect(subAudited('cambio_plan'))->toBeTrue();

    expect($this->postJson('/api/v1/billing/subscription/change', ['plan' => 'enterprise', 'cycle' => 'monthly'], critical()))->toBeApiError(422, 'SUB_NO_CHANGE');
});

it('cambio de plan: pasar de anual a mensual se programa, solo hay un cambio programado y se puede anular', function () {
    subSetPlan('professional', 'annual');
    actingAsSeed('U01');

    $result = $this->postJson('/api/v1/billing/subscription/change', ['plan' => 'professional', 'cycle' => 'monthly'], critical())->assertOk()->json('data');
    expect($result['kind'])->toBe('cycle')->and($result['immediate'])->toBeFalse()->and($result['invoice'])->toBeNull();
    expect($this->getJson('/api/v1/billing/subscription')->json('data.subscription.scheduled.cycle'))->toBe('monthly');

    expect($this->postJson('/api/v1/billing/subscription/change', ['plan' => 'professional', 'cycle' => 'monthly'], critical()))->toBeApiError(409, 'SUB_CHANGE_SCHEDULED');

    $this->deleteJson('/api/v1/billing/subscription/scheduled-change')->assertNoContent();
    expect($this->deleteJson('/api/v1/billing/subscription/scheduled-change'))->toBeApiError(404);
    expect(subAudited('anular_cambio_programado'))->toBeTrue();
});

it('cambio de plan: una bajada que el consumo no permite se rechaza con la lista de bloqueos', function () {
    subSetPlan('professional');
    subDb()->table('plan_limits')->where('plan_id', subPlanId('starter'))->where('metric', 'users')->update(['value' => 1]);
    actingAsSeed('U01');

    $response = $this->postJson('/api/v1/billing/subscription/change', ['plan' => 'starter', 'cycle' => 'monthly'], critical());
    expect($response)->toBeApiError(422, 'SUB_DOWNGRADE_BLOCKED');
    expect($this->postJson('/api/v1/billing/subscription/preview-change', ['plan' => 'starter', 'cycle' => 'monthly'])->json('data.blockers'))->not->toBeEmpty();
});

it('cancelar exige la encuesta, deja la cancelación al cierre del periodo y se puede reanudar', function () {
    $subscription = subSetPlan('professional');
    actingAsSeed('U01');

    expect($this->postJson('/api/v1/billing/subscription/cancel', ['accept' => true]))->toBeApiError(422);

    $this->postJson('/api/v1/billing/subscription/cancel', ['reason' => 'Precio', 'score' => 7, 'accept' => true])->assertOk()->assertJsonPath('data.cancel_at', $subscription->current_period_end);
    $after = subCurrent();
    expect($after->status)->toBe('cancel_scheduled')->and((bool) $after->auto_renew)->toBeFalse()->and(json_decode($after->cancel_survey, true)['reason'])->toBe('Precio');

    expect($this->postJson('/api/v1/billing/subscription/change', ['plan' => 'enterprise', 'cycle' => 'monthly'], critical()))->toBeApiError(409, 'SUB_NOT_ACTIVE');
    expect($this->patchJson('/api/v1/billing/subscription', ['auto_renew' => true]))->toBeApiError(409, 'SUB_CANCEL_SCHEDULED');

    $this->postJson('/api/v1/billing/subscription/resume')->assertOk();
    expect(subCurrent()->status)->toBe('active')->and(subCurrent()->cancel_at)->toBeNull();
    expect($this->postJson('/api/v1/billing/subscription/resume'))->toBeApiError(409, 'SUB_NOT_ACTIVE');

    $version = (int) subCurrent()->lock_version;
    expect($this->patchJson('/api/v1/billing/subscription', ['auto_renew' => false], ['If-Match' => (string) ($version - 1)]))->toBeApiError(409, 'STALE_VERSION');
    $this->patchJson('/api/v1/billing/subscription', ['auto_renew' => false], ['If-Match' => (string) $version])->assertOk();
    expect((bool) subCurrent()->auto_renew)->toBeFalse();
    expect(subAudited('renovacion_automatica'))->toBeTrue();
});

it('complementos: contratar, ajustar sin bajar de lo consumido, retirar al cierre y mantener', function () {
    $subscription = subSetPlan('professional');
    actingAsSeed('U01');

    $this->postJson('/api/v1/billing/addons/whatsapp_pack', ['quantity' => 2], critical())->assertOk()->assertJsonPath('data.quantity', 2);
    expect($this->postJson('/api/v1/billing/addons/whatsapp_pack', ['quantity' => 1], critical()))->toBeApiError(409, 'ADDON_ACTIVE');
    expect(subDb()->table('platform_invoices')->where('tenant_id', tenantA()->getKey())->where('kind', 'addon')->exists())->toBeTrue();

    $base = (int) subDb()->table('plan_limits')->where('plan_id', subPlanId('professional'))->where('metric', 'whatsapp_month')->value('value');
    subDb()->table('usage_monthly')->updateOrInsert(['tenant_id' => tenantA()->getKey(), 'metric' => 'whatsapp_month', 'month' => Carbon::today('America/Lima')->startOfMonth()->toDateString()], ['value' => $base + 1500]);
    expect($this->patchJson('/api/v1/billing/addons/whatsapp_pack', ['quantity' => 1], critical()))->toBeApiError(422, 'SUB-BR-06');
    $this->patchJson('/api/v1/billing/addons/whatsapp_pack', ['quantity' => 3], critical())->assertOk()->assertJsonPath('data.quantity', 3);

    $this->deleteJson('/api/v1/billing/addons/whatsapp_pack', [], critical())->assertNoContent();
    $item = subDb()->table('subscription_items')->where('subscription_id', $subscription->id)->where('addon_code', 'whatsapp_pack')->first();
    expect($item->ends_at)->toBe($subscription->current_period_end);
    expect($this->deleteJson('/api/v1/billing/addons/whatsapp_pack', [], critical()))->toBeApiError(409, 'ADDON_REMOVAL_SCHEDULED');

    $this->postJson('/api/v1/billing/addons/whatsapp_pack', [], critical())->assertOk()->assertJsonPath('data.action', 'addon_mantener');
    expect(subDb()->table('subscription_items')->where('id', $item->id)->value('ends_at'))->toBeNull();

    expect($this->postJson('/api/v1/billing/addons/custom_domain', [], critical()))->toBeApiError(422);
    subSetPlan('enterprise');
    expect($this->postJson('/api/v1/billing/addons/b2b_full', [], critical()))->toBeApiError(409, 'ADDON_INCLUDED');
});

it('cupón: se canjea si está vigente y aplica al plan, no se acumula y el rechazo queda auditado', function () {
    subSetPlan('professional');
    $make = fn (string $code, array $plans) => subDb()->table('coupons')->insert(['id' => (string) Str::uuid7(), 'code' => $code, 'type' => 'percent', 'value' => 10, 'duration_cycles' => 2, 'plan_ids' => '{'.implode(',', $plans).'}', 'max_redemptions' => 5, 'redeemed_count' => 0, 'valid_to' => Carbon::today()->addMonth()->toDateString(), 'status' => 'active', 'created_at' => now()]);
    $make('PRUEBA10', [subPlanId('professional')]);
    $make('OTRO10', [subPlanId('professional')]);
    $make('SOLOSTARTER', [subPlanId('starter')]);
    actingAsSeed('U01');

    expect($this->postJson('/api/v1/billing/coupon', ['code' => 'SOLOSTARTER']))->toBeApiError(422, 'COUPON_PLAN');
    $this->postJson('/api/v1/billing/coupon', ['code' => 'prueba10'])->assertOk()->assertJsonPath('data.code', 'PRUEBA10');
    expect($this->getJson('/api/v1/billing/subscription')->json('data.subscription.coupon.code'))->toBe('PRUEBA10');
    expect($this->postJson('/api/v1/billing/coupon', ['code' => 'OTRO10']))->toBeApiError(409, 'COUPON_NOT_STACKABLE');
    expect($this->postJson('/api/v1/billing/coupon', ['code' => 'NOEXISTE']))->toBeApiError(422, 'COUPON_INVALID');
    expect(auditExists(['action' => 'cupon_rechazado']))->toBeTrue();
});

it('facturas: lista, detalle con líneas e intentos, y pagar ahora con la tarjeta registrada', function () {
    subSetPlan('professional');
    subDb()->table('payment_methods')->where('tenant_id', tenantA()->getKey())->delete();
    actingAsSeed('U01');

    $result = $this->postJson('/api/v1/billing/addons/storage_pack', ['quantity' => 1], critical())->assertOk()->json('data');
    expect($result['charge']['result'])->toBe('declined');
    $number = $result['invoice']['number'];

    expect(collect($this->getJson('/api/v1/billing/invoices')->assertOk()->json('data'))->pluck('number'))->toContain($number);
    $detail = $this->getJson("/api/v1/billing/invoices/{$number}")->assertOk()->json('data');
    expect($detail['status'])->toBe('failed')->and($detail['lines'])->not->toBeEmpty()->and($detail['attempts'])->not->toBeEmpty();

    subDb()->table('payment_methods')->insert(['id' => (string) Str::uuid7(), 'tenant_id' => tenantA()->getKey(), 'gateway_token' => 'tok_local_test', 'brand' => 'Visa', 'last4' => '4242', 'exp_month' => 12, 'exp_year' => 2030, 'holder' => 'Andes Horizonte', 'is_default' => true, 'status' => 'active', 'created_at' => now()->addSecond()]);
    $this->postJson("/api/v1/billing/invoices/{$number}/pay", [], critical())->assertOk()->assertJsonPath('data.status', 'paid');
    expect($this->postJson("/api/v1/billing/invoices/{$number}/pay", [], critical()))->toBeApiError(409, 'INVOICE_NOT_COLLECTIBLE');
    expect($this->getJson('/api/v1/billing/invoices/FQ01-99999999'))->toBeApiError(404);
});

it('qué incluye el plan y permisos: solo quien gestiona la facturación cambia la suscripción', function () {
    subSetPlan('professional');
    actingAsSeed('U01');
    $rules = $this->getJson('/api/v1/billing/plan-rules')->assertOk()->json('data');
    expect($rules['current'])->toBe('professional')->and($rules['plans'])->toHaveCount(3);
    expect(collect($this->getJson('/api/v1/billing/usage')->assertOk()->json('data'))->pluck('metric'))->toContain('users', 'whatsapp_month');

    actingAsSeed('U03');
    expect($this->postJson('/api/v1/billing/subscription/preview-change', ['plan' => 'enterprise', 'cycle' => 'monthly'])->status())->toBe(403);
    expect($this->postJson('/api/v1/billing/coupon', ['code' => 'X'])->status())->toBe(403);
});
