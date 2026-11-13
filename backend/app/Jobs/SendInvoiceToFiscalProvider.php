<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Domain\Admin\Support\AdapterRetryPolicy;
use App\Domain\Finance\Support\FinanceHistory;
use App\Domain\Integrations\Contracts\FiscalGateway;
use App\Domain\Integrations\Data\AdapterResult;
use App\Domain\Integrations\Data\FiscalDocument;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Outbox\OutboxWriter;
use App\Domain\Shared\Tenancy\Jobs\TenantAware;
use Brick\Math\BigDecimal;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Support\Facades\DB;
use RuntimeException;

final class SendInvoiceToFiscalProvider implements ShouldBeUnique, ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use TenantAware;

    public int $tries = AdapterRetryPolicy::TRIES;

    public int $timeout = AdapterRetryPolicy::TIMEOUT_SECONDS;

    public int $uniqueFor = 300;

    public array $delays = [];

    public function __construct(public readonly string $invoiceId)
    {
        $this->onQueue('integrations');
        $policy = AdapterRetryPolicy::for('fiscal');
        [$this->tries, $this->delays, $this->timeout] = [$policy['tries'], $policy['backoff'], $policy['timeout']];
    }

    public function backoff(): array
    {
        return $this->delays !== [] ? $this->delays : AdapterRetryPolicy::delays();
    }

    public function uniqueId(): string
    {
        return $this->invoiceId;
    }

    public function handle(FiscalGateway $gateway, AuditLogger $audit, OutboxWriter $outbox): void
    {
        $transient = DB::transaction(function () use ($gateway, $audit, $outbox): ?string {
            $invoice = DB::table('fin_invoices')->where('id', $this->invoiceId)->lockForUpdate()->first();

            if ($invoice === null || $invoice->status !== 'pendiente_envio') {
                return null;
            }

            $document = $this->document($invoice);
            $result = $gateway->issue($document);
            $attempt = DB::table('fin_fiscal_events')->where('invoice_id', $invoice->id)->where('action', 'send')->count() + 1;
            DB::table('fin_fiscal_events')->insert([
                'invoice_id' => $invoice->id,
                'action' => 'send',
                'attempt' => $attempt,
                'request_hash' => hash('sha256', (string) json_encode($document)),
                'response_code' => $result->ok ? '0' : ($result->errorClass === 'transitorio' ? 'TMP' : 'ERR'),
                'response_message' => $result->message ?? $result->status,
                'status' => $result->ok ? 'ok' : ($result->errorClass === 'transitorio' ? 'error_temporal' : 'error_definitivo'),
            ]);

            if (! $result->ok && $result->errorClass === 'transitorio') {
                return (string) $result->message;
            }

            $this->apply($invoice, $result, $audit, $outbox);

            return null;
        });

        if ($transient !== null) {
            throw new RuntimeException("OSE no disponible: {$transient}");
        }
    }

    private function apply(object $invoice, AdapterResult $result, AuditLogger $audit, OutboxWriter $outbox): void
    {
        $status = $result->ok ? (in_array($result->status, ['aceptado', 'observado', 'emitido'], true) ? $result->status : 'emitido') : 'rechazado';
        $simulated = (bool) ($result->payload['simulated'] ?? false);
        $message = $result->ok
            ? ($status === 'aceptado' ? 'Aceptado por el OSE'.($simulated ? ' (respuesta simulada)' : '') : ($result->message ?? 'Observado por el OSE'))
            : ($result->message ?? 'Rechazado por el OSE');

        DB::table('fin_invoices')->where('id', $invoice->id)->update([
            'status' => $status,
            'ose_ticket' => $result->externalId,
            'ose_response_code' => $result->ok ? '0' : 'ERR',
            'ose_response_message' => $message,
            'ose_responded_at' => now(),
            'hash_code' => isset($result->payload['hash']) ? mb_substr((string) $result->payload['hash'], 0, 64) : null,
            'lock_version' => DB::raw('lock_version + 1'),
            'updated_at' => now(),
        ]);
        FinanceHistory::record('invoice', $invoice->id, $status, $message, null);
        $audit->log('Comprobante', $invoice->number, 'respuesta_ose', $invoice->status, $status);
        $outbox->add('fin_invoice', $invoice->id, match ($status) {
            'aceptado' => 'InvoiceAccepted',
            'observado' => 'InvoiceObserved',
            'rechazado' => 'InvoiceRejected',
            default => 'InvoiceSent',
        }, ['invoice_id' => $invoice->id, 'number' => $invoice->number, 'status' => $status]);

        if ($status === 'aceptado' && $invoice->doc_type === '07' && $invoice->ref_invoice_id !== null) {
            $this->annulIfFullyCredited((string) $invoice->ref_invoice_id, (string) $invoice->number, $audit);
        }
    }

    private function annulIfFullyCredited(string $originalId, string $creditNumber, AuditLogger $audit): void
    {
        $original = DB::table('fin_invoices')->where('id', $originalId)->lockForUpdate()->first(['id', 'number', 'status', 'total_amount']);
        $credited = DB::table('fin_invoices')->where('ref_invoice_id', $originalId)->where('doc_type', '07')->where('status', 'aceptado')->sum('total_amount');

        if ($original === null || $original->status !== 'aceptado' || BigDecimal::of((string) $original->total_amount)->minus((string) $credited)->isGreaterThan('0.01')) {
            return;
        }

        DB::table('fin_invoices')->where('id', $originalId)->update(['status' => 'anulado', 'lock_version' => DB::raw('lock_version + 1'), 'updated_at' => now()]);
        FinanceHistory::record('invoice', $originalId, 'anulado', "Anulado con {$creditNumber}", null);
        $audit->log('Comprobante', $original->number, 'anular', 'aceptado', "anulado con {$creditNumber}");
    }

    private function document(object $invoice): FiscalDocument
    {
        $lines = DB::table('fin_invoice_lines')->where('invoice_id', $invoice->id)->orderBy('line_no')
            ->get(['description', 'quantity', 'unit_value', 'igv_amount', 'line_amount'])
            ->map(fn (object $line): array => [
                'description' => (string) $line->description,
                'qty' => (string) $line->quantity,
                'unit_price' => (string) $line->unit_value,
                'tax' => (string) $line->igv_amount,
                'total' => (string) BigDecimal::of((string) $line->line_amount)->plus((string) $line->igv_amount),
            ])->all();

        return new FiscalDocument(
            invoiceId: (string) $invoice->id,
            docType: (string) $invoice->doc_type,
            operationType: (string) $invoice->operation_type,
            series: (string) $invoice->series,
            number: str_pad((string) $invoice->correlative, 8, '0', STR_PAD_LEFT),
            issueDate: (string) $invoice->issue_date,
            customerDocType: (string) $invoice->customer_doc_type,
            customerDocNumber: (string) $invoice->customer_doc_number,
            customerName: (string) $invoice->customer_name,
            currency: (string) $invoice->currency,
            taxableAmount: (string) $invoice->taxable_amount,
            taxAmount: (string) $invoice->igv_amount,
            totalAmount: (string) $invoice->total_amount,
            lines: $lines,
            referenceDocument: $invoice->ref_invoice_id === null ? null : DB::table('fin_invoices')->where('id', $invoice->ref_invoice_id)->value('number'),
        );
    }
}
