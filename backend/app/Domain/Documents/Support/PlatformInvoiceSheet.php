<?php

declare(strict_types=1);

namespace App\Domain\Documents\Support;

use App\Domain\Platform\Support\PlatformSettings;
use Illuminate\Support\Facades\DB;

final class PlatformInvoiceSheet
{
    public const DOC_TYPE = 'factura_plataforma';

    public const ENTITY = 'platform_invoice';

    private const STATUSES = [
        'draft' => 'Borrador',
        'open' => 'Pendiente de pago',
        'paid' => 'Pagada',
        'failed' => 'Cobro rechazado',
        'uncollectible' => 'Incobrable',
        'void' => 'Anulada',
    ];

    private const KINDS = [
        'subscription' => 'Suscripción',
        'proration' => 'Prorrateo por cambio de plan',
        'addon' => 'Complemento',
        'manual' => 'Cargo manual',
    ];

    public function __construct(private readonly PlatformSettings $settings) {}

    public static function number(object $invoice): string
    {
        return $invoice->series.'-'.str_pad((string) $invoice->number, 8, '0', STR_PAD_LEFT);
    }

    public function draft(object $invoice): DocumentDraft
    {
        $currency = (string) $invoice->currency;
        $number = self::number($invoice);
        $issuer = $this->settings->issuer();
        $billTo = $invoice->bill_to ? (array) json_decode((string) $invoice->bill_to, true) : [];
        $lines = DB::connection('pgsql_platform')->table('platform_invoice_lines')->where('invoice_id', $invoice->id)->orderBy('id')->get(['description', 'quantity', 'unit_price', 'amount']);
        $name = (string) ($issuer['name'] ?: 'KipuControl Cloud S.A.C.');

        $data = [
            'agency' => [
                'name' => 'KipuControl',
                'legal_name' => $name,
                'ruc' => (string) $issuer['ruc'],
                'address' => (string) $issuer['address'],
                'email' => (string) $issuer['email'],
                'phone' => null,
                'web' => (string) $issuer['web'],
                'registry' => null,
                'initials' => 'KC',
                'brand' => AgencyLetterhead::ACCENT,
                'accent' => AgencyLetterhead::BRAND,
                'ink' => AgencyLetterhead::INK,
            ],
            'document' => [
                'kind' => 'Factura de suscripción',
                'reference' => $number,
                'code' => $number,
                'state' => $invoice->status,
                'state_label' => self::STATUSES[$invoice->status] ?? $invoice->status,
                'concept' => self::KINDS[$invoice->kind] ?? (string) $invoice->kind,
                'issue_date' => DocumentFormat::date($invoice->issue_date),
                'due_date' => DocumentFormat::date($invoice->due_date),
                'period' => DocumentFormat::range((string) $invoice->period_from, (string) $invoice->period_to),
                'currency' => $currency,
                'paid_at' => $invoice->paid_at ? DocumentFormat::date(substr((string) $invoice->paid_at, 0, 10)) : null,
                'sunat' => $invoice->sunat_status,
            ],
            'customer' => [
                'name' => (string) ($billTo['name'] ?? ''),
                'ruc' => (string) ($billTo['ruc'] ?? ''),
                'address' => (string) ($billTo['address'] ?? ''),
            ],
            'lines' => $lines->map(fn (object $line): array => [
                'description' => $line->description,
                'quantity' => rtrim(rtrim(number_format((float) $line->quantity, 2, '.', ''), '0'), '.'),
                'unit_price' => DocumentFormat::money((string) $line->unit_price, $currency),
                'amount' => DocumentFormat::money((string) $line->amount, $currency),
            ])->all(),
            'totals' => [
                ['label' => 'Subtotal', 'value' => DocumentFormat::money((string) $invoice->subtotal, $currency)],
                ['label' => 'IGV (18 %)', 'value' => DocumentFormat::money((string) $invoice->igv, $currency)],
            ],
            'grand_total' => DocumentFormat::money((string) $invoice->total, $currency),
        ];

        return new DocumentDraft(self::DOC_TYPE, self::ENTITY, (string) $invoice->id, 'documents.platform-invoice', "Factura {$number}", "Factura-{$number}.pdf", $data);
    }
}
