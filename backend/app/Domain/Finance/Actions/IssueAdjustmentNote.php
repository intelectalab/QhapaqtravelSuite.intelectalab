<?php

declare(strict_types=1);

namespace App\Domain\Finance\Actions;

use App\Domain\Finance\Support\AmountInWords;
use App\Domain\Finance\Support\Consolidation;
use App\Domain\Finance\Support\FinanceHistory;
use App\Domain\Finance\Support\InvoiceDirectory;
use App\Domain\Finance\Support\InvoiceRules;
use App\Domain\Iam\Models\User;
use App\Domain\Integrations\Support\AgencyIntegrations;
use App\Domain\Integrations\Support\IntegrationReadiness;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Money\Decimal;
use App\Domain\Shared\Outbox\OutboxWriter;
use App\Jobs\SendInvoiceToFiscalProvider;
use Brick\Math\BigDecimal;
use Illuminate\Support\Facades\DB;

final class IssueAdjustmentNote
{
    public const CREDIT = '07';

    public const DEBIT = '08';

    private const LABEL = [self::CREDIT => 'nota de crédito', self::DEBIT => 'nota de débito'];

    public function __construct(
        private readonly InvoiceRules $rules,
        private readonly Consolidation $money,
        private readonly AuditLogger $audit,
        private readonly OutboxWriter $outbox,
    ) {}

    public function credit(string $reference, array $data, User $actor): string
    {
        app(AgencyIntegrations::class)->assertReady('ose');

        return $this->issue(self::CREDIT, $reference, $data, $actor);
    }

    public function debit(string $reference, array $data, User $actor): string
    {
        app(AgencyIntegrations::class)->assertReady('ose');

        return $this->issue(self::DEBIT, $reference, $data, $actor);
    }

    public function forRefund(object $reservation, string $refund, string $penalty, User $actor): array
    {
        $remaining = Decimal::money($refund);
        $issued = [];
        $invoices = DB::table('fin_invoices')->where('reservation_id', $reservation->id)->whereIn('doc_type', ['01', '03'])->where('status', 'aceptado')->where('currency', $reservation->currency)
            ->orderByDesc('issue_date')->orderByDesc('correlative')->get(['id', 'number', 'total_amount']);

        foreach ($invoices as $invoice) {
            if (! $remaining->isPositive()) {
                break;
            }

            $available = Decimal::money($invoice->total_amount)->minus($this->credited((string) $invoice->id));
            if (! $available->isPositive()) {
                continue;
            }

            $amount = BigDecimal::min($remaining, $available);
            $data = [
                'reason_code' => $amount->isEqualTo($available) && $available->isEqualTo(Decimal::money($invoice->total_amount)) ? '01' : '09',
                'amount' => (string) $amount,
                'detail' => mb_substr("Anulación por cancelación de {$reservation->code} (penalidad {$reservation->currency} {$penalty})", 0, 255),
            ];

            try {
                app(AgencyIntegrations::class)->assertReady('ose');
                $issued[] = $this->issue(self::CREDIT, (string) $invoice->id, $data, $actor);
                $remaining = $remaining->minus($amount);
            } catch (ApiException $error) {
                $this->audit->log('Reserva', (string) $reservation->code, 'nota_credito_pendiente', $invoice->number, mb_substr($error->getMessage(), 0, 250), actor: $actor);
            }
        }

        $waiting = DB::table('fin_invoices')->where('reservation_id', $reservation->id)->whereIn('doc_type', ['01', '03'])->whereIn('status', ['pendiente_envio', 'emitido', 'observado'])->pluck('number')->all();
        if ($remaining->isPositive() && $waiting !== []) {
            $this->audit->log('Reserva', (string) $reservation->code, 'nota_credito_pendiente', implode(', ', $waiting), "{$reservation->currency} {$remaining} sin nota de crédito: el comprobante aún no está aceptado por el OSE", actor: $actor);
        }

        return $issued;
    }

