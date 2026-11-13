<?php

use Illuminate\Support\Facades\DB;

function crecAMappings(string $target = 'contasis', array $skip = []): array
{
    $accounts = ['venta_gravada' => '70111', 'venta_exonerada' => '70112', 'igv' => '40111', 'cxc' => '12121', 'caja' => '10101', 'banco' => '10411', 'cxp' => '42121', 'costo_servicio' => '63111', 'vale_regalo' => '12211'];

    return ['target' => $target, 'mappings' => collect($accounts)->except($skip)->map(fn (string $code, string $concept) => ['concept' => $concept, 'account_code' => $code, 'cost_center' => 'CC-01'])->values()->all()];
}

it('GET y PUT /finance/account-mappings guardan el plan de cuentas por destino y lo auditan', function () {
    actingAsSeed('U08');

    $empty = $this->getJson('/api/v1/finance/account-mappings')->assertOk()->json('data');
    expect(collect($empty['targets'])->pluck('target')->all())->toBe(['contasis', 'concar', 'siigo', 'quickbooks', 'xero', 'csv']);

    $saved = $this->putJson('/api/v1/finance/account-mappings', crecAMappings('siigo'))->assertOk()->json('data');
    $contasis = collect($saved['targets'])->firstWhere('target', 'siigo');

    expect($contasis['mapped'])->toBe(9)
        ->and($contasis['ready'])->toBe(['ventas' => true, 'cobros' => true, 'compras' => true])
        ->and(collect($contasis['concepts'])->firstWhere('concept', 'igv')['account_code'])->toBe('40111')
        ->and(withinTenant(tenantA(), fn () => DB::table('audit_events')->where(['entity' => 'Plan de cuentas', 'entity_id' => 'siigo'])->exists()))->toBeTrue();

    $this->putJson('/api/v1/finance/account-mappings', ['target' => 'siigo', 'mappings' => [['concept' => 'igv', 'account_code' => '']]])->assertOk();
    expect(withinTenant(tenantA(), fn () => DB::table('fin_account_mappings')->where('target', 'siigo')->where('concept', 'igv')->exists()))->toBeFalse();
    expect($this->putJson('/api/v1/finance/account-mappings', ['target' => 'sap', 'mappings' => [['concept' => 'igv', 'account_code' => '40111']]]))->toBeApiError(422);
});

it('SC-15: falta una cuenta del alcance → 422 ACCOUNT_MAPPING_MISSING', function () {
    actingAsSeed('U08');
    $this->putJson('/api/v1/finance/account-mappings', crecAMappings('concar', ['igv']))->assertOk();

    expect($this->postJson('/api/v1/finance/accounting-exports', ['target' => 'concar', 'period_from' => '2026-10-01', 'period_to' => '2026-10-31', 'scope' => ['ventas']], critical()))->toBeApiError(422, 'ACCOUNT_MAPPING_MISSING');
});

it('SC-15: un periodo sin comprobantes aceptados u observados no se exporta', function () {
    actingAsSeed('U08');
    $this->putJson('/api/v1/finance/account-mappings', crecAMappings())->assertOk();

    expect($this->postJson('/api/v1/finance/accounting-exports', ['target' => 'contasis', 'period_from' => '2025-01-01', 'period_to' => '2025-01-31', 'scope' => ['ventas']], critical()))->toBeApiError(422, 'ACCOUNTING_PERIOD_EMPTY');
});

it('POST /finance/accounting-exports genera el archivo con asientos cuadrados y GET lo lista con su descarga', function () {
    actingAsSeed('U08');
    $this->putJson('/api/v1/finance/account-mappings', crecAMappings())->assertOk();
    $period = withinTenant(tenantA(), fn () => DB::table('fin_invoices')->whereIn('status', ['aceptado', 'observado'])->selectRaw('min(issue_date) as f, max(issue_date) as t')->first());

    $export = $this->postJson('/api/v1/finance/accounting-exports', ['target' => 'contasis', 'period_from' => $period->f, 'period_to' => $period->t, 'scope' => ['ventas', 'cobros']], critical())->assertOk()->json('data');

    expect($export['code'])->toStartWith('EXC-')
        ->and($export['status'])->toBe('generado')
        ->and($export['rows_count'])->toBeGreaterThan(0)
        ->and($export['sha256'])->toHaveLength(64)
        ->and(withinTenant(tenantA(), fn () => DB::table('audit_events')->where(['entity' => 'Exportación contable', 'entity_id' => $export['code'], 'action' => 'exportar'])->exists()))->toBeTrue();

    $listed = $this->getJson('/api/v1/finance/accounting-exports?filter[code]='.$export['code'].'&include=file')->assertOk()->json();
    $file = base64_decode($listed['data'][0]['file']['content_base64']);
    $lines = array_slice(array_filter(explode("\r\n", $file)), 1);
    $debit = array_sum(array_map(fn (string $line) => (float) explode(';', $line)[3], $lines));
    $credit = array_sum(array_map(fn (string $line) => (float) explode(';', $line)[4], $lines));

    expect(str_starts_with($file, 'Fecha;Comprobante;Cuenta;Debe;Haber'))->toBeTrue()
        ->and(count($lines))->toBe($export['rows_count'])
        ->and(round($debit, 2))->toBe(round($credit, 2))
        ->and(hash('sha256', $file))->toBe($export['sha256'])
        ->and($listed['meta']['kpis']['generated'])->toBeGreaterThanOrEqual(1);
});

it('Contabilidad exporta pero Ventas y Manager no tienen el permiso', function () {
    actingAsSeed('U04');
    expect($this->getJson('/api/v1/finance/accounting-exports'))->toBeApiError(403);

    actingAsSeed('U02');
    expect($this->getJson('/api/v1/finance/account-mappings'))->toBeApiError(403);
});
