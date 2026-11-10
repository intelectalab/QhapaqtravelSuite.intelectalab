<?php

use Illuminate\Support\Facades\DB;

function finSupInvoice(string $payableCode, string $number, string $difference = '0.00'): void
{
    withinTenant(tenantA(), function () use ($payableCode, $number, $difference) {
        $payable = DB::table('fin_payables')->where('code', $payableCode)->first();
        $uploader = DB::table('iam_users')->where('code', 'U17')->value('id');
        $document = DB::table('sys_documents')->insertGetId([
            'doc_type' => 'factura_proveedor',
            'entity_type' => 'fin_payables',
            'entity_id' => $payable->id,
            'storage_disk' => 'local',
            'storage_path' => "pest/{$number}.pdf",
            'file_name' => "{$number}.pdf",
            'mime_type' => 'application/pdf',
            'size_bytes' => 1024,
            'sha256' => hash('sha256', $number),
            'created_by' => $uploader,
        ], 'id');
        DB::table('supplier_invoices')->insert([
            'payable_id' => $payable->id,
            'provider_id' => $payable->provider_id,
            'number' => $number,
            'issue_date' => BUSINESS_TODAY,
            'amount' => bcadd(bcsub((string) $payable->amount, (string) $payable->paid_amount, 2), $difference, 2),
            'currency' => $payable->currency,
            'amount_difference' => $difference,
            'document_id' => $document,
            'original_file_name' => "{$number}.pdf",
            'status' => 'registrada',
            'uploaded_by' => $uploader,
            'uploaded_at' => now(),
            'created_by' => $uploader,
        ]);
        DB::table('fin_payables')->where('id', $payable->id)->update(['supplier_doc_number' => $number]);
    });
}

function finSupInvoiceRow(string $number): object
{
    return rowOf('supplier_invoices', $number, column: 'number');
}

function finSupInbox(string $number): ?array
{
    return collect(test()->getJson('/api/v1/approvals')->assertOk()->json('data.items'))->firstWhere('code', $number);
}

it('validar la factura del proveedor la deja validada, sale de pendientes y queda en el historial de la cuenta', function () {
    $user = actingAsSeed('U07');
    finSupInvoice('CXP-00397', 'F001-7001');
    expect(finSupInbox('F001-7001')['status'])->toBe('pendiente');

    $this->postJson('/api/v1/finance/supplier-invoices/CXP-00397/validate', [], critical())->assertOk()->assertJsonPath('data.status', 'validada');

    $invoice = finSupInvoiceRow('F001-7001');
    expect($invoice->status)->toBe('validada')
        ->and($invoice->validated_by)->toBe($user->id)
        ->and($invoice->validated_at)->not->toBeNull()
        ->and(rowOf('fin_payables', 'CXP-00397')->supplier_doc_number)->toBe('F001-7001')
        ->and(finSupInbox('F001-7001')['status'])->toBe('validada')
        ->and(withinTenant(tenantA(), fn () => DB::table('fin_status_history')->where('entity_type', 'payable')->where('entity_id', idOf('fin_payables', 'CXP-00397'))->where('note', 'like', 'Factura F001-7001 validada%')->exists()))->toBeTrue()
        ->and(withinTenant(tenantA(), fn () => DB::table('audit_events')->where(['entity' => 'Cuenta por pagar', 'entity_id' => 'CXP-00397', 'action' => 'validar_factura_proveedor'])->exists()))->toBeTrue();
});

it('SUP-BR-41: una factura que no coincide con el saldo solo se valida explicando el motivo', function () {
    actingAsSeed('U07');
    finSupInvoice('CXP-00397', 'F001-7002', '12.50');

    expect($this->postJson('/api/v1/finance/supplier-invoices/CXP-00397/validate', [], critical()))->toBeApiError(422, 'SUP-BR-41')
        ->and(finSupInvoiceRow('F001-7002')->status)->toBe('registrada');

    $this->postJson('/api/v1/finance/supplier-invoices/CXP-00397/validate', ['note' => 'Incluye recargo por noche adicional'], critical())->assertOk();
    expect(finSupInvoiceRow('F001-7002')->status)->toBe('validada')
        ->and(finSupInvoiceRow('F001-7002')->validation_note)->toBe('Incluye recargo por noche adicional');
});

it('observar la factura la devuelve al proveedor y libera el documento de la cuenta por pagar', function () {
    actingAsSeed('U07');
    finSupInvoice('CXP-00397', 'F001-7003');

    $this->postJson('/api/v1/finance/supplier-invoices/CXP-00397/observe', ['note' => 'El RUC del emisor no coincide'], critical())->assertOk()->assertJsonPath('data.status', 'observada');

    expect(finSupInvoiceRow('F001-7003')->status)->toBe('observada')
        ->and(finSupInvoiceRow('F001-7003')->validation_note)->toBe('El RUC del emisor no coincide')
        ->and(rowOf('fin_payables', 'CXP-00397')->supplier_doc_number)->toBeNull()
        ->and(finSupInbox('F001-7003')['status'])->toBe('observada')
        ->and(withinTenant(tenantA(), fn () => DB::table('audit_events')->where(['entity' => 'Cuenta por pagar', 'entity_id' => 'CXP-00397', 'action' => 'observar_factura_proveedor'])->exists()))->toBeTrue();
});

it('APR-BR-07/08: observar exige motivo y una factura revisada no se vuelve a revisar', function () {
    actingAsSeed('U07');
    finSupInvoice('CXP-00397', 'F001-7004');

    $this->postJson('/api/v1/finance/supplier-invoices/CXP-00397/observe', ['note' => ''], critical())->assertStatus(422)->assertJsonValidationErrors(['note']);
    $this->postJson('/api/v1/finance/supplier-invoices/CXP-00397/validate', [], critical())->assertOk();

    expect($this->postJson('/api/v1/finance/supplier-invoices/CXP-00397/validate', [], critical()))->toBeApiError(409, 'APR-BR-08')
        ->and($this->postJson('/api/v1/finance/supplier-invoices/CXP-00397/observe', ['note' => 'Tarde'], critical()))->toBeApiError(409, 'APR-BR-08')
        ->and(finSupInvoiceRow('F001-7004')->status)->toBe('validada');
});

it('no se revisa la factura de una cuenta por pagar anulada ni de una que no tiene factura', function () {
    actingAsSeed('U07');
    finSupInvoice('CXP-00398', 'F001-7005');
    $this->postJson('/api/v1/finance/payables/CXP-00398/cancel', ['reason' => 'Servicio no prestado'], critical())->assertOk();

    expect($this->postJson('/api/v1/finance/supplier-invoices/CXP-00398/validate', [], critical()))->toBeApiError(409, 'APR-BR-08')
        ->and($this->postJson('/api/v1/finance/supplier-invoices/CXP-00405/validate', [], critical()))->toBeApiError(404);
});

it('Ventas y Contabilidad no revisan facturas de proveedores', function (string $user) {
    actingAsSeed('U07');
    finSupInvoice('CXP-00397', 'F001-7006');
    actingAsSeed($user);

    expect($this->postJson('/api/v1/finance/supplier-invoices/CXP-00397/validate', [], critical()))->toBeApiError(403)
        ->and($this->postJson('/api/v1/finance/supplier-invoices/CXP-00397/observe', ['note' => 'Observación'], critical()))->toBeApiError(403)
        ->and(finSupInvoiceRow('F001-7006')->status)->toBe('registrada');
})->with(['U03', 'U08']);
