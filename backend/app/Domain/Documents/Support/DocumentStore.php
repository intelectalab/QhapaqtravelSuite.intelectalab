<?php

declare(strict_types=1);

namespace App\Domain\Documents\Support;

use App\Domain\Iam\Models\User;
use App\Domain\Shared\Tenancy\TenantContext;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use RuntimeException;
use Symfony\Component\HttpFoundation\HeaderUtils;

final class DocumentStore
{
    public const MIME = 'application/pdf';

    public const URL_MINUTES = 10;

    public function __construct(private readonly PdfRenderer $renderer, private readonly TenantContext $context) {}

    public function path(DocumentDraft $draft): string
    {
        return "tenants/{$this->context->idOrFail()}/documents/{$draft->docType}/{$draft->entityId}-{$draft->fingerprint()}.pdf";
    }

    public function current(DocumentDraft $draft): ?StoredDocument
    {
        $row = $this->row($draft, $this->path($draft));

        return $row !== null && Storage::disk((string) $row->storage_disk)->exists((string) $row->storage_path) ? StoredDocument::fromRow($row, false) : null;
    }

    public function store(DocumentDraft $draft, ?string $job = null): StoredDocument
    {
        $path = $this->path($draft);

        return DB::transaction(function () use ($draft, $path, $job): StoredDocument {
            DB::select('select pg_advisory_xact_lock(hashtext(?))', ["sys_documents:{$path}"]);
            $existing = $this->row($draft, $path);

            if ($existing !== null && Storage::disk((string) $existing->storage_disk)->exists($path)) {
                return StoredDocument::fromRow($existing, false);
            }

            $disk = (string) config('filesystems.default');
            $bytes = $this->renderer->render($draft);

            if (! Storage::disk($disk)->put($path, $bytes)) {
                throw new RuntimeException("No se pudo guardar el documento {$path}.");
            }

            $values = [
                'storage_disk' => $disk,
                'file_name' => $draft->fileName,
                'mime_type' => self::MIME,
                'size_bytes' => strlen($bytes),
                'sha256' => hash('sha256', $bytes),
                'generated_by_job' => $job === null ? null : class_basename($job),
            ];

            if ($existing !== null) {
                DB::table('sys_documents')->where('id', $existing->id)->update($values);
                $id = (string) $existing->id;
            } else {
                $user = Auth::user();
                $id = (string) DB::table('sys_documents')->insertGetId([
                    ...$values,
                    'doc_type' => $draft->docType,
                    'entity_type' => $draft->entityType,
                    'entity_id' => $draft->entityId,
                    'version' => (int) DB::table('sys_documents')->where('entity_type', $draft->entityType)->where('entity_id', $draft->entityId)->where('doc_type', $draft->docType)->max('version') + 1,
                    'storage_path' => $path,
                    'created_by' => $user instanceof User ? $user->getKey() : null,
                ], 'id');
            }

            return StoredDocument::fromRow(DB::table('sys_documents')->where('id', $id)->first(), true);
        });
    }

    public function respond(StoredDocument $document, Request $request): Response|JsonResponse
    {
        if ($request->prefers(['application/json', self::MIME]) === self::MIME) {
            return new Response((string) Storage::disk($document->disk)->get($document->path), 200, [
                'Content-Type' => self::MIME,
                'Content-Disposition' => $this->disposition($document->fileName),
                'Content-Length' => (string) $document->size,
                'Cache-Control' => 'private, no-store',
                'X-Content-Type-Options' => 'nosniff',
            ]);
        }

        $expires = CarbonImmutable::now()->addMinutes(self::URL_MINUTES);

        return new JsonResponse(['data' => [
            'document_id' => $document->id,
            'file_name' => $document->fileName,
            'mime_type' => self::MIME,
            'size_bytes' => $document->size,
            'sha256' => $document->sha256,
            'version' => $document->version,
            'generated_at' => CarbonImmutable::parse($document->createdAt)->toIso8601String(),
            'url' => $this->temporaryUrl($document, $expires),
            'expires_at' => $expires->toIso8601String(),
        ]]);
    }

    public function disposition(string $fileName): string
    {
        return HeaderUtils::makeDisposition(HeaderUtils::DISPOSITION_ATTACHMENT, $fileName, Str::ascii($fileName));
    }

    private function temporaryUrl(StoredDocument $document, CarbonImmutable $expires): ?string
    {
        try {
            return Storage::disk($document->disk)->temporaryUrl($document->path, $expires, [
                'ResponseContentType' => self::MIME,
                'ResponseContentDisposition' => $this->disposition($document->fileName),
            ]);
        } catch (RuntimeException) {
            return null;
        }
    }

    private function row(DocumentDraft $draft, string $path): ?object
    {
        return DB::table('sys_documents')
            ->where('entity_type', $draft->entityType)
            ->where('entity_id', $draft->entityId)
            ->where('doc_type', $draft->docType)
            ->where('storage_path', $path)
            ->first();
    }
}
