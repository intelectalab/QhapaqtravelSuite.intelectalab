<?php

use Brick\Math\BigDecimal;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;

if (! function_exists('vitrinaTenantAudit')) {
    function vitrinaTenantAudit(array $where): bool
    {
        return withinTenant(tenantA(), fn () => DB::table('audit_events')->where($where)->exists());
    }
}

function vitrinaGateway(string $provider): object
{
    return withinTenant(tenantA(), fn () => DB::table('fin_gateway_accounts')->where('provider', $provider)->first());
}

it('lista las pasarelas sin exponer credenciales', function () {
    actingAsSeed('U07');
    $data = $this->getJson('/api/v1/finance/gateways')->assertOk()->json('data');
    $json = json_encode($data);

    expect(collect($data['items'])->pluck('provider'))->toContain('paypal')
        ->and($json)->not->toContain('credentials_ref')
        ->and($json)->not->toContain('vault://');
});

it('VT-10: conectar en producción exige credenciales, las guarda en el vault y nunca las devuelve', function () {
    actingAsSeed('U01');
    $payload = ['provider' => 'otro', 'account_ref' => 'Comercio Niubiz 778899', 'currency' => 'PEN', 'fee_pct' => 3.5, 'tax_on_fee' => true, 'status' => 'activa', 'mode' => 'produccion'];

    expect($this->postJson('/api/v1/finance/gateways', $payload, critical()))->toBeApiError(422, 'VT-10');

    $id = $this->postJson('/api/v1/finance/gateways', [...$payload, 'credentials' => ['client_id' => 'cli-123', 'secret' => 'super-secreto']], critical())->assertOk()->json('data.id');
    $row = withinTenant(tenantA(), fn () => DB::table('fin_gateway_accounts')->where('id', $id)->first());
    $listed = collect($this->getJson('/api/v1/finance/gateways')->json('data.items'))->firstWhere('id', $id);

    expect($row->credentials_ref)->toStartWith('vault://gateways/')
        ->and($listed['has_credentials'])->toBeTrue()
        ->and($listed['credentials_in_vault'])->toBeTrue()
        ->and(json_encode($listed))->not->toContain('super-secreto')
        ->and(vitrinaTenantAudit(['entity' => 'Pasarela', 'entity_id' => $id, 'action' => 'conectar']))->toBeTrue();
    expect($this->postJson('/api/v1/finance/gateways', [...$payload, 'credentials' => ['secret' => 'x']], critical()))->toBeApiError(409, 'VT-GATEWAY');
});

it('editar la comisión y el traslado al cliente queda auditado', function () {
    actingAsSeed('U07');
    $paypal = vitrinaGateway('paypal');

    $this->patchJson("/api/v1/finance/gateways/{$paypal->id}", ['fee_pct' => 4.9, 'pass_fee_to_customer' => true])->assertOk();
    $row = vitrinaGateway('paypal');

    expect((string) $row->fee_pct)->toBe('4.90')->and($row->pass_fee_to_customer)->toBeTrue()
        ->and(vitrinaTenantAudit(['entity' => 'Pasarela', 'entity_id' => $paypal->id, 'action' => 'configurar']))->toBeTrue();
    expect($this->patchJson("/api/v1/finance/gateways/{$paypal->id}", ['fee_pct' => 20]))->toBeApiError(422);
});

it('VT-08: cada cobro guarda bruto, comisión, IGV y neto, y el neto cumple la fórmula', function () {
    actingAsSeed('U07');
    $fees = $this->getJson('/api/v1/finance/gateway-fees')->assertOk()->json('data');

    expect($fees['items'])->not->toBeEmpty();

    foreach ($fees['items'] as $fee) {
        expect((string) BigDecimal::of($fee['gross'])->minus($fee['fee'])->minus($fee['fee_tax'])->minus($fee['fx_spread']))->toBe($fee['net']);
    }

    $broken = fn () => withinTenant(tenantA(), fn () => DB::table('fin_payment_fees')->limit(1)->update(['net' => DB::raw('net + 1')]));
    expect($broken)->toThrow(QueryException::class);
});

it('importar la liquidación reemplaza la comisión estimada por la real y ajusta las ya liquidadas', function () {
    actingAsSeed('U07');
    $local = vitrinaGateway('pasarela_local');
    $payment = withinTenant(tenantA(), fn () => DB::table('fin_payments')->whereNotIn('id', DB::table('fin_payment_fees')->select('payment_id'))->where('amount', '>', 100)->first(['code', 'amount']));

    $summary = $this->postJson('/api/v1/finance/gateway-fees/import', ['gateway' => $local->id, 'lines' => [['payment' => $payment->code, 'fee' => '4.00', 'fee_tax' => '0.72', 'settled_on' => '2026-09-28', 'external_ref' => 'TXN-TEST-1']]], critical())->assertOk()->json('data');
    expect($summary['created'])->toBe(1);

    $again = $this->postJson('/api/v1/finance/gateway-fees/import', ['gateway' => $local->id, 'lines' => [['payment' => $payment->code, 'fee' => '4.50', 'fee_tax' => '0.81']]], critical())->assertOk()->json('data');
    $row = withinTenant(tenantA(), fn () => DB::table('fin_payment_fees')->join('fin_payments', 'fin_payments.id', '=', 'fin_payment_fees.payment_id')->where('fin_payments.code', $payment->code)->first(['fin_payment_fees.*']));

    expect($again['adjusted'])->toBe(1)->and($row->status)->toBe('ajustado')->and((string) $row->fee)->toBe('4.50');

    withinTenant(tenantA(), fn () => DB::table('fin_payment_fees')->where('id', $row->id)->update(['status' => 'estimado', 'settled_on' => null]));
    $auto = $this->postJson('/api/v1/finance/gateway-fees/import', ['gateway' => $local->id], critical())->assertOk()->json('data');
    expect($auto['settled'])->toBeGreaterThanOrEqual(1)
        ->and(withinTenant(tenantA(), fn () => DB::table('fin_payment_fees')->where('id', $row->id)->value('status')))->toBe('liquidado');
});

it('ventas no administra pasarelas; rentabilidad sí puede leer las comisiones', function () {
    actingAsSeed('U03');
    expect($this->getJson('/api/v1/finance/gateways'))->toBeApiError(403)
        ->and($this->getJson('/api/v1/finance/gateways')->json('required_permissions'))->toContain('finance.gateways.manage');

    actingAsSeed('U02');
    $this->getJson('/api/v1/finance/gateway-fees')->assertOk();
    expect($this->getJson('/api/v1/finance/gateways'))->toBeApiError(403);
});
