<?php

use App\Jobs\SendPlainMail;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;

beforeEach(function () {
    lockPlatformBilling();
    Queue::fake();
});

function consoleDb(): ConnectionInterface
{
    return DB::connection('pgsql_platform');
}

function consoleSubscription(): object
{
    return consoleDb()->table('subscriptions')->where('tenant_id', tenantA()->getKey())->where('status', '<>', 'canceled')->first();
}

function consolePlanId(string $code): string
{
    return (string) consoleDb()->table('plans')->where('code', $code)->value('id');
}

function consoleOnPlan(string $code, array $extra = []): void
{
    consoleDb()->table('subscriptions')->where('tenant_id', tenantA()->getKey())->update(['plan_id' => consolePlanId($code), 'status' => 'active', 'cycle' => 'monthly', 'current_period_start' => '2026-09-03', 'current_period_end' => '2026-10-02', ...$extra]);
    consoleDb()->table('tenants')->where('id', tenantA()->getKey())->update(['plan_id' => consolePlanId($code)]);
    consoleDb()->table('subscription_changes')->where('subscription_id', consoleSubscription()->id)->where('status', 'scheduled')->update(['status' => 'voided']);
}

function consoleVersion(): array
{
    return critical((int) consoleDb()->table('tenants')->where('id', tenantA()->getKey())->value('lock_version'));
}

it('SUB-BR-01: la consola previsualiza y aplica una subida inmediata con prorrateo y la registra en ambas bitácoras', function () {
    consoleOnPlan('professional');
    actingAsPlatform();

    $preview = $this->postJson('/api/v1/platform/tenants/TNT-0001/change-plan/preview', ['plan' => 'enterprise', 'effective' => 'immediate'])->assertOk()->json('data');

    expect($preview['kind'])->toBe('upgrade')
        ->and($preview['immediate'])->toBeTrue()
        ->and($preview['proration']['days_left'])->toBe(4)
        ->and($preview['proration']['period_days'])->toBe(30)
        ->and($preview['proration']['net'])->toBe('226.66')
        ->and(consoleSubscription()->plan_id)->toBe(consolePlanId('professional'));

    $response = $this->postJson('/api/v1/platform/tenants/TNT-0001/change-plan', ['plan' => 'enterprise', 'effective' => 'immediate', 'reason' => 'Suma la tienda en línea'], consoleVersion())->assertOk();

    expect($response->json('meta.change.action'))->toBe('cambio_plan')
        ->and($response->json('meta.change.invoice.number'))->toStartWith('FQ01-')
        ->and($response->json('data.plan.code'))->toBe('enterprise')
        ->and(consoleSubscription()->plan_id)->toBe(consolePlanId('enterprise'))
        ->and(consoleDb()->table('audit_events')->whereNull('tenant_id')->where(['entity' => 'Tenant', 'entity_id' => 'TNT-0001', 'action' => 'cambio_plan'])->orderByDesc('occurred_at')->value('after_value'))->toBe('Enterprise · mensual · Suma la tienda en línea')
        ->and(consoleDb()->table('audit_events')->where('tenant_id', tenantA()->getKey())->where(['entity' => 'Suscripción', 'action' => 'cambio_plan'])->where('actor_type', 'platform_user')->exists())->toBeTrue();
});

