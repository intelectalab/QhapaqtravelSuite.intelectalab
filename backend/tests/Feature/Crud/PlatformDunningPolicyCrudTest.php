<?php

use App\Domain\Platform\Actions\CollectInvoice;
use App\Domain\Platform\Support\PlatformSettings;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

beforeEach(fn () => lockPlatformBilling());

function dunDb(): ConnectionInterface
{
    return DB::connection('pgsql_platform');
}

function dunInvoice(array $values): string
{
    $id = (string) dunDb()->table('platform_invoices')->where('tenant_id', tenantA()->getKey())->orderByDesc('number')->value('id');
    dunDb()->table('platform_invoices')->where('id', $id)->update(['paid_at' => null, 'payment_ref' => null, 'dunning_extended_days' => 0, ...$values]);
    dunDb()->table('payment_attempts')->where('invoice_id', $id)->delete();
    dunDb()->table('payment_methods')->where('tenant_id', tenantA()->getKey())->update(['status' => 'expired']);

    return $id;
}

it('guarda la política de cobranza ordenada, la devuelve y la audita', function () {
    actingAsPlatform();

    $this->patchJson('/api/v1/platform/dunning-policy', ['retry_days' => [9, 2, 5], 'suspend_after_last' => false])
        ->assertOk()->assertJsonPath('data.retry_days', [2, 5, 9])->assertJsonPath('data.suspend_after_last', false);

    expect(app(PlatformSettings::class)->dunning())->toMatchArray(['retry_days' => [2, 5, 9], 'suspend_after_last' => false])
        ->and($this->getJson('/api/v1/platform/dunning')->assertOk()->json('data.policy.retry_days'))->toBe([2, 5, 9])
        ->and(dunDb()->table('audit_events')->whereNull('tenant_id')->where(['entity' => 'Política de cobranza', 'action' => 'editar_politica'])->value('after_value'))->toBe('D+2, D+5, D+9 · sin suspensión');
});

it('valida la política de cobranza', function (array $body, ?string $field, ?string $code) {
    actingAsPlatform();
    $response = $this->patchJson('/api/v1/platform/dunning-policy', ['retry_days' => [1, 3, 7], 'suspend_after_last' => true, ...$body]);

    $code ? expect($response)->toBeApiError(422, $code) : $response->assertStatus(422)->assertJsonValidationErrors($field);
    expect(app(PlatformSettings::class)->dunning()['retry_days'])->toBe([1, 3, 7]);
})->with([
    'días repetidos' => [['retry_days' => [3, 3]], null, 'DUNNING_DAYS'],
    'más de cinco reintentos' => [['retry_days' => [1, 2, 3, 4, 5, 6]], 'retry_days', null],
    'sin reintentos' => [['retry_days' => []], 'retry_days', null],
    'día 31' => [['retry_days' => [1, 31]], 'retry_days.1', null],
    'día cero' => [['retry_days' => [0, 3]], 'retry_days.0', null],
    'sin indicar la suspensión' => [['suspend_after_last' => null], 'suspend_after_last', null],
]);

it('el primer día de la política define cuándo se reintenta una factura que entra en cobranza', function () {
    actingAsPlatform();
    $this->patchJson('/api/v1/platform/dunning-policy', ['retry_days' => [2, 5], 'suspend_after_last' => true])->assertOk();
    $id = dunInvoice(['status' => 'open', 'dunning_next_retry_at' => null]);

    $this->postJson("/api/v1/platform/invoices/{$id}/retry", [], critical())->assertOk()->assertJsonPath('data.result', 'declined');
    $invoice = dunDb()->table('platform_invoices')->where('id', $id)->first();

    expect($invoice->status)->toBe('failed')
        ->and($invoice->dunning_failed_at)->toBe('2026-09-29')
        ->and(Carbon::parse($invoice->dunning_next_retry_at)->timezone('America/Lima')->format('Y-m-d H:i'))->toBe('2026-10-01 10:00');
});

it('al agotar los reintentos la agencia se suspende solo si la política lo indica', function (bool $suspend, string $status) {
    actingAsPlatform();
    $this->patchJson('/api/v1/platform/dunning-policy', ['retry_days' => [1, 3], 'suspend_after_last' => $suspend])->assertOk();
    $id = dunInvoice(['status' => 'failed', 'dunning_failed_at' => '2026-09-26', 'dunning_retries_done' => 1, 'dunning_next_retry_at' => '2026-09-29 14:00:00+00']);

    $summary = DB::connection('pgsql_platform')->transaction(fn () => app(CollectInvoice::class)->runDunning());

    expect($summary['declined'])->toBe(1)
        ->and(dunDb()->table('platform_invoices')->where('id', $id)->value('status'))->toBe('uncollectible')
        ->and(dunDb()->table('tenants')->where('id', tenantA()->getKey())->value('status'))->toBe($status);
})->with([
    'con suspensión' => [true, 'suspendido'],
    'sin suspensión' => [false, 'activo'],
]);

it('el Tenant Admin no cambia la política de cobranza', function () {
    actingAsSeed('U01');

    expect($this->patchJson('/api/v1/platform/dunning-policy', ['retry_days' => [2], 'suspend_after_last' => false])->status())->toBeIn([401, 403]);
    expect(app(PlatformSettings::class)->dunning()['retry_days'])->toBe([1, 3, 7]);
});
