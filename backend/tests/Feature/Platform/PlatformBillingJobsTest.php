<?php

use App\Jobs\CloseTrials;
use App\Jobs\ConsolidateUsage;
use App\Jobs\ExpireApiKeys;
use App\Jobs\PurgeWebhookDeliveries;
use App\Jobs\RenewSubscriptions;
use App\Jobs\WarnExpiringCards;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

function platformDb(): ConnectionInterface
{
    return DB::connection('pgsql_platform');
}

function runPlatformJob(string $class): string
{
    $job = new $class;
    $job->handle();

    return (string) $job->runResult;
}

function subscriptionOfA(): object
{
    return platformDb()->table('subscriptions')->where('tenant_id', tenantA()->getKey())->first();
}

function endPeriodYesterday(array $extra = []): void
{
    platformDb()->table('subscriptions')->where('tenant_id', tenantA()->getKey())->update(['current_period_start' => '2026-08-29', 'current_period_end' => '2026-09-28', 'status' => 'active', 'coupon_redemption_id' => null, ...$extra]);
}

it('PLT-01 renueva la suscripción vencida: factura exacta, cobro aprobado y periodo nuevo', function () {
    endPeriodYesterday();
    $plan = platformDb()->table('plans')->where('id', subscriptionOfA()->plan_id)->first();

    $result = runPlatformJob(RenewSubscriptions::class);

    $subscription = subscriptionOfA();
    $invoice = platformDb()->table('platform_invoices')->where('subscription_id', $subscription->id)->where('period_from', '2026-09-29')->first();
    $subtotal = platformDb()->table('subscription_items')->where('subscription_id', $subscription->id)->get()->reduce(fn (string $sum, object $item): string => bcadd($sum, bcmul((string) $item->unit_price, (string) $item->quantity, 2), 2), bcadd((string) $plan->price_month, '0', 2));
    $igv = bcadd(bcdiv(bcmul($subtotal, '18', 4), '100', 4), '0.005', 2);

    expect($result)->toContain('1 suscripción renovada')->toContain('1 cobro aprobado')
        ->and($subscription->current_period_start)->toBe('2026-09-29')
        ->and($subscription->current_period_end)->toBe('2026-10-28')
        ->and($invoice->status)->toBe('paid')
        ->and((string) $invoice->subtotal)->toBe($subtotal)
        ->and((string) $invoice->total)->toBe(bcadd((string) $invoice->subtotal, (string) $invoice->igv, 2))
        ->and((string) $invoice->igv)->toBe($igv);

    expect(runPlatformJob(RenewSubscriptions::class))->toBe('Sin renovaciones del día');
});

function scheduleChange(string $from, string $to, string $kind): object
{
    $plans = platformDb()->table('plans')->whereIn('code', [$from, $to])->pluck('id', 'code');
    endPeriodYesterday(['plan_id' => $plans[$from]]);
    platformDb()->table('tenants')->where('id', tenantA()->getKey())->update(['plan_id' => $plans[$from]]);
    $subscription = subscriptionOfA();
    platformDb()->table('subscription_changes')->insert(['id' => (string) Str::uuid7(), 'subscription_id' => $subscription->id, 'kind' => $kind, 'from_plan_id' => $plans[$from], 'to_plan_id' => $plans[$to], 'from_cycle' => 'monthly', 'to_cycle' => 'monthly', 'effective_at' => '2026-09-29', 'status' => 'scheduled', 'created_at' => now()]);

    return (object) ['subscription' => $subscription, 'from' => $plans[$from], 'to' => $plans[$to]];
}

it('PLT-01 aplica el cambio de plan programado al renovar', function () {
    $change = scheduleChange('professional', 'enterprise', 'upgrade');

    $result = runPlatformJob(RenewSubscriptions::class);

    expect($result)->toContain('1 cambio de plan aplicado')
        ->and(subscriptionOfA()->plan_id)->toBe($change->to)
        ->and(platformDb()->table('tenants')->where('id', tenantA()->getKey())->value('plan_id'))->toBe($change->to)
        ->and(platformDb()->table('subscription_changes')->where('subscription_id', $change->subscription->id)->value('status'))->toBe('applied');
});

