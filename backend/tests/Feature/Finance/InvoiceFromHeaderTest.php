<?php

use Illuminate\Support\Facades\DB;

it('el resumen de facturación lista toda cuenta por cobrar con importe por facturar, también sin cobrar', function () {
    actingAsSeed('U07');

    $data = $this->getJson('/api/v1/finance/invoices/summary')->assertOk()->json('data');
    $codes = collect($data['invoiceable'])->pluck('value');
    $unpaid = withinTenant(tenantA(), fn () => DB::table('fin_receivables')->whereNull('deleted_at')->where('status', '<>', 'cancelada')->where('paid_amount', 0)
        ->whereNotExists(fn ($query) => $query->from('fin_invoices as i')->whereColumn('i.receivable_id', 'fin_receivables.id')->where('i.status', '<>', 'anulado'))->value('code'));

    expect($data['invoiceable'])->not->toBeEmpty()
        ->and($data['invoiceable'][0])->toHaveKeys(['value', 'label', 'hint', 'kind', 'paid']);

    if ($unpaid !== null) {
        expect($codes)->toContain($unpaid)
            ->and(collect($data['invoiceable'])->firstWhere('value', $unpaid)['paid'])->toBeFalse();
    }

    $cancelled = withinTenant(tenantA(), fn () => DB::table('fin_receivables')->where('status', 'cancelada')->value('code'));
    if ($cancelled !== null) {
        expect($codes)->not->toContain($cancelled);
    }
});

it('emite un comprobante desde una cuenta por cobrar elegida libremente con la dirección editada', function () {
    actingAsSeed('U07');
    $code = collect($this->getJson('/api/v1/finance/invoices/summary')->json('data.invoiceable'))->pluck('value')->first();
    $draft = $this->getJson("/api/v1/finance/receivables/{$code}/invoice-draft")->assertOk()->json('data');

    $payload = [
        'receivable_id' => $code,
        'doc_type' => $draft['doc_type'],
        'customer_doc_type' => $draft['customer_doc_type'],
        'customer_doc_number' => $draft['customer_doc_number'],
        'customer_name' => $draft['customer_name'],
        'customer_address' => 'Av. El Sol 123, Cusco',
        'domiciled' => $draft['domiciled'],
        'amount' => $draft['amount'],
        'fx_rate' => $draft['fx_rate'],
        'description' => $draft['description'],
    ];
    $check = $this->postJson('/api/v1/finance/invoices/validate', $payload)->assertOk()->json('data');

    if (! $check['ok']) {
        expect($check['checks'])->not->toBeEmpty();

        return;
    }

    $number = $this->postJson('/api/v1/finance/invoices', $payload, critical())->assertSuccessful()->json('data.number');
    expect(withinTenant(tenantA(), fn () => DB::table('fin_invoices')->where('number', $number)->value('customer_address')))->toBe('Av. El Sol 123, Cusco');
});

it('un comprobante rechazado por el OSE no consume el importe facturable de la cuota', function () {
    actingAsSeed('U07');
    $code = collect($this->getJson('/api/v1/finance/invoices/summary')->json('data.invoiceable'))->pluck('value')->first();
    $draft = $this->getJson("/api/v1/finance/receivables/{$code}/invoice-draft")->assertOk()->json('data');
    $payload = collect($draft)->only(['doc_type', 'customer_doc_type', 'customer_doc_number', 'customer_name', 'domiciled', 'amount', 'fx_rate', 'description'])->all() + ['receivable_id' => $code, 'customer_address' => 'Av. El Sol 123, Cusco'];
    expect($this->postJson('/api/v1/finance/invoices/validate', $payload)->json('data.ok'))->toBeTrue();

    $number = $this->postJson('/api/v1/finance/invoices', $payload, critical())->assertSuccessful()->json('data.number');
    withinTenant(tenantA(), fn () => DB::table('fin_invoices')->where('number', $number)->update(['status' => 'rechazado']));

    expect($this->getJson("/api/v1/finance/receivables/{$code}/invoice-draft")->assertOk()->json('data.amount'))->toEqual($draft['amount'])
        ->and(collect($this->getJson('/api/v1/finance/invoices/summary')->json('data.invoiceable'))->pluck('value'))->toContain($code);
});
