<?php

declare(strict_types=1);

namespace App\Domain\Documents\Actions;

use App\Domain\Documents\Support\DocumentDraft;
use App\Domain\Documents\Support\DocumentStore;
use App\Domain\Documents\Support\InvoiceSheet;
use App\Domain\Documents\Support\ProductSheet;
use App\Domain\Documents\Support\QuoteProposalSheet;
use App\Domain\Documents\Support\ReservationSheet;
use App\Domain\Documents\Support\StoredDocument;
use App\Domain\Documents\Support\VoucherSheet;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use App\Jobs\GenerateDocumentPdf;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

final class ClientDocuments
{
    public const QUOTE = 'quote';

    public const CONFIRMATION = 'confirmation';

    public const ITINERARY = 'itinerary';

    public const VOUCHER = 'voucher';

    public const INVOICE = 'invoice';

    public const SHEET = 'sheet';

    public function __construct(
        private readonly DocumentStore $store,
        private readonly QuoteProposalSheet $quotes,
        private readonly ReservationSheet $reservations,
        private readonly VoucherSheet $vouchers,
        private readonly InvoiceSheet $invoices,
        private readonly AuditLogger $audit,
        private readonly ProductSheet $sheets,
    ) {}

    public function draft(string $kind, string $entityId): DocumentDraft
    {
        return match ($kind) {
            self::QUOTE => $this->quotes->draft($entityId),
            self::CONFIRMATION => $this->reservations->confirmation($entityId),
            self::ITINERARY => $this->reservations->itinerary($entityId),
            self::VOUCHER => $this->vouchers->draft($entityId),
            self::INVOICE => $this->invoices->draft($entityId),
            self::SHEET => $this->sheets->draft($entityId),
            default => throw new InvalidArgumentException("Documento {$kind} desconocido."),
        };
    }

    public function generate(string $kind, string $entityId, ?string $job = null): StoredDocument
    {
        $document = $this->store->store($this->draft($kind, $entityId), $job);
        $this->link($kind, $entityId, $document);

        if ($document->fresh && $kind === self::QUOTE) {
            $version = DB::table('quote_versions as v')->join('quote_quotes as q', 'q.id', '=', 'v.quote_id')->where('v.id', $entityId)->first(['q.code', 'v.version_no']);
            $this->audit->log('Cotización', (string) $version->code, 'generar_pdf', null, "v{$version->version_no} · {$document->fileName}");
        }

        return $document;
    }

    public function queueQuote(string $versionId): array
    {
        $draft = $this->draft(self::QUOTE, $versionId);
        $current = $this->store->current($draft);

        if ($current !== null) {
            $this->link(self::QUOTE, $versionId, $current);

            return ['status' => 'listo', 'file_name' => $draft->fileName, 'document_id' => $current->id, 'generated_at' => $current->createdAt];
        }

        dispatch((new GenerateDocumentPdf(self::QUOTE, $versionId))->captureTenant());

        return ['status' => 'en_cola', 'file_name' => $draft->fileName, 'document_id' => null, 'generated_at' => null];
    }

    public function printableInvoice(object $invoice): void
    {
        if (! in_array($invoice->status, InvoiceSheet::PRINTABLE, true)) {
            throw ApiException::conflict('FIN-BR-47', 'La representación impresa estará disponible cuando el OSE acepte el comprobante.');
        }
    }

    public function liveVoucher(object $voucher): void
    {
        if ($voucher->status === 'anulado') {
            throw ApiException::conflict('VOUCHER_VOIDED', 'Este voucher está anulado y ya no tiene un documento vigente.');
        }
    }

    public function printableReservation(object $reservation): void
    {
        if (in_array($reservation->status, ['borrador', 'cancelada'], true)) {
            throw ApiException::conflict('RESERVATION_STATE', $reservation->status === 'cancelada'
                ? 'La reserva está cancelada; ya no emite confirmación ni itinerario.'
                : 'La reserva aún es un borrador; confírmala para emitir el documento.');
        }
    }

    private function link(string $kind, string $entityId, StoredDocument $document): void
    {
        match ($kind) {
            self::QUOTE => DB::table('quote_versions')->where('id', $entityId)->where(fn ($query) => $query->whereNull('pdf_document_id')->orWhere('pdf_document_id', '<>', $document->id))->update(['pdf_document_id' => $document->id]),
            self::VOUCHER => $this->linkVoucher($entityId, $document),
            self::INVOICE => DB::table('fin_invoices')->where('id', $entityId)->where(fn ($query) => $query->whereNull('pdf_document_id')->orWhere('pdf_document_id', '<>', $document->id))->update(['pdf_document_id' => $document->id]),
            default => null,
        };
    }

    private function linkVoucher(string $voucherId, StoredDocument $document): void
    {
        $voucher = DB::table('ops_vouchers')->where('id', $voucherId)->first(['id', 'version', 'document_id']);

        if ($voucher->document_id !== $document->id) {
            DB::table('ops_vouchers')->where('id', $voucherId)->update(['document_id' => $document->id]);
        }

        DB::table('ops_voucher_versions')->where('voucher_id', $voucherId)->where('version', $voucher->version)->whereNull('document_id')->update(['document_id' => $document->id]);
    }
}
