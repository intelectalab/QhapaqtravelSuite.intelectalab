<?php

declare(strict_types=1);

namespace App\Domain\Finance\Actions;

use App\Domain\Finance\Support\AmountInWords;
use App\Domain\Finance\Support\Consolidation;
use App\Domain\Finance\Support\FinanceHistory;
use App\Domain\Finance\Support\InvoiceDirectory;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Money\Decimal;
use App\Domain\Shared\Outbox\OutboxWriter;
use App\Jobs\SendInvoiceToFiscalProvider;
use Illuminate\Support\Facades\DB;

final class IssueCreditNote
{
    public function __construct(private readonly Consolidation $money, private readonly AuditLogger $audit, private readonly OutboxWriter $outbox) {}

    public function __invoke(string $number, array $data, User $actor): string
    {
        return DB::transaction(function () use ($number, $data, $actor): string {
            $invoice = DB::table('fin_invoices')->where(preg_match('/^[0-9a-f-]{36}$/i', $number) === 1 ? 'id' : 'number', $number)->lockForUpdate()->first();

            if ($invoice === null) {
                throw ApiException::notFound('El comprobante no existe.');
            }

            if ($invoice->status !== 'aceptado' || ! in_array($invoice->doc_type, ['01', '03'], true)) {
                throw ApiException::conflict('FIN-BR-41', 'La nota de crédito solo se emite sobre una factura o boleta aceptada por el OSE.');
            }

            $credited = Decimal::of(DB::table('fin_invoices')->where('ref_invoice_id', $invoice->id)->where('doc_type', '07')->where('status', '<>', 'anulado')->sum('total_amount'));
            $available = Decimal::money($invoice->total_amount)->minus($credited);
            $total = isset($data['amount']) ? Decimal::money($data['amount']) : $available;

            if (! $total->isPositive() || $total->isGreaterThan($available)) {
                throw ApiException::unprocessable('FIN-BR-41', 'El importe de la nota de crédito no puede superar el saldo del comprobante.');
            }

            $series = $invoice->doc_type === '01' ? 'FC01' : 'BC01';
            $row = DB::table('fin_document_series')->where('series', $series)->lockForUpdate()->first(['id', 'next_number']);
            if ($row === null) {
                throw ApiException::unprocessable('FIN-BR-46', "Configura la serie {$series} antes de emitir notas de crédito.");
            }
            DB::table('fin_document_series')->where('id', $row->id)->update(['next_number' => $row->next_number + 1, 'updated_at' => now()]);

            $domiciled = (bool) $invoice->customer_domiciled;
            $taxable = $domiciled ? Decimal::withoutIgv($total) : $total;
            $igv = (string) $total->minus($taxable);
            $creditNumber = $series.'-'.str_pad((string) $row->next_number, 8, '0', STR_PAD_LEFT);
            $date = $this->money->today();
            $reason = InvoiceDirectory::CREDIT_REASONS[$data['reason_code']];
            $description = trim($reason.'. '.($data['detail'] ?? ''), '. ').". Modifica {$invoice->number}";

            $id = (string) DB::table('fin_invoices')->insertGetId([
                'number' => $creditNumber,
                'doc_type' => '07',
                'series' => $series,
                'correlative' => $row->next_number,
                'issue_date' => $date,
                'period' => substr($date, 0, 7),
                'client_id' => $invoice->client_id,
                'customer_doc_type' => $invoice->customer_doc_type,
                'customer_doc_number' => $invoice->customer_doc_number,
                'customer_name' => $invoice->customer_name,
                'customer_address' => $invoice->customer_address,
                'customer_domiciled' => $domiciled,
                'reservation_id' => $invoice->reservation_id,
                'receivable_id' => $invoice->receivable_id,
                'operation_type' => $invoice->operation_type,
                'sunat_operation_code' => $invoice->sunat_operation_code,
                'currency' => $invoice->currency,
                'fx_rate' => $invoice->fx_rate,
                'taxable_amount' => (string) $taxable,
                'igv_amount' => $igv,
                'exempt_amount' => 0,
                'total_amount' => (string) $total,
                'amount_in_words' => AmountInWords::of($total, $invoice->currency),
                'description' => mb_substr($description, 0, 500),
                'ref_invoice_id' => $invoice->id,
                'credit_note_reason_code' => $data['reason_code'],
                'credit_note_reason' => mb_substr($data['detail'] ?? $reason, 0, 255),
                'status' => 'pendiente_envio',
                'fiscal_provider' => 'OSE (simulado)',
                'issued_by' => $actor->getKey(),
                'created_by' => $actor->getKey(),
                'updated_by' => $actor->getKey(),
            ], 'id');

            DB::table('fin_invoice_lines')->insert([
                'invoice_id' => $id,
                'line_no' => 1,
                'description' => mb_substr($description, 0, 500),
                'quantity' => 1,
                'unit_code' => 'ZZ',
                'unit_value' => (string) $taxable,
                'igv_affectation' => $domiciled ? '10' : '40',
                'line_amount' => (string) $taxable,
                'igv_amount' => $igv,
                'created_by' => $actor->getKey(),
            ]);
            FinanceHistory::record('invoice', $id, 'pendiente_envio', "Nota de crédito que modifica {$invoice->number}", $actor);
            $this->audit->log('Comprobante', $creditNumber, 'emitir', $invoice->number, "{$invoice->currency} {$total} · {$reason}");
            $this->outbox->add('fin_invoice', $id, 'InvoiceRequested', ['invoice_id' => $id, 'number' => $creditNumber, 'doc_type' => '07']);
            dispatch((new SendInvoiceToFiscalProvider($id))->captureTenant())->afterCommit();

            return $creditNumber;
        });
    }
}
