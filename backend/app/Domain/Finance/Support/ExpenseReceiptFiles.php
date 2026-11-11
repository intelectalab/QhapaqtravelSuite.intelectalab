<?php

declare(strict_types=1);

namespace App\Domain\Finance\Support;

use App\Domain\Integrations\Support\AttachmentGuard;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Tenancy\TenantContext;
use Illuminate\Filesystem\FilesystemAdapter;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\StreamedResponse;

final class ExpenseReceiptFiles
{
    public const MAX_KB = 10240;

    public const MIME = ['application/pdf' => 'pdf', 'image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];

    public function __construct(private readonly AttachmentGuard $guard, private readonly TenantContext $context) {}

    public function scan(UploadedFile $file, string $accountCode): void
    {
        if (! isset(self::MIME[(string) $file->getMimeType()])) {
            throw ApiException::unprocessable('TES-BR-12', 'El comprobante debe ser PDF, JPG, PNG o WEBP.');
        }

        $this->guard->ensureCleanFile((string) $file->getRealPath(), Str::limit($file->getClientOriginalName() ?: 'comprobante', 120, ''), 'Gasto de caja chica', $accountCode);
    }

    public function store(UploadedFile $file, string $movementCode): string
    {
        $path = "tenants/{$this->context->idOrFail()}/finance/receipts/{$movementCode}-".Str::lower((string) Str::ulid()).'.'.self::MIME[(string) $file->getMimeType()];

        if ($this->disk()->putFileAs(dirname($path), $file, basename($path)) === false) {
            throw ApiException::conflict('TES-BR-12', 'No pudimos guardar el comprobante. Inténtalo de nuevo en unos segundos.');
        }

        return $path;
    }

    public function discard(?string $path): void
    {
        if ($path !== null) {
            $this->disk()->delete($path);
        }
    }

    public function download(string $movementCode): StreamedResponse
    {
        $receipt = DB::table('fin_expense_receipts as r')->join('fin_treasury_movements as m', 'm.id', '=', 'r.movement_id')->where('m.code', $movementCode)->first(['r.file_path', 'r.series_number']);

        if ($receipt === null || $receipt->file_path === null || ! $this->disk()->exists($receipt->file_path)) {
            throw ApiException::notFound('Este gasto no tiene un comprobante adjunto.');
        }

        $extension = pathinfo((string) $receipt->file_path, PATHINFO_EXTENSION);
        $mime = array_search($extension, self::MIME, true) ?: 'application/octet-stream';

        return $this->disk()->download($receipt->file_path, "comprobante-{$movementCode}.{$extension}", ['Content-Type' => $mime, 'Cache-Control' => 'private, no-store']);
    }

    private function disk(): FilesystemAdapter
    {
        return Storage::disk((string) config('filesystems.default'));
    }
}
