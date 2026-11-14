<?php

declare(strict_types=1);

namespace App\Domain\Finance\Support;

use App\Domain\Shared\Tenancy\TenantContext;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use RuntimeException;

final class FiscalFiles
{
    public const MIME = 'application/xml';

    public const TYPES = ['xml' => 'invoice_xml', 'cdr' => 'invoice_cdr'];

    public function __construct(private readonly TenantContext $context) {}

    public function store(object $invoice, array $payload): array
    {
        $stored = [];

        foreach (self::TYPES as $kind => $docType) {
            $content = $payload[$kind] ?? null;

            if (! is_string($content) || $content === '') {
                continue;
            }

            $stored["{$kind}_document_id"] = $this->put($invoice, $kind, $docType, $content);
        }

        return $stored;
    }

    private function put(object $invoice, string $kind, string $docType, string $content): string
    {
        $disk = (string) config('filesystems.default');
        $tenantId = $this->context->idOrFail();
        $path = "tenants/{$tenantId}/documents/{$docType}/{$invoice->id}-".substr(hash('sha256', $content), 0, 16).'.xml';

        if (! Storage::disk($disk)->put($path, $content)) {
            throw new RuntimeException("No se pudo guardar el archivo fiscal {$path}.");
        }

        $version = (int) DB::table('sys_documents')->where('entity_type', 'fin_invoices')->where('entity_id', $invoice->id)->where('doc_type', $docType)->max('version') + 1;

        return (string) DB::table('sys_documents')->insertGetId([
            'doc_type' => $docType,
            'entity_type' => 'fin_invoices',
            'entity_id' => $invoice->id,
            'version' => $version,
            'storage_disk' => $disk,
            'storage_path' => $path,
            'file_name' => $this->fileName($invoice, $kind),
            'mime_type' => self::MIME,
            'size_bytes' => strlen($content),
            'sha256' => hash('sha256', $content),
            'generated_by_job' => 'SendInvoiceToFiscalProvider',
        ], 'id');
    }

    private function fileName(object $invoice, string $kind): string
    {
        $ruc = preg_replace('/\D/', '', (string) $this->context->tenant()->ruc) ?: 'RUC';
        $base = "{$ruc}-{$invoice->doc_type}-{$invoice->series}-".str_pad((string) $invoice->correlative, 8, '0', STR_PAD_LEFT);

        return ($kind === 'cdr' ? 'R-' : '').$base.'.xml';
    }
}