it('SUB-BR-02: programa el cambio para el cierre del ciclo, lo muestra en la ficha y se puede anular', function () {
    consoleOnPlan('professional');
    actingAsPlatform();

    $response = $this->postJson('/api/v1/platform/tenants/TNT-0001/change-plan', ['plan' => 'enterprise', 'effective' => 'next_cycle'], consoleVersion())->assertOk();

    expect($response->json('meta.change.action'))->toBe('cambio_plan_programado')
        ->and($response->json('meta.change.effective_at'))->toBe('2026-10-03')
        ->and($response->json('meta.change.invoice'))->toBeNull()
        ->and($response->json('data.subscription.scheduled.plan.code'))->toBe('enterprise')
        ->and($response->json('data.subscription.scheduled.effective_at'))->toBe('2026-10-03')
        ->and(consoleSubscription()->plan_id)->toBe(consolePlanId('professional'));

    expect($this->postJson('/api/v1/platform/tenants/TNT-0001/change-plan', ['plan' => 'enterprise', 'effective' => 'next_cycle'], consoleVersion()))->toBeApiError(409, 'SUB_CHANGE_SCHEDULED');

    $this->deleteJson('/api/v1/platform/tenants/TNT-0001/scheduled-change')->assertOk()->assertJsonPath('data.subscription.scheduled', null);

    expect(consoleDb()->table('audit_events')->whereNull('tenant_id')->where(['entity' => 'Tenant', 'entity_id' => 'TNT-0001', 'action' => 'anular_cambio_programado'])->exists())->toBeTrue();
    expect($this->deleteJson('/api/v1/platform/tenants/TNT-0001/scheduled-change'))->toBeApiError(404);
});

it('SUB-BR-02: una bajada o el paso de anual a mensual no se aplica de inmediato', function () {
    consoleOnPlan('enterprise', ['cycle' => 'annual', 'current_period_start' => '2026-01-03', 'current_period_end' => '2027-01-02']);
    actingAsPlatform();

    expect($this->postJson('/api/v1/platform/tenants/TNT-0001/change-plan/preview', ['plan' => 'enterprise', 'cycle' => 'monthly', 'effective' => 'immediate']))->toBeApiError(422, 'SUB-BR-02');

    $preview = $this->postJson('/api/v1/platform/tenants/TNT-0001/change-plan/preview', ['plan' => 'enterprise', 'cycle' => 'monthly', 'effective' => 'next_cycle'])->assertOk()->json('data');

    expect($preview['kind'])->toBe('cycle')
        ->and($preview['effective_at'])->toBe('2027-01-03')
        ->and($preview['proration'])->toBeNull();
});

it('el cambio de plan valida el plan, la vigencia y que haya un cambio real', function () {
    consoleOnPlan('professional');
    actingAsPlatform();

    expect($this->postJson('/api/v1/platform/tenants/TNT-0001/change-plan/preview', ['plan' => 'professional']))->toBeApiError(409, 'SAME_PLAN');
    expect($this->postJson('/api/v1/platform/tenants/TNT-0001/change-plan/preview', ['plan' => 'premium']))->toBeApiError(422, 'PLAN');
    expect($this->postJson('/api/v1/platform/tenants/TNT-0001/change-plan/preview', ['plan' => 'enterprise', 'effective' => 'mañana'])->status())->toBe(422);
    expect($this->postJson('/api/v1/platform/tenants/TNT-9999/change-plan/preview', ['plan' => 'enterprise']))->toBeApiError(404);
});

it('convierte una prueba con el plan y el ciclo elegidos y avisa a la agencia', function () {
    consoleOnPlan('enterprise', ['status' => 'trialing', 'trial_ends_at' => '2026-10-05', 'current_period_end' => '2026-10-05', 'coupon_redemption_id' => null]);
    consoleDb()->table('tenants')->where('id', tenantA()->getKey())->update(['status' => 'prueba']);
    actingAsPlatform();

    $response = $this->postJson('/api/v1/platform/trials/TNT-0001/convert', ['plan' => 'enterprise', 'cycle' => 'annual'], critical())->assertOk();
    $subscription = consoleSubscription();

    expect($response->json('data.plan'))->toBe('Enterprise')
        ->and($response->json('data.total'))->toBe('34102.00')
        ->and($subscription->status)->toBe('active')
        ->and($subscription->cycle)->toBe('annual')
        ->and($subscription->current_period_end)->toBe('2027-09-28')
        ->and((string) consoleDb()->table('tenants')->where('id', tenantA()->getKey())->value('mrr'))->toBe('2408.33');
    Queue::assertPushed(SendPlainMail::class, fn (SendPlainMail $mail) => str_contains($mail->subject, 'Bienvenido al plan Enterprise'));
});