it('SUB-BR-03 la bajada programada se revalida al renovar: si el consumo no entra, no se aplica y se anula', function () {
    $change = scheduleChange('enterprise', 'starter', 'downgrade');

    $result = runPlatformJob(RenewSubscriptions::class);

    expect($result)->toContain('1 suscripción renovada')->toContain('1 bajada de plan bloqueada por el consumo')
        ->and(subscriptionOfA()->plan_id)->toBe($change->from)
        ->and(platformDb()->table('subscription_changes')->where('subscription_id', $change->subscription->id)->value('status'))->toBe('voided');
});

it('SUB-BR-03 la consola no baja de plan a una agencia que excede los límites y lista los motivos', function () {
    actingAsPlatform();

    $response = $this->postJson('/api/v1/platform/tenants/'.tenantA()->getKey().'/change-plan', ['plan' => 'starter', 'reason' => 'Prueba de bajada'], ['If-Match' => (string) platformDb()->table('tenants')->where('id', tenantA()->getKey())->value('lock_version')]);

    expect($response)->toBeApiError(422, 'SUB_DOWNGRADE_BLOCKED')
        ->and($response->json('error.details.blockers') ?? $response->json('details.blockers'))->toBeArray()->not->toBeEmpty()
        ->and(platformDb()->table('tenants')->where('id', tenantA()->getKey())->value('plan_id'))->toBe(platformDb()->table('plans')->where('code', 'enterprise')->value('id'));
});

it('PLT-01 con la tarjeta rechazada deja la factura en cobranza y la suscripción con pago pendiente', function () {
    endPeriodYesterday();
    platformDb()->table('payment_methods')->where('tenant_id', tenantA()->getKey())->update(['status' => 'expired']);

    $result = runPlatformJob(RenewSubscriptions::class);
    $invoice = platformDb()->table('platform_invoices')->where('subscription_id', subscriptionOfA()->id)->where('period_from', '2026-09-29')->first();

    expect($result)->toContain('1 cobro rechazado')
        ->and($invoice->status)->toBe('failed')
        ->and($invoice->dunning_next_retry_at)->not->toBeNull()
        ->and(subscriptionOfA()->status)->toBe('past_due');
});

it('PLT-01 cierra la suscripción con cancelación programada y suspende la agencia', function () {
    endPeriodYesterday(['status' => 'cancel_scheduled']);

    $result = runPlatformJob(RenewSubscriptions::class);

    expect($result)->toBe('1 cancelación aplicada')
        ->and(subscriptionOfA()->status)->toBe('canceled')
        ->and(platformDb()->table('tenants')->where('id', tenantA()->getKey())->value('status'))->toBe('suspendido');
});

it('PLT-03 avisa a 3 días del fin de la prueba y suspende la prueba vencida sin tarjeta', function () {
    platformDb()->table('subscriptions')->where('tenant_id', tenantA()->getKey())->update(['status' => 'trialing', 'trial_ends_at' => '2026-10-02']);

    expect(runPlatformJob(CloseTrials::class))->toBe('1 aviso de fin de prueba');

    platformDb()->table('subscriptions')->where('tenant_id', tenantA()->getKey())->update(['trial_ends_at' => '2026-09-28']);
    platformDb()->table('payment_methods')->where('tenant_id', tenantA()->getKey())->update(['status' => 'removed']);

    expect(runPlatformJob(CloseTrials::class))->toBe('1 agencia suspendida sin tarjeta')
        ->and(subscriptionOfA()->status)->toBe('suspended')
        ->and(platformDb()->table('tenants')->where('id', tenantA()->getKey())->value('status'))->toBe('suspendido');
});

it('PLT-03 convierte la prueba vencida con tarjeta y cobra la primera factura', function () {
    platformDb()->table('subscriptions')->where('tenant_id', tenantA()->getKey())->update(['status' => 'trialing', 'trial_ends_at' => '2026-09-28', 'current_period_end' => '2026-09-28']);

    $result = runPlatformJob(CloseTrials::class);

    expect($result)->toBe('1 prueba convertida a plan pagado')
        ->and(subscriptionOfA()->status)->toBe('active')
        ->and(platformDb()->table('platform_invoices')->where('subscription_id', subscriptionOfA()->id)->where('period_from', '2026-09-29')->value('status'))->toBe('paid');
});

