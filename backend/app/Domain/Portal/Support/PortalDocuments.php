<?php

declare(strict_types=1);

namespace App\Domain\Portal\Support;

use App\Domain\Documents\Actions\ClientDocuments;
use App\Domain\Documents\Support\DocumentStore;
use App\Domain\Documents\Support\InvoiceSheet;
use App\Jobs\GenerateDocumentPdf;
use Illuminate\Support\Facades\DB;
use Throwable;

final class PortalDocuments
{
    public const KINDS = ['voucher' => 'Voucher', 'invoice' => 'Comprobante', 'proposal' => 'Propuesta', 'itinerary' => 'Itinerario'];

    public const APPROVED_QUOTES = ['aprobada', 'convertida'];

    public function __construct(private readonly ClientDocuments $documents, private readonly DocumentStore $store) {}

    public function list(PortalAccount $account): array
    {
        $reservations = $account->reservations()->keyBy('id');
        $ids = $reservations->keys()->all();
        $items = collect();

        foreach (DB::table('ops_vouchers')->whereIn('reservation_id', $ids)->where('status', '<>', 'anulado')->orderBy('service_date')->get(['id', 'code', 'service_label', 'service_date', 'status', 'version', 'reservation_id']) as $row) {
            $items->push([...$this->file(ClientDocuments::VOUCHER, (string) $row->id), 'kind' => 'voucher', 'code' => $row->code, 'label' => $row->service_label, 'date' => $row->service_date, 'status' => $row->status, 'version' => (int) $row->version, 'reservation' => $reservations[$row->reservation_id]->code]);
        }

        foreach ($reservations as $row) {
            if (in_array($row->status, ['borrador', 'cancelada'], true)) {
                continue;
            }

            $items->push([
                'kind' => 'itinerary', 'code' => $row->code, 'label' => $row->title ?: "Itinerario {$row->code}", 'date' => $row->travel_from, 'status' => $row->status, 'version' => 1,
                'reservation' => $row->code, 'document_id' => null, 'ready' => true, 'href' => '/portal/viajes/'.rawurlencode((string) $row->code).'/itinerario',
            ]);
        }

        if (! $account->isPassenger()) {
            foreach (DB::table('fin_invoices')->whereIn('reservation_id', $ids)->whereIn('status', InvoiceSheet::PRINTABLE)->orderByDesc('issue_date')->get(['id', 'number', 'doc_type', 'issue_date', 'status', 'reservation_id']) as $row) {
                $items->push([...$this->file(ClientDocuments::INVOICE, (string) $row->id), 'kind' => 'invoice', 'code' => $row->number, 'label' => ucfirst((string) $row->doc_type)." {$row->number}", 'date' => $row->issue_date, 'status' => $row->status, 'version' => 1, 'reservation' => $reservations[$row->reservation_id]->code]);
            }

            $quotes = DB::table('quote_quotes as q')->leftJoin('booking_reservations as r', 'r.quote_id', '=', 'q.id')->where('q.client_id', $account->client->id)->whereIn('q.status', self::APPROVED_QUOTES)->whereNotNull('q.current_version_id')
                ->orderByDesc('q.approved_at')->get(['q.code', 'q.title', 'q.status', 'q.approved_at', 'q.updated_at', 'r.code as reservation']);
            foreach ($quotes as $row) {
                $items->push([
                    'kind' => 'proposal', 'code' => $row->code, 'label' => $row->title ?: "Propuesta {$row->code}", 'date' => substr((string) ($row->approved_at ?? $row->updated_at), 0, 10), 'status' => 'aprobada', 'version' => 1,
                    'reservation' => $row->reservation, 'document_id' => null, 'ready' => true, 'href' => '/portal/propuestas/'.rawurlencode((string) $row->code).'/pdf',
                ]);
            }
        }

        return [
            'contents' => app(PortalContent::class)->for(PortalContent::audience($account), ['Página legal', 'Página', 'Artículo']),
            'items' => $items->values()->all(),
            'kinds' => collect(self::KINDS)->map(fn (string $label, string $value): array => ['value' => $value, 'label' => $label, 'count' => $items->where('kind', $value)->count()])->filter(fn (array $kind): bool => $kind['count'] > 0)->values()->all(),
        ];
    }

    private function file(string $kind, string $entityId): array
    {
        try {
            $current = $this->store->current($this->documents->draft($kind, $entityId));
        } catch (Throwable) {
            return ['document_id' => null, 'ready' => false, 'href' => null];
        }

        if ($current === null) {
            dispatch((new GenerateDocumentPdf($kind, $entityId))->captureTenant())->afterCommit();

            return ['document_id' => null, 'ready' => false, 'href' => null];
        }

        return ['document_id' => $current->id, 'ready' => true, 'href' => '/portal/documentos/'.$current->id];
    }

    public static function owns(PortalAccount $account, string $entityType, string $entityId): bool
    {
        $reservations = $account->reservations()->pluck('id')->all();

        return match ($entityType) {
            'ops_vouchers' => DB::table('ops_vouchers')->where('id', $entityId)->whereIn('reservation_id', $reservations)->where('status', '<>', 'anulado')->exists(),
            'fin_invoices' => ! $account->isPassenger() && DB::table('fin_invoices')->where('id', $entityId)->whereIn('reservation_id', $reservations)->exists(),
            default => false,
        };
    }
}
