<?php

use App\Jobs\SendInvoiceToFiscalProvider;
use Illuminate\Bus\UniqueLock;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;

function invoiceRow(string $number): object
{
    return rowOf('fin_invoices', $number, column: 'number');
}

function runFiscalJob(string $number): void
{
    $id = (string) invoiceRow($number)->id;
    withinTenant(tenantA(), fn () => app()->call([new SendInvoiceToFiscalProvider($id), 'handle']));
}

function boletaBody(array $overrides = []): array
{
    return [
        'receivable_id' => 'CXC-00715',
        'doc_type' => '03',
        'customer_doc_type' => 'DNI',
        'customer_doc_number' => '41220988',
        'customer_name' => 'Familia Castañeda Ugarte',
        'domiciled' => true,
        'amount' => '1896.66',
        'description' => 'Servicios turísticos: viaje familiar a Cusco',
        ...$overrides,
    ];
}

beforeEach(function () {
    Queue::fake();
    freezeBusinessToday();
});

it('getFinanceReceivablesInvoiceDraft propone boleta, importe y domicilio según el cliente', function () {
    actingAsSeed('U07');

    $draft = $this->getJson('/api/v1/finance/receivables/CXC-00715/invoice-draft')->assertOk()->json('data');

    expect($draft['doc_type'])->toBe('03')
        ->and($draft['customer_doc_type'])->toBe('DNI')
        ->and($draft['amount'])->toBe('1896.66')
        ->and($draft['maximum'])->toBe('1896.66')
        ->and($draft['domiciled'])->toBeTrue();
    expect($this->getJson('/api/v1/finance/receivables/CXC-00713/invoice-draft')->json('data.amount'))->toBe('400.00');
});

it('financeInvoicesValidate revisa RUC, documento de boleta e importe máximo', function () {
    actingAsSeed('U07');

    $factura = $this->postJson('/api/v1/finance/invoices/validate', boletaBody(['doc_type' => '01']))->assertOk()->json('data');
    $over = $this->postJson('/api/v1/finance/invoices/validate', boletaBody(['amount' => '5000']))->assertOk()->json('data');
    $ok = $this->postJson('/api/v1/finance/invoices/validate', boletaBody())->assertOk()->json('data');

    expect($factura['ok'])->toBeFalse()
        ->and(collect($factura['checks'])->firstWhere('rule', 'FIN-BR-39')['ok'])->toBeFalse()
        ->and(collect($over['checks'])->firstWhere('rule', 'FIN-BR-43')['ok'])->toBeFalse()
        ->and($ok['ok'])->toBeTrue()
        ->and($ok['taxable_amount'])->toBe('1607.34')
        ->and($ok['igv_amount'])->toBe('289.32');
});

it('createFinanceInvoices numera la boleta, queda pendiente de envío y el OSE la acepta', function () {
    actingAsSeed('U07');

    $data = $this->postJson('/api/v1/finance/invoices', boletaBody(), critical())->assertStatus(202)->json('data');

    expect($data['number'])->toBe('B001-00008813')
        ->and($data['status'])->toBe('pendiente_envio');
    Queue::assertPushed(SendInvoiceToFiscalProvider::class);

    runFiscalJob('B001-00008813');
    $events = withinTenant(tenantA(), fn () => DB::table('fin_fiscal_events')->where('invoice_id', invoiceRow('B001-00008813')->id)->pluck('status')->all());

    expect(invoiceRow('B001-00008813')->status)->toBe('aceptado')
        ->and($events)->toBe(['ok']);
    expect($this->postJson('/api/v1/finance/invoices', boletaBody(), critical()))->toBeApiError(422, 'FIN-BR-43');
    expect($this->postJson('/api/v1/finance/invoices', boletaBody(), ['Accept' => 'application/json']))->toBeApiError(422);
});

it('una caída del OSE deja el comprobante pendiente y registra el error temporal para reintentar', function () {
    actingAsSeed('U07');
    $this->postJson('/api/v1/finance/invoices', boletaBody(['customer_doc_type' => 'SIN_DOC', 'customer_doc_number' => 'TIMEOUT']), critical())->assertStatus(202);

    $id = (string) invoiceRow('B001-00008813')->id;
    $error = withinTenant(tenantA(), function () use ($id): ?string {
        try {
            app()->call([new SendInvoiceToFiscalProvider($id), 'handle']);
        } catch (RuntimeException $e) {
            return $e->getMessage();
        }

        return null;
    });
    expect($error)->toContain('OSE no disponible');
    $events = withinTenant(tenantA(), fn () => DB::table('fin_fiscal_events')->where('invoice_id', invoiceRow('B001-00008813')->id)->pluck('status')->all());

    expect(invoiceRow('B001-00008813')->status)->toBe('pendiente_envio')
        ->and($events)->toBe(['error_temporal']);
});

