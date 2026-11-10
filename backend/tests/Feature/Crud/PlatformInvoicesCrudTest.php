<?php

use Illuminate\Database\ConnectionInterface;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

beforeEach(function () {
    lockPlatformBilling();
    $this->withoutMiddleware(ThrottleRequests::class);
});

function invDb(): ConnectionInterface
{
    return DB::connection('pgsql_platform');
}

function invLatestId(): string
{
    return (string) invDb()->table('platform_invoices')->where('tenant_id', tenantA()->getKey())->orderByDesc('number')->value('id');
}

function invRow(string $id): object
{
    return invDb()->table('platform_invoices')->where('id', $id)->first();
}

function invInDunning(array $extra = []): string
{
    $id = invLatestId();
    invDb()->table('platform_invoices')->where('id', $id)->update(['status' => 'failed', 'paid_at' => null, 'payment_ref' => null, 'dunning_failed_at' => '2026-09-28', 'dunning_retries_done' => 0, 'dunning_extended_days' => 0, 'dunning_next_retry_at' => '2026-09-30 15:00:00+00', ...$extra]);
    invDb()->table('payment_attempts')->where('invoice_id', $id)->delete();
    invDb()->table('subscriptions')->where('tenant_id', tenantA()->getKey())->update(['status' => 'past_due']);

    return $id;
}

function invTenantStatus(): string
{
    return (string) invDb()->table('tenants')->where('id', tenantA()->getKey())->value('status');
}

function invSubscriptionStatus(): string
{
    return (string) invDb()->table('subscriptions')->where('tenant_id', tenantA()->getKey())->value('status');
}

function invAudit(string $action): ?string
{
    $invoice = invRow(invLatestId());

    return invDb()->table('audit_events')->whereNull('tenant_id')->where(['entity' => 'Factura plataforma', 'entity_id' => trim($invoice->series).'-'.str_pad((string) $invoice->number, 8, '0', STR_PAD_LEFT), 'action' => $action])->orderByDesc('occurred_at')->value('after_value')
        ?? invDb()->table('audit_events')->whereNull('tenant_id')->where(['entity' => 'Factura plataforma', 'action' => $action])->orderByDesc('occurred_at')->value('after_value');
}

function invExpireCard(): void
{
    invDb()->table('payment_methods')->where('tenant_id', tenantA()->getKey())->update(['status' => 'expired']);
}

function invManualBody(array $overrides = []): array
{
    return ['method' => 'Transferencia bancaria', 'reference' => 'OP-778899', 'paid_on' => '2026-09-28', ...$overrides];
}

it('reintentar el cobro de una factura en cobranza con tarjeta vigente la deja pagada y la suscripción al día', function () {
    $id = invInDunning();
    actingAsPlatform();

    $response = $this->postJson("/api/v1/platform/invoices/{$id}/retry", [], critical())->assertOk();
    $invoice = invRow($id);

    expect($response->json('data.result'))->toBe('succeeded')
        ->and($invoice->status)->toBe('paid')
        ->and($invoice->paid_at)->not->toBeNull()
        ->and($invoice->dunning_next_retry_at)->toBeNull()
        ->and(invSubscriptionStatus())->toBe('active')
        ->and(invDb()->table('payment_attempts')->where('invoice_id', $id)->where('source', 'manual_retry')->value('result'))->toBe('succeeded')
        ->and(invAudit('cobro_exitoso'))->toBe('paid · reintento manual');
});

it('un reintento rechazado deja la factura en cobranza sin mover su calendario', function () {
    $id = invInDunning();
    invExpireCard();
    actingAsPlatform();

    $response = $this->postJson("/api/v1/platform/invoices/{$id}/retry", [], critical())->assertOk();
    $invoice = invRow($id);

    expect($response->json('data.result'))->toBe('declined')
        ->and($response->json('data.message'))->toBe('Tarjeta vencida (54)')
        ->and($invoice->status)->toBe('failed')
        ->and(Carbon::parse($invoice->dunning_next_retry_at)->utc()->format('Y-m-d H:i'))->toBe('2026-09-30 15:00')
        ->and(invSubscriptionStatus())->toBe('past_due')
        ->and(invAudit('cobro_rechazado'))->toContain('reintento manual');
});

it('el cobro, el pago manual y la anulación exigen Idempotency-Key', function (string $path, array $body) {
    $id = invInDunning();
    actingAsPlatform();

    expect($this->postJson("/api/v1/platform/invoices/{$id}/{$path}", $body))->toBeApiError(422, 'IDEMPOTENCY_KEY_REQUIRED');
    expect(invRow($id)->status)->toBe('failed');
})->with([
    ['retry', []],
    ['manual-payment', ['method' => 'Transferencia bancaria', 'reference' => 'OP-778899', 'paid_on' => '2026-09-28']],
    ['void', ['reason' => 'Factura emitida por error']],
]);