it('no convierte una prueba a un plan menor si el consumo no cabe y valida el ciclo', function () {
    consoleOnPlan('enterprise', ['status' => 'trialing', 'trial_ends_at' => '2026-10-05', 'current_period_end' => '2026-10-05', 'coupon_redemption_id' => null]);
    actingAsPlatform();

    expect($this->postJson('/api/v1/platform/trials/TNT-0001/convert', ['plan' => 'starter'], critical()))->toBeApiError(422, 'SUB_DOWNGRADE_BLOCKED');
    expect($this->postJson('/api/v1/platform/trials/TNT-0001/convert', ['plan' => 'enterprise', 'cycle' => 'semanal'], critical())->status())->toBe(422);
    expect(consoleSubscription()->status)->toBe('trialing');
});

it('PLN-BR-04: simula y aplica el plan mínimo de una regla, avisa a las agencias afectadas y se restablece la matriz', function () {
    actingAsPlatform();
    $tenantId = tenantA()->getKey();

    $dry = $this->putJson('/api/v1/platform/plan-rules/R-PAY-LATER?dry_run=1', ['min_plan' => 'professional'])->assertOk()->json('data');

    expect($dry['dry_run'])->toBeTrue()
        ->and($dry['effect'])->toBe('gain')
        ->and(collect($dry['affected_tenants'])->pluck('code')->all())->toContain('TNT-0002')
        ->and(consoleDb()->table('plan_rule_entitlements')->where('rule_code', 'R-PAY-LATER')->value('min_plan'))->toBe('Enterprise');
    Queue::assertNothingPushed();

    $applied = $this->putJson('/api/v1/platform/plan-rules/R-PAY-LATER', ['min_plan' => 'professional'])->assertOk()->json('data');

    expect($applied['dry_run'])->toBeFalse()
        ->and(consoleDb()->table('plan_rule_entitlements')->where('rule_code', 'R-PAY-LATER')->value('min_plan'))->toBe('Professional')
        ->and(consoleDb()->table('sys_booking_rules')->where('tenant_id', $tenantId)->where('code', 'R-PAY-LATER')->value('min_plan'))->toBe('Professional')
        ->and(consoleDb()->table('audit_events')->whereNull('tenant_id')->where(['entity' => 'Plan × regla', 'entity_id' => 'R-PAY-LATER', 'action' => 'cambiar_plan_minimo'])->value('after_value'))->toContain('ganan la regla');
    Queue::assertPushed(SendPlainMail::class, fn (SendPlainMail $mail) => $mail->subject === 'Cambio en las reglas incluidas en tu plan');

    $matrix = $this->getJson('/api/v1/platform/plan-rules')->assertOk()->json('data');
    expect($matrix['differs'])->toBe(1);

    $reset = $this->postJson('/api/v1/platform/plan-rules/reset-demo', [], critical())->assertOk()->json('data');

    expect($reset['restored'])->toBe(1)
        ->and(consoleDb()->table('plan_rule_entitlements')->where('rule_code', 'R-PAY-LATER')->value('min_plan'))->toBe('Enterprise')
        ->and(consoleDb()->table('sys_booking_rules')->where('tenant_id', $tenantId)->where('code', 'R-PAY-LATER')->value('min_plan'))->toBe('Enterprise');
    expect($this->postJson('/api/v1/platform/plan-rules/reset-demo', [], critical()))->toBeApiError(422, 'CFG-BR-01');
});

it('el plan mínimo valida la regla, el plan y que haya un cambio', function () {
    actingAsPlatform();

    expect($this->putJson('/api/v1/platform/plan-rules/R-PAY-LATER', ['min_plan' => 'enterprise']))->toBeApiError(422, 'CFG-BR-01');
    expect($this->putJson('/api/v1/platform/plan-rules/R-NO-EXISTE', ['min_plan' => 'starter']))->toBeApiError(404);
    expect($this->putJson('/api/v1/platform/plan-rules/R-PAY-LATER', ['min_plan' => 'premium']))->toBeApiError(422, 'PLAN');
    expect($this->putJson('/api/v1/platform/plan-rules/R-PAY-LATER', [])->status())->toBe(422);
});