    private function issue(string $type, string $reference, array $data, User $actor): string
    {
        return DB::transaction(function () use ($type, $reference, $data, $actor): string {
            $label = self::LABEL[$type];
            $invoice = DB::table('fin_invoices')->where(preg_match('/^[0-9a-f-]{36}$/i', $reference) === 1 ? 'id' : 'number', $reference)->lockForUpdate()->first();

            if ($invoice === null) {
                throw ApiException::notFound('El comprobante no existe.');
            }

            if ($invoice->status !== 'aceptado' || ! in_array($invoice->doc_type, ['01', '03'], true)) {
                throw ApiException::conflict('FIN-BR-41', "La {$label} solo se emite sobre una factura o boleta aceptada por el OSE.");
            }

            $closed = $this->rules->closedPeriod();
            if ($closed !== null) {
                throw ApiException::unprocessable('FIN-BR-48', "El periodo {$closed} está cerrado: la {$label} se emite en el periodo siguiente.");
            }

            $total = $this->amount($type, $invoice, $data);
            $prefix = substr((string) $invoice->series, 0, 1);
            $row = DB::table('fin_document_series')->where('doc_type', $type)->where('active', true)->where('series', 'like', $prefix.'%')->orderBy('series')->lockForUpdate()->first(['id', 'series', 'next_number']);
            if ($row === null) {
                throw ApiException::unprocessable('FIN-BR-46', "Configura una serie activa de {$label} que empiece con {$prefix} antes de emitirla.");
            }
            DB::table('fin_document_series')->where('id', $row->id)->update(['next_number' => $row->next_number + 1, 'updated_at' => now()]);

            $domiciled = (bool) $invoice->customer_domiciled;
            $taxable = $domiciled ? Decimal::withoutIgv($total) : $total;
            $igv = (string) $total->minus($taxable);
            $number = $row->series.'-'.str_pad((string) $row->next_number, 8, '0', STR_PAD_LEFT);
            $date = $this->money->today();
            $reason = ($type === self::CREDIT ? InvoiceDirectory::CREDIT_REASONS : InvoiceDirectory::DEBIT_REASONS)[$data['reason_code']];
            $description = trim($reason.'. '.($data['detail'] ?? ''), '. ').". Modifica {$invoice->number}";

            $id = (string) DB::table('fin_invoices')->insertGetId([
                'number' => $number,
                'doc_type' => $type,
                'series' => $row->series,
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
                'receivable_id' => $type === self::CREDIT ? $invoice->receivable_id : null,
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
                'fiscal_provider' => IntegrationReadiness::real('ose') ? 'OSE' : 'OSE (simulado)',
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
            FinanceHistory::record('invoice', $id, 'pendiente_envio', ucfirst($label)." que modifica {$invoice->number}", $actor);
            $this->audit->log('Comprobante', $number, 'emitir', $invoice->number, "{$invoice->currency} {$total} · {$reason}", actor: $actor);
            $this->outbox->add('fin_invoice', $id, 'InvoiceRequested', ['invoice_id' => $id, 'number' => $number, 'doc_type' => $type]);
            dispatch((new SendInvoiceToFiscalProvider($id))->captureTenant())->afterCommit();

            return $number;
        });
    }

    private function amount(string $type, object $invoice, array $data): BigDecimal
    {
        if ($type === self::DEBIT) {
            $total = Decimal::money($data['amount'] ?? '0');
            if (! $total->isPositive()) {
                throw ApiException::unprocessable('FIN-BR-41', 'El importe de la nota de débito debe ser mayor que cero.');
            }

            return $total;
        }

        $available = Decimal::money($invoice->total_amount)->minus($this->credited((string) $invoice->id));
        $total = isset($data['amount']) ? Decimal::money($data['amount']) : $available;

        if (! $total->isPositive() || $total->isGreaterThan($available)) {
            throw ApiException::unprocessable('FIN-BR-41', 'El importe de la nota de crédito no puede superar el saldo del comprobante.');
        }

        return $total;
    }

    private function credited(string $invoiceId): BigDecimal
    {
        return Decimal::of(DB::table('fin_invoices')->where('ref_invoice_id', $invoiceId)->where('doc_type', self::CREDIT)->whereNotIn('status', InvoiceDirectory::VOID)->sum('total_amount'));
    }
}