it('no se cobra ni se registra pago de una factura ya pagada', function () {
    $id = invLatestId();
    actingAsPlatform();

    expect($this->postJson("/api/v1/platform/invoices/{$id}/retry", [], critical()))->toBeApiError(409, 'INVOICE_NOT_COLLECTIBLE')
        ->and($this->postJson("/api/v1/platform/invoices/{$id}/manual-payment", invManualBody(), critical()))->toBeApiError(409, 'INVOICE_NOT_COLLECTIBLE')
        ->and($this->postJson('/api/v1/platform/invoices/no-es-uuid/retry', [], critical()))->toBeApiError(404);
});

it('suspender por cobranza deja la agencia y su suscripción suspendidas y bloquea el ingreso de su equipo', function () {
    $id = invInDunning();
    expect(loginAs('lparedes@andeshorizonte.pe')->status())->toBe(200);
    actingAsPlatform();

    $this->postJson("/api/v1/platform/invoices/{$id}/dunning/suspend", ['reason' => 'Falta de pago tras tres reintentos'])->assertOk()->assertJsonPath('data.suspended', true);
    $tenant = invDb()->table('tenants')->where('id', tenantA()->getKey())->first();

    expect($tenant->status)->toBe('suspendido')
        ->and($tenant->suspend_reason)->toBe('Falta de pago tras tres reintentos')
        ->and(invSubscriptionStatus())->toBe('suspended')
        ->and(invDb()->table('audit_events')->where(['entity' => 'Tenant', 'entity_id' => 'TNT-0001', 'action' => 'suspender'])->exists())->toBeTrue();
    expect(loginAs('lparedes@andeshorizonte.pe'))->toBeApiError(403, 'TENANT_SUSPENDED');
    expect($this->postJson("/api/v1/platform/invoices/{$id}/dunning/suspend", ['reason' => 'Otra vez por falta de pago']))->toBeApiError(409, 'TEN-BR-08');
});

it('solo se suspende por cobranza con una factura en cobranza y con motivo', function () {
    actingAsPlatform();
    $paid = invLatestId();

    expect($this->postJson("/api/v1/platform/invoices/{$paid}/dunning/suspend", ['reason' => 'Falta de pago']))->toBeApiError(409, 'DUNNING_INACTIVE');
    expect(invTenantStatus())->toBe('activo');

    $id = invInDunning();
    $this->postJson("/api/v1/platform/invoices/{$id}/dunning/suspend", ['reason' => 'x'])->assertStatus(422)->assertJsonValidationErrors('reason');
    expect($this->postJson('/api/v1/platform/invoices/no-es-uuid/dunning/suspend', ['reason' => 'Falta de pago']))->toBeApiError(404);
    expect(invTenantStatus())->toBe('activo');
});

it('el pago manual deja la factura pagada y a la agencia suspendida al día y con acceso', function () {
    $id = invInDunning();
    actingAsPlatform();
    $this->postJson("/api/v1/platform/invoices/{$id}/dunning/suspend", ['reason' => 'Falta de pago tras tres reintentos'])->assertOk();

    $this->postJson("/api/v1/platform/invoices/{$id}/manual-payment", invManualBody(), critical())->assertOk();
    $invoice = invRow($id);
    $attempt = invDb()->table('payment_attempts')->where('invoice_id', $id)->where('source', 'manual_payment')->first();

    expect($invoice->status)->toBe('paid')
        ->and($invoice->payment_ref)->toBe('Transferencia bancaria · OP-778899')
        ->and(Carbon::parse($invoice->paid_at)->timezone('America/Lima')->toDateString())->toBe('2026-09-28')
        ->and($attempt->result)->toBe('succeeded')
        ->and($attempt->idempotency_key)->toBe("inv:{$id}:manual:op-778899")
        ->and(invSubscriptionStatus())->toBe('active')
        ->and(invTenantStatus())->toBe('activo')
        ->and(invAudit('pago_manual'))->toBe('paid · Transferencia bancaria OP-778899');
    expect(loginAs('lparedes@andeshorizonte.pe')->status())->toBe(200);
});

it('el pago manual no reactiva a la agencia si le queda otra factura en cobranza', function () {
    $id = invInDunning();
    $other = (string) invDb()->table('platform_invoices')->where('tenant_id', tenantA()->getKey())->orderBy('number')->value('id');
    invDb()->table('platform_invoices')->where('id', $other)->update(['status' => 'failed']);
    actingAsPlatform();
    $this->postJson("/api/v1/platform/invoices/{$id}/dunning/suspend", ['reason' => 'Falta de pago tras tres reintentos'])->assertOk();

    $this->postJson("/api/v1/platform/invoices/{$id}/manual-payment", invManualBody(), critical())->assertOk();

    expect(invRow($id)->status)->toBe('paid')
        ->and(invTenantStatus())->toBe('suspendido')
        ->and(invSubscriptionStatus())->toBe('suspended');
});

