<?php

declare(strict_types=1);

namespace App\Domain\Admin\Http\Controllers;

use App\Domain\Admin\Actions\ManageSubscription;
use App\Domain\Documents\Support\DocumentStore;
use App\Domain\Documents\Support\PlatformInvoiceSheet;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

final class PlatformInvoicePdfController
{
    public function __invoke(Request $request, string $number, ManageSubscription $subscriptions, PlatformInvoiceSheet $sheet, DocumentStore $store, AuditLogger $audit): Response|JsonResponse
    {
        $invoice = $subscriptions->invoice($number);

        if ($invoice->status === 'draft') {
            throw ApiException::conflict('DOCUMENT_UNAVAILABLE', 'La factura aún es un borrador: el PDF estará disponible cuando se emita.');
        }

        $document = $store->store($sheet->draft($invoice));

        if ($document->fresh) {
            $audit->log('Factura de plataforma', PlatformInvoiceSheet::number($invoice), 'generar_pdf', null, $document->fileName);
        }

        return $store->respond($document, $request);
    }
}
