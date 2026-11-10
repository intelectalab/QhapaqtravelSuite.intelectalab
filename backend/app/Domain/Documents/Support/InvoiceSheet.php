<?php

declare(strict_types=1);

namespace App\Domain\Documents\Support;

use App\Domain\Shared\Money\Decimal;
use Brick\Math\BigDecimal;
use Brick\Math\RoundingMode;
use Illuminate\Support\Facades\DB;

final class InvoiceSheet
{
    public const DOC_TYPE = 'comprobante_pdf';

    public const PRINTABLE = ['aceptado', 'observado', 'anulado'];

    private const KINDS = [
        '01' => 'Factura electrónica',
        '03' => 'Boleta de venta electrónica',
        '07' => 'Nota de crédito electrónica',
        '08' => 'Nota de débito electrónica',
    ];

    private const CUSTOMER_DOCS = [
        'RUC' => 'RUC',
        'DNI' => 'DNI',
        'PASAPORTE' => 'Pasaporte',
        'CE' => 'Carné de extranjería',
        'SIN_DOC' => 'Sin documento',
    ];

    private const SUNAT_DOCS = ['RUC' => '6', 'DNI' => '1', 'CE' => '4', 'PASAPORTE' => '7', 'SIN_DOC' => '0'];

    private const UNITS = ['ZZ' => 'Servicio', 'NIU' => 'Unidad'];

    private const CURRENCIES = ['PEN' => 'Soles', 'USD' => 'Dólares estadounidenses'];

    public function __construct(private readonly AgencyLetterhead $agency) {}

    public static function kind(string $docType): string
    {
        return self::KINDS[$docType] ?? 'Comprobante electrónico';
    }

    public function draft(string $invoiceId): DocumentDraft
    {
        $invoice = DB::table('fin_invoices')->where('id', $invoiceId)->first() ?? throw new \RuntimeException("Comprobante {$invoiceId} inexistente.");
        $currency = (string) $invoice->currency;
        $export = $invoice->operation_type === 'exportacion';
        $reservation = DB::table('booking_reservations')->where('id', $invoice->reservation_id)->value('code');
        $receivable = $invoice->receivable_id ? DB::table('fin_receivables')->where('id', $invoice->receivable_id)->value('code') : null;
        $reference = $invoice->ref_invoice_id ? DB::table('fin_invoices')->where('id', $invoice->ref_invoice_id)->first(['number', 'doc_type', 'issue_date']) : null;
        $kind = self::kind((string) $invoice->doc_type);
        $agency = $this->agency->current();

        $data = [
            'agency' => $agency,
            'document' => [
                'kind' => $kind,
                'code' => (string) $invoice->number,
                'reference' => (string) $invoice->number,
                'state' => (string) $invoice->status,
                'issue_date' => DocumentFormat::date((string) $invoice->issue_date),
                'currency' => self::CURRENCIES[$currency] ?? $currency,
                'fx' => $currency === 'USD' && $invoice->fx_rate !== null ? 'S/ '.number_format((float) $invoice->fx_rate, 3, '.', '') : null,
                'operation' => $export ? 'Exportación de servicios' : 'Venta interna',
                'hash' => $invoice->hash_code,
                'qr' => QrImage::dataUri(self::sunatQr($invoice, (string) $agency['ruc']), 5),
                'simulated' => str_contains(mb_strtolower((string) $invoice->fiscal_provider), 'simulad') || str_contains(mb_strtolower((string) $invoice->ose_response_message), 'simulad'),
            ],
            'customer' => [
                'name' => (string) $invoice->customer_name,
                'document_label' => self::CUSTOMER_DOCS[$invoice->customer_doc_type] ?? (string) $invoice->customer_doc_type,
                'document' => (string) $invoice->customer_doc_number,
                'address' => $invoice->customer_address,
                'domiciled' => (bool) $invoice->customer_domiciled,
            ],
            'related' => array_values(array_filter([
                $reservation ? ['label' => 'Reserva', 'value' => (string) $reservation] : null,
                $receivable ? ['label' => 'Cuota', 'value' => (string) $receivable] : null,
            ])),
            'modifies' => $reference === null ? null : [
                'kind' => self::kind((string) $reference->doc_type),
                'number' => (string) $reference->number,
                'date' => DocumentFormat::date((string) $reference->issue_date),
                'reason' => trim(implode(' · ', array_filter([$invoice->credit_note_reason_code ? "Motivo {$invoice->credit_note_reason_code}" : null, $invoice->credit_note_reason]))) ?: null,
            ],
            'lines' => DB::table('fin_invoice_lines')->where('invoice_id', $invoice->id)->orderBy('line_no')
                ->get(['description', 'quantity', 'unit_code', 'unit_value', 'line_amount', 'igv_amount'])
                ->map(fn (object $line): array => [
                    'quantity' => (string) BigDecimal::of((string) $line->quantity)->strippedOfTrailingZeros(),
                    'unit' => self::UNITS[$line->unit_code] ?? (string) $line->unit_code,
                    'description' => (string) $line->description,
                    'unit_value' => DocumentFormat::money((string) $line->unit_value, $currency),
                    'tax' => DocumentFormat::money((string) $line->igv_amount, $currency),
                    'amount' => DocumentFormat::money((string) $line->line_amount, $currency),
                ])->values()->all(),
            'totals' => array_values(array_filter([
                ['label' => $export ? 'Op. exportación' : 'Op. gravada', 'value' => DocumentFormat::money((string) $invoice->taxable_amount, $currency)],
                Decimal::of((string) $invoice->exempt_amount)->isPositive() ? ['label' => 'Op. exonerada', 'value' => DocumentFormat::money((string) $invoice->exempt_amount, $currency)] : null,
                ['label' => 'IGV', 'value' => DocumentFormat::money((string) $invoice->igv_amount, $currency)],
            ])),
            'grand_total' => DocumentFormat::money((string) $invoice->total_amount, $currency),
            'amount_in_words' => (string) $invoice->amount_in_words,
            'description' => (string) $invoice->description,
            'legend' => "Representación impresa de la {$this->lower($kind)}. Puede verificar su validez en www.sunat.gob.pe con el RUC del emisor, el tipo, la serie y el número del comprobante.",
        ];

        return new DocumentDraft(self::DOC_TYPE, 'fin_invoices', (string) $invoice->id, 'documents.invoice', "{$kind} {$invoice->number}", "{$invoice->number}.pdf", $data);
    }

    public static function sunatQr(object $invoice, string $ruc): string
    {
        [$series, $number] = array_pad(explode('-', (string) $invoice->number, 2), 2, '');

        return implode('|', [
            $ruc,
            (string) $invoice->doc_type,
            $series,
            $number,
            (string) BigDecimal::of((string) $invoice->igv_amount)->toScale(2, RoundingMode::HALF_UP),
            (string) BigDecimal::of((string) $invoice->total_amount)->toScale(2, RoundingMode::HALF_UP),
            substr((string) $invoice->issue_date, 0, 10),
            self::SUNAT_DOCS[$invoice->customer_doc_type] ?? '0',
            (string) $invoice->customer_doc_number,
            (string) $invoice->hash_code,
        ]).'|';
    }

    private function lower(string $kind): string
    {
        return mb_strtolower(mb_substr($kind, 0, 1)).mb_substr($kind, 1);
    }
}