it('PLT-04 marca la tarjeta vencida y avisa de la que vence en 30 días', function () {
    platformDb()->table('payment_methods')->where('tenant_id', tenantA()->getKey())->update(['exp_month' => 9, 'exp_year' => 2026]);

    expect(runPlatformJob(WarnExpiringCards::class))->toBe('1 aviso de tarjeta');

    platformDb()->table('payment_methods')->where('tenant_id', tenantA()->getKey())->update(['exp_month' => 8, 'exp_year' => 2026]);

    expect(runPlatformJob(WarnExpiringCards::class))->toBe('1 aviso de tarjeta · 1 tarjeta marcada como vencida')
        ->and(platformDb()->table('payment_methods')->where('tenant_id', tenantA()->getKey())->value('status'))->toBe('expired');
});

it('PLT-05 consolida el uso del mes y avisa una sola vez al pasar el 80 %', function () {
    $tenant = (string) tenantA()->getKey();
    $limit = (int) platformDb()->table('plan_limits')->where('plan_id', platformDb()->table('tenants')->where('id', $tenant)->value('plan_id'))->where('metric', 'reservations_month')->value('value');
    platformDb()->table('usage_counters')->where('tenant_id', $tenant)->where('metric', 'reservations_month')->delete();
    platformDb()->table('usage_counters')->insert([['tenant_id' => $tenant, 'metric' => 'reservations_month', 'day' => '2026-09-10', 'value' => intdiv($limit * 50, 100)], ['tenant_id' => $tenant, 'metric' => 'reservations_month', 'day' => '2026-09-20', 'value' => intdiv($limit * 35, 100)]]);
    platformDb()->table('usage_monthly')->where('tenant_id', $tenant)->where('month', '2026-09-01')->delete();

    $first = runPlatformJob(ConsolidateUsage::class);
    $second = runPlatformJob(ConsolidateUsage::class);
    $row = platformDb()->table('usage_monthly')->where('tenant_id', $tenant)->where('metric', 'reservations_month')->where('month', '2026-09-01')->first();

    expect($first)->toContain('1 aviso de límite')
        ->and($second)->not->toContain('aviso de límite')
        ->and((int) $row->value)->toBe(intdiv($limit * 50, 100) + intdiv($limit * 35, 100))
        ->and((int) $row->limit_value)->toBe($limit)
        ->and($row->alert_80_sent_at)->not->toBeNull()
        ->and($row->alert_100_sent_at)->toBeNull();
});

it('PLT-07 vence la llave de API con fecha cumplida', function () {
    platformDb()->table('integration_api_keys')->where('code', 'KEY-0003')->update(['expires_at' => '2026-09-28']);

    expect(runPlatformJob(ExpireApiKeys::class))->toBe('1 llave vencida')
        ->and(platformDb()->table('integration_api_keys')->where('code', 'KEY-0003')->value('status'))->toBe('expired');
});

it('PLT-08 depura las entregas de webhooks de más de 30 días y conserva las recientes', function () {
    $recent = platformDb()->table('integration_webhook_deliveries')->where('created_at', '>=', now()->subDays(30))->count();
    $webhook = platformDb()->table('integration_webhooks')->value('id');
    platformDb()->table('integration_webhook_deliveries')->insert(['id' => (string) Str::uuid7(), 'tenant_id' => tenantA()->getKey(), 'code' => 'WHD-VIEJA', 'webhook_id' => $webhook, 'event_type' => 'reservation.confirmed', 'event_id' => 'evt-viejo', 'payload' => '{}', 'attempt' => 1, 'status' => 'delivered', 'manual' => false, 'created_at' => '2026-08-01 10:00:00']);

    expect(runPlatformJob(PurgeWebhookDeliveries::class))->toContain('entrega')
        ->and(platformDb()->table('integration_webhook_deliveries')->where('code', 'WHD-VIEJA')->exists())->toBeFalse()
        ->and(platformDb()->table('integration_webhook_deliveries')->where('created_at', '>=', now()->subDays(30))->count())->toBe($recent);
});

it('Ejecutar ahora corre la clase real del proceso de plataforma y deja la ejecución registrada', function () {
    actingAsPlatform();

    $response = $this->postJson('/api/v1/platform/jobs/PLT-08/run');

    $job = platformDb()->table('sys_scheduled_jobs')->whereNull('tenant_id')->where('code', 'PLT-08')->first();

    expect($response->status())->toBeLessThan(300)
        ->and($job->last_status)->toBe('ok')
        ->and(platformDb()->table('sys_job_runs')->where('scheduled_job_id', $job->id)->where('trigger', 'manual')->exists())->toBeTrue();
});
