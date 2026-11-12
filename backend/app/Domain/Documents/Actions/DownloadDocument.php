<?php

declare(strict_types=1);

namespace App\Domain\Documents\Actions;

use App\Domain\Crm\Support\Portfolio;
use App\Domain\Iam\Models\User;
use App\Domain\Iam\Support\RoleExperience;
use App\Domain\Portal\Support\PortalAccount;
use App\Domain\Portal\Support\PortalDocuments;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use RuntimeException;

final class DownloadDocument
{
    public const URL_MINUTES = 5;

    private const SOURCES = [
        'quote_versions' => ['permissions' => ['quotes.view'], 'label' => 'Cotización'],
        'booking_reservations' => ['permissions' => ['reservations.view'], 'label' => 'Reserva'],
        'ops_vouchers' => ['permissions' => ['operations.view'], 'label' => 'Voucher'],
        'fin_invoices' => ['permissions' => ['finance.invoicing'], 'label' => 'Comprobante'],
        'fin_cash_count' => ['permissions' => ['finance.treasury'], 'label' => 'Arqueo de caja'],
        'fin_payables' => ['permissions' => ['finance.payables'], 'label' => 'Cuenta por pagar'],
        'ops_travel_doc_items' => ['permissions' => ['operations.travel_docs'], 'label' => 'Documento de viaje'],
        'catalog_products' => ['permissions' => ['catalog.products.view'], 'label' => 'Producto'],
    ];

    public function __construct(private readonly AuditLogger $audit) {}

    public function url(User $viewer, string $id): string
    {
        $document = Str::isUuid($id) ? DB::table('sys_documents')->where('id', $id)->first() : null;
        if ($document === null) {
            throw ApiException::notFound('El documento no existe.');
        }

        $source = self::SOURCES[(string) $document->entity_type] ?? throw ApiException::forbidden('SEC-BR-01', 'Este documento no se descarga desde aquí.');
        $portal = in_array(RoleExperience::for($viewer)['role'], ['customer', 'passenger'], true) ? PortalAccount::of($viewer) : null;

        if ($portal !== null) {
            if (! PortalDocuments::owns($portal, (string) $document->entity_type, (string) $document->entity_id)) {
                throw ApiException::notFound('No encontramos ese documento en tu cuenta.');
            }
        } elseif (! collect($source['permissions'])->contains(fn (string $permission): bool => $viewer->can($permission))) {
            throw ApiException::forbidden('SEC-BR-01', 'No tienes permiso para ver el registro de este documento.', $source['permissions']);
        }

        $this->ensureOwnership($viewer, (string) $document->entity_type, (string) $document->entity_id);

        try {
            $url = Storage::disk((string) $document->storage_disk)->temporaryUrl((string) $document->storage_path, CarbonImmutable::now()->addMinutes(self::URL_MINUTES));
        } catch (RuntimeException) {
            throw ApiException::conflict('DOCUMENT_UNAVAILABLE', 'El archivo de este documento no está disponible en este momento.');
        }

        $this->audit->log($source['label'], (string) $document->file_name, 'descargar', null, (string) $document->doc_type);

        return $url;
    }

    private function ensureOwnership(User $viewer, string $entityType, string $entityId): void
    {
        if (! Portfolio::ownOnly($viewer)) {
            return;
        }

        $owner = match ($entityType) {
            'quote_versions' => DB::table('quote_versions as v')->join('quote_quotes as q', 'q.id', '=', 'v.quote_id')->where('v.id', $entityId)->value('q.owner_id'),
            'booking_reservations' => DB::table('booking_reservations')->where('id', $entityId)->value('owner_id'),
            default => null,
        };

        if ($owner !== null && (string) $owner !== (string) $viewer->getKey()) {
            throw ApiException::forbidden('SEC-BR-09', 'Este documento pertenece a la cartera de otro asesor.');
        }
    }
}