it('la nota de crédito total se envía al OSE y al aceptarse anula la factura', function () {
    actingAsSeed('U07');

    $data = $this->postJson('/api/v1/finance/invoices', ['doc_type' => '07', 'ref_invoice_id' => 'F001-00001482', 'credit_note_reason_code' => '01', 'credit_note_reason' => 'Cancelación del viaje'], critical())
        ->assertStatus(202)->json('data');

    expect($data['number'])->toBe('FC01-00000001')
        ->and(invoiceRow('F001-00001482')->status)->toBe('aceptado');

    runFiscalJob('FC01-00000001');

    expect(invoiceRow('FC01-00000001')->status)->toBe('aceptado')
        ->and(invoiceRow('F001-00001482')->status)->toBe('anulado');
});

it('financeInvoicesDeliver solo entrega aceptados y financeInvoicesResend reenvía observados con If-Match', function () {
    actingAsSeed('U07');

    $this->postJson('/api/v1/finance/invoices/F001-00001482/deliver', [], critical())->assertOk();
    expect(invoiceRow('F001-00001482')->delivered_at)->not->toBeNull();
    expect($this->postJson('/api/v1/finance/invoices/B001-00008812/deliver', [], critical()))->toBeApiError(409, 'FIN-BR-47');

    (new UniqueLock(app('cache')->store()))->release(new SendInvoiceToFiscalProvider((string) invoiceRow('B001-00008812')->id));
    expect($this->postJson('/api/v1/finance/invoices/B001-00008812/resend', ['fx_rate' => '3.75'], ['Accept' => 'application/json', 'Idempotency-Key' => idem()]))->toBeApiError(428, 'IF_MATCH_REQUIRED');
    $this->postJson('/api/v1/finance/invoices/B001-00008812/resend', ['fx_rate' => '3.75'], critical((int) invoiceRow('B001-00008812')->lock_version))
        ->assertOk()->assertJsonPath('data.status', 'pendiente_envio');
    Queue::assertPushed(SendInvoiceToFiscalProvider::class);
});

it('financeInvoicesStatusCheck reenvía lo pendiente y rechaza consultar un aceptado', function () {
    actingAsSeed('U07');
    $this->postJson('/api/v1/finance/invoices', boletaBody(), critical())->assertStatus(202);

    $this->postJson('/api/v1/finance/invoices/B001-00008813/status-check')->assertOk()->assertJsonPath('data.status', 'pendiente_envio');
    expect($this->postJson('/api/v1/finance/invoices/F001-00001482/status-check'))->toBeApiError(409, 'FIN-BR-49');
});

it('listFinanceInvoices pagina y filtra; showFinanceInvoices trae líneas y eventos; summary lista lo cobrado por facturar', function () {
    actingAsSeed('U08');

    $accepted = $this->getJson('/api/v1/finance/invoices?filter[status]=aceptado&page[size]=2')->assertOk();
    $detail = $this->getJson('/api/v1/finance/invoices/F001-00001482')->assertOk()->json('data');
    $summary = $this->getJson('/api/v1/finance/invoices/summary')->assertOk()->json('data');

    expect(collect($accepted->json('data'))->pluck('status')->unique()->all())->toBe(['aceptado'])
        ->and($accepted->json('meta.kpis'))->toHaveKeys(['month_pen', 'accepted', 'observed', 'waiting', 'uninvoiced_pen'])
        ->and($detail['lines'])->toHaveCount(1)
        ->and($detail)->toHaveKeys(['fiscal_events', 'history', 'credit_notes'])
        ->and(collect($summary['pending'])->pluck('code'))->toContain('CXC-00715');
    expect($this->getJson('/api/v1/finance/invoices?filter[status]=inventado'))->toBeApiError(422, 'FILTER_INVALID');

    actingAsSeed('U03');
    expect($this->getJson('/api/v1/finance/invoices'))->toBeApiError(403);
});
