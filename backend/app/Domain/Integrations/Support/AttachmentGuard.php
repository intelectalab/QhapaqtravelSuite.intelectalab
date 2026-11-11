<?php

declare(strict_types=1);

namespace App\Domain\Integrations\Support;

use App\Domain\Integrations\Contracts\MalwareScanner;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Support\Facades\Log;

final class AttachmentGuard
{
    public function __construct(
        private readonly MalwareScanner $scanner,
        private readonly AuditLogger $audit,
    ) {}

    public function ensureClean(string $contents, string $fileName, string $entity, string $entityId): void
    {
        $result = $this->scanner->scan($contents);

        if ($result->ok) {
            return;
        }

        if ($result->status === MalwareScanner::INFECTED) {
            $this->audit->logOutsideTransaction($entity, $entityId, 'archivo_bloqueado', null, mb_substr($fileName, 0, 120).' · '.$result->message);

            throw ApiException::unprocessable('FILE_INFECTED', "El archivo {$fileName} no pasó la revisión de seguridad y no se guardó.");
        }

        Log::warning('antivirus.unavailable', ['entity' => $entity, 'reason' => $result->message]);

        throw ApiException::conflict('FILE_SCAN_UNAVAILABLE', 'No pudimos revisar el archivo en este momento. Inténtalo de nuevo en unos minutos.');
    }

    public function ensureCleanFile(string $path, string $fileName, string $entity, string $entityId): void
    {
        $contents = @file_get_contents($path);

        if ($contents === false) {
            throw ApiException::unprocessable('FILE_UNREADABLE', "No pudimos leer el archivo {$fileName}. Vuelve a subirlo.");
        }

        $this->ensureClean($contents, $fileName, $entity, $entityId);
    }
}