it('el pago manual valida el medio, la operación y que la fecha no sea futura', function (array $body, string $field) {
    $id = invInDunning();
    actingAsPlatform();

    $this->postJson("/api/v1/platform/invoices/{$id}/manual-payment", invManualBody($body), critical())->assertStatus(422)->assertJsonValidationErrors($field);
    expect(invRow($id)->status)->toBe('failed');
})->with([
    'medio fuera de la lista' => [['method' => 'Efectivo'], 'method'],
    'operación corta' => [['reference' => 'OP'], 'reference'],
    'fecha futura' => [['paid_on' => '2026-09-30'], 'paid_on'],
]);

it('anular una factura pagada emite la nota de crédito con reembolso y lo audita', function () {
    $id = invLatestId();
    $total = (string) invRow($id)->total;
    actingAsPlatform();

    $note = $this->postJson("/api/v1/platform/invoices/{$id}/void", ['reason' => 'Se facturó el plan equivocado'], critical())->assertOk()->json('data.credit_note');
    $credit = invDb()->table('platform_credit_notes')->where('invoice_id', $id)->first();

    expect($note)->toStartWith('NQ01-')
        ->and(invRow($id)->status)->toBe('void')
        ->and(invRow($id)->void_reason)->toBe('Se facturó el plan equivocado')
        ->and((string) $credit->amount)->toBe($total)
        ->and($credit->refund_ref)->toBe('Reembolso solicitado a la pasarela')
        ->and(invAudit('anular'))->toContain($note);
    expect($this->postJson("/api/v1/platform/invoices/{$id}/void", ['reason' => 'Se facturó el plan equivocado'], critical()))->toBeApiError(409, 'INVOICE_VOID');
});

it('anular la única factura en cobranza de una agencia suspendida la reactiva sin reembolso', function () {
    $id = invInDunning();
    actingAsPlatform();
    $this->postJson("/api/v1/platform/invoices/{$id}/dunning/suspend", ['reason' => 'Falta de pago tras tres reintentos'])->assertOk();

    $this->postJson("/api/v1/platform/invoices/{$id}/void", ['reason' => 'Cobro duplicado por error del sistema'], critical())->assertOk();

    expect(invDb()->table('platform_credit_notes')->where('invoice_id', $id)->value('refund_ref'))->toBeNull()
        ->and(invRow($id)->dunning_next_retry_at)->toBeNull()
        ->and(invTenantStatus())->toBe('activo')
        ->and(invSubscriptionStatus())->toBe('active');
});

it('la anulación exige un motivo detallado', function () {
    $id = invLatestId();
    actingAsPlatform();

    $this->postJson("/api/v1/platform/invoices/{$id}/void", ['reason' => 'Error'], critical())->assertStatus(422)->assertJsonValidationErrors('reason');
    expect(invRow($id)->status)->toBe('paid');
});

it('la prórroga de cobranza mueve 7 días el próximo reintento una sola vez', function () {
    $id = invInDunning();
    actingAsPlatform();

    $this->postJson("/api/v1/platform/invoices/{$id}/dunning/extend")->assertOk()->assertJsonPath('data.extended', true);
    $invoice = invRow($id);

    expect((int) $invoice->dunning_extended_days)->toBe(7)
        ->and(Carbon::parse($invoice->dunning_next_retry_at)->utc()->format('Y-m-d H:i'))->toBe('2026-10-07 15:00')
        ->and(invAudit('prorroga_dunning'))->toBe('Próximo reintento 07/10/2026 10:00');
    expect($this->postJson("/api/v1/platform/invoices/{$id}/dunning/extend"))->toBeApiError(409, 'DUNNING_EXTENDED')
        ->and($this->postJson('/api/v1/platform/invoices/'.invDb()->table('platform_invoices')->where('tenant_id', tenantA()->getKey())->where('status', 'paid')->value('id').'/dunning/extend'))->toBeApiError(409, 'DUNNING_INACTIVE');
});

it('el Tenant Admin no opera la facturación de la plataforma', function (string $path, array $body) {
    $id = invInDunning();
    actingAsSeed('U01');

    expect($this->postJson("/api/v1/platform/invoices/{$id}/{$path}", $body, critical())->status())->toBeIn([401, 403]);
    expect(invRow($id)->status)->toBe('failed');
})->with([
    ['retry', []],
    ['manual-payment', ['method' => 'Transferencia bancaria', 'reference' => 'OP-778899', 'paid_on' => '2026-09-28']],
    ['void', ['reason' => 'Factura emitida por error']],
    ['dunning/extend', []],
    ['dunning/suspend', ['reason' => 'Falta de pago']],
]);