it('cobranza: envía el enlace de pago de una factura pendiente y reenvía cualquier factura por correo', function () {
    actingAsPlatform();
    $invoice = consoleDb()->table('platform_invoices')->where('tenant_id', tenantA()->getKey())->orderByDesc('issue_date')->first();
    consoleDb()->table('platform_invoices')->where('id', $invoice->id)->update(['status' => 'failed']);

    $this->postJson("/api/v1/platform/invoices/{$invoice->id}/payment-link")->assertOk()->assertJsonPath('data.sent_to', 'facturacion@andeshorizonte.pe');
    Queue::assertPushed(SendPlainMail::class, fn (SendPlainMail $mail) => $mail->to === 'facturacion@andeshorizonte.pe' && str_contains($mail->body, '/admin/suscripcion/pago'));

    consoleDb()->table('platform_invoices')->where('id', $invoice->id)->update(['status' => 'paid']);
    expect($this->postJson("/api/v1/platform/invoices/{$invoice->id}/payment-link"))->toBeApiError(409, 'INVOICE_NOT_COLLECTIBLE');

    $this->postJson("/api/v1/platform/invoices/{$invoice->id}/send")->assertOk()->assertJsonPath('data.sent_to', 'facturacion@andeshorizonte.pe');
    Queue::assertPushed(SendPlainMail::class, fn (SendPlainMail $mail) => str_contains($mail->body, 'Estado: pagada'));

    expect(consoleDb()->table('audit_events')->whereNull('tenant_id')->where('entity', 'Factura plataforma')->whereIn('action', ['enviar_enlace_pago', 'reenviar'])->count())->toBe(2);
    expect($this->postJson('/api/v1/platform/invoices/no-existe/send'))->toBeApiError(404);
});

it('reintenta y resuelve errores de integración de una agencia desde la consola', function () {
    actingAsPlatform();
    $transient = consoleDb()->table('integration_errors')->where('tenant_id', tenantA()->getKey())->where('error_class', 'transitorio')->where('status', '<>', 'resuelto')->first();
    $permanent = consoleDb()->table('integration_errors')->where('tenant_id', tenantA()->getKey())->where('error_class', 'permanente')->where('status', '<>', 'resuelto')->first();

    $this->postJson("/api/v1/platform/integration-errors/{$transient->id}/retry")->assertOk();
    expect(consoleDb()->table('integration_errors')->where('id', $transient->id)->first())->status->toBe('reintentando')->attempt->toBe(0);

    expect($this->postJson("/api/v1/platform/integration-errors/{$permanent->id}/retry"))->toBeApiError(409, 'INT-BR-05');
    expect($this->postJson("/api/v1/platform/integration-errors/{$permanent->id}/resolve", ['resolution' => 'no'])->status())->toBe(422);

    $this->postJson("/api/v1/platform/integration-errors/{$permanent->id}/resolve", ['resolution' => 'La agencia corrigió el RUC del cliente'])->assertOk();
    $resolved = consoleDb()->table('integration_errors')->where('id', $permanent->id)->first();

    expect($resolved->status)->toBe('resuelto')
        ->and($resolved->resolution)->toContain('La agencia corrigió el RUC del cliente')
        ->and(consoleDb()->table('audit_events')->whereNull('tenant_id')->where('entity', 'Integración')->where('entity_id', 'like', '%@TNT-0001')->count())->toBe(2);
    expect($this->postJson("/api/v1/platform/integration-errors/{$permanent->id}/resolve", ['resolution' => 'Otra vez resuelto']))->toBeApiError(422, 'INT-BR-06');

    $events = $this->getJson('/api/v1/platform/audit-events?filter[tenant]=TNT-0001')->assertOk()->json('data');
    $event = collect($events)->firstWhere('action', 'resolver_error');

    expect($event['tenant'])->toBe(['code' => 'TNT-0001', 'name' => tenantA()->commercial_name]);

    $detail = $this->getJson("/api/v1/platform/audit-events/{$event['id']}")->assertOk()->json('data');

    expect($detail['action'])->toBe('resolver_error')
        ->and($detail['tenant']['code'])->toBe('TNT-0001')
        ->and($detail)->toHaveKeys(['diff', 'user_agent', 'correlation_id', 'evidence', 'related']);
    expect($this->getJson('/api/v1/platform/audit-events/no-existe'))->toBeApiError(404);
});

