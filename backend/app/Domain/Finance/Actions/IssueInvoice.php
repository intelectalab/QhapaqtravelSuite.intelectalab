<?php

declare(strict_types=1);

namespace App\Domain\Finance\Actions;

use App\Domain\Finance\Support\Consolidation;
use App\Domain\Finance\Support\FinanceHistory;
use App\Domain\Finance\Support\InvoiceRules;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Money\Decimal;
use App\Domain\Shared\Outbox\OutboxWriter;
use App\Jobs\SendInvoiceToFiscalProvider;
use Illuminate\Support\Facades\DB;

final class IssueInvoice
{
    public function __construct(
        private readonly InvoiceRules $rules,
        private readonly Consolidation $money,
        private readonly AuditLogger $audit,
        private readonly OutboxWriter $outbox,
    ) {}

    public function __invoke(array $data, User $actor): object
    {
        return DB::transaction(function () use ($data, $actor): object {
            $receivable = $this->rules->receivable((string) $data['receivable_id'], true);

            if ($receivable->status === 'cancelada') {
                throw ApiException::conflict('FIN-BR-43', 'Una cuenta por cobrar anulada no se factura.');
            }

            $checked = $this->rules->assert($data, $receivable);
            $docType = (string) $data['doc_type'];
            $series = DB::table('fin_document_series')->where('doc_type', $docType)->where('active', true)->orderBy('series')->lockForUpdate()->first(['id', 'series', 'next_number']);
            DB::table('fin_document_series')->where('id', $series->id)->update(['next_number' => $series->next_number + 1, 'updated_at' => now()]);

            $number = $series->series.'-'.str_pad((string) $series->next_number, 8, '0', STR_PAD_LEFT);
            $date = $this->money->today();
            $currency = (string) $receivable->currency;
            $fx = $currency === 'PEN' ? null : (string) ($data['fx_rate'] ?? $receivable->fx_rate ?? $this->money->usdRate());
            $domiciled = (bool) ($data['domiciled'] ?? true);
            $description = mb_substr(trim((string) $data['description']), 0, 500);

            $id = (string) DB::table('fin_invoices')->insertGetId([
                'number' => $number,
                'doc_type' => $docType,
                'series' => $series->series,
                'correlative' => $series->next_number,
                'issue_date' => $date,
                'period' => substr($date, 0, 7),
                'client_id' => $receivable->client_id,
                'customer_doc_type' => $data['customer_doc_type'],
                'customer_doc_number' => mb_strtoupper(trim((string) $data['customer_doc_number'])),
                'customer_name' => mb_substr(trim((string) $data['customer_name']), 0, 200),
                'customer_address' => isset($data['customer_address']) ? mb_substr((string) $data['customer_address'], 0, 255) : null,
                'customer_domiciled' => $domiciled,
                'reservation_id' => $receivable->reservation_id,
                'receivable_id' => $receivable->id,
                'operation_type' => $checked['operation_type'],
                'sunat_operation_code' => $domiciled ? '0101' : '0200',
                'currency' => $currency,
                'fx_rate' => $fx,
                'taxable_amount' => $checked['taxable_amount'],
                'igv_amount' => $checked['igv_amount'],
                'exempt_amount' => '0',
                'total_amount' => $checked['total_amount'],
                'amount_in_words' => $checked['amount_in_words'],
                'description' => $description,
                'status' => 'pendiente_envio',
                'fiscal_provider' => 'OSE (simulado)',
                'issued_by' => $actor->getKey(),
                'created_by' => $actor->getKey(),
                'updated_by' => $actor->getKey(),
            ], 'id');

            DB::table('fin_invoice_lines')->insert([
                'invoice_id' => $id,
                'line_no' => 1,
                'description' => $description,
                'quantity' => 1,
                'unit_code' => 'ZZ',
                'unit_value' => $checked['taxable_amount'],
                'igv_affectation' => $domiciled ? '10' : '40',
                'line_amount' => $checked['taxable_amount'],
                'igv_amount' => $checked['igv_amount'],
                'created_by' => $actor->getKey(),
            ]);

            FinanceHistory::record('invoice', $id, 'pendiente_envio', "Emitido desde {$receivable->code}", $actor);
            $this->audit->log('Comprobante', $number, 'emitir', $receivable->code, "{$currency} ".Decimal::round2($checked['total_amount']), actor: $actor);
            $this->outbox->add('fin_invoice', $id, 'InvoiceRequested', ['invoice_id' => $id, 'number' => $number, 'doc_type' => $docType]);
            dispatch((new SendInvoiceToFiscalProvider($id))->captureTenant())->afterCommit();

            return DB::table('fin_invoices')->where('id', $id)->first(['number', 'doc_type', 'status', 'currency', 'taxable_amount', 'igv_amount', 'total_amount', 'issue_date']);
        });
    }
}
