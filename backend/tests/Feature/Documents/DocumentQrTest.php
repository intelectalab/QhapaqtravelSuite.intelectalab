<?php

use App\Domain\Documents\Support\InvoiceSheet;
use App\Domain\Documents\Support\QrImage;
use App\Domain\Documents\Support\VoucherSheet;
use chillerlan\QRCode\QRCode;
use Illuminate\Support\Facades\DB;

function readQr(string $dataUri): string
{
    expect($dataUri)->toStartWith('data:image/png;base64,');

    return (string) (new QRCode)->readFromBlob((string) base64_decode(substr($dataUri, strlen('data:image/png;base64,'))));
}

it('el QR del comprobante lleva los datos que pide SUNAT', function () {
    $invoice = (object) [
        'number' => 'F001-00001482',
        'doc_type' => '01',
        'igv_amount' => '3576.2',
        'total_amount' => '23444',
        'issue_date' => '2026-09-11',
        'customer_doc_type' => 'RUC',
        'customer_doc_number' => '20100088771',
        'hash_code' => 'aB3dE5fG7hI9',
    ];

    $content = InvoiceSheet::sunatQr($invoice, '20611234567');

    expect($content)->toBe('20611234567|01|F001|00001482|3576.20|23444.00|2026-09-11|6|20100088771|aB3dE5fG7hI9|')
        ->and(readQr(QrImage::dataUri($content)))->toBe($content);
});

it('el comprobante y el voucher incluyen su QR legible', function () {
    [$invoiceDraft, $invoice, $voucherDraft, $token] = withinTenant(tenantA(), function (): array {
        $invoice = DB::table('fin_invoices')->whereIn('status', InvoiceSheet::PRINTABLE)->first();
        $voucher = DB::table('ops_vouchers')->whereNotNull('qr_token')->first();

        return [app(InvoiceSheet::class)->draft((string) $invoice->id), $invoice, app(VoucherSheet::class)->draft((string) $voucher->id), (string) $voucher->qr_token];
    });

    expect(readQr($invoiceDraft->data['document']['qr']))->toContain('|'.$invoice->doc_type.'|'.explode('-', (string) $invoice->number)[0].'|')
        ->and(readQr($voucherDraft->data['document']['qr']))->toBe($token);
});