it('el Tenant Admin no usa las acciones nuevas de la consola', function (string $method, string $uri) {
    actingAsSeed('U01');

    expect($this->json($method, $uri, ['plan' => 'enterprise', 'min_plan' => 'starter', 'resolution' => 'Resuelto desde fuera'])->status())->toBeIn([401, 403]);
})->with([
    ['POST', '/api/v1/platform/tenants/TNT-0001/change-plan/preview'],
    ['DELETE', '/api/v1/platform/tenants/TNT-0001/scheduled-change'],
    ['PUT', '/api/v1/platform/plan-rules/R-PAY-LATER'],
    ['POST', '/api/v1/platform/plan-rules/reset-demo'],
    ['GET', '/api/v1/platform/plan-rules'],
    ['POST', '/api/v1/platform/invoices/01a1c96e-98c1-70b4-ab61-0d4b2f5868d6/payment-link'],
    ['POST', '/api/v1/platform/integration-errors/01a1c96e-98c1-70b4-ab61-0d4b2f5868d6/retry'],
    ['GET', '/api/v1/platform/audit-events/01a1c96e-98c1-70b4-ab61-0d4b2f5868d6'],
]);

it('F3-TEN-01: el alta crea la suscripción en prueba o activa con su primera factura', function (string $status) {
    actingAsPlatform();
    $code = $this->postJson('/api/v1/platform/tenants', [
        'commercial_name' => 'Wayra Expediciones',
        'legal_name' => 'Wayra Expediciones S.A.C.',
        'ruc' => '20698765432',
        'fiscal_address' => 'Jr. Lima 120, Arequipa',
        'business_type' => 'Operador turístico',
        'subdomain' => 'wayra-'.$status,
        'plan' => 'professional',
        'status' => $status,
        'sede_name' => 'Arequipa Centro',
        'sede_city' => 'Arequipa',
        'sede_address' => 'Jr. Lima 120',
        'admin_name' => 'Lucía Quispe Mamani',
        'admin_email' => "lucia.{$status}@wayra.pe",
    ], critical())->assertCreated()->json('data.code');
    $tenant = tenantByCode($code);
    $subscription = consoleDb()->table('subscriptions')->where('tenant_id', $tenant->getKey())->first();

    expect($subscription->status)->toBe($status === 'prueba' ? 'trialing' : 'active')
        ->and($subscription->plan_id)->toBe(consolePlanId('professional'))
        ->and($subscription->billing_email)->toBe("lucia.{$status}@wayra.pe")
        ->and(consoleDb()->table('platform_invoices')->where('tenant_id', $tenant->getKey())->count())->toBe($status === 'prueba' ? 0 : 1);

    if ($status === 'prueba') {
        expect(collect($this->getJson('/api/v1/platform/trials')->assertOk()->json('data.items'))->pluck('tenant.code')->all())->toContain($code);
    }
})->with(['prueba', 'activo']);

it('validate-step solo exige los campos del paso aunque el asistente envíe vacíos los demás', function () {
    actingAsPlatform();
    $payload = ['commercial_name' => 'Wayra Expediciones', 'subdomain' => 'wayra-pasos', 'plan' => 'professional', 'status' => 'prueba', 'legal_name' => '', 'ruc' => '', 'fiscal_address' => '', 'sede_name' => '', 'admin_name' => '', 'admin_email' => ''];

    $this->postJson('/api/v1/platform/tenants/validate-step', [...$payload, 'step' => 1])->assertOk()->assertJsonPath('data.valid', true);

    $step2 = $this->postJson('/api/v1/platform/tenants/validate-step', [...$payload, 'step' => 2]);
    expect($step2->status())->toBe(422)
        ->and(json_encode($step2->json(), JSON_UNESCAPED_UNICODE))->toContain('Escribe la razón social.');
});
