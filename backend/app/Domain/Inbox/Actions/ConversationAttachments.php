<?php

declare(strict_types=1);

namespace App\Domain\Inbox\Actions;

use App\Domain\Iam\Models\User;
use App\Domain\Integrations\Support\AttachmentGuard;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Tenancy\TenantContext;
use Illuminate\Filesystem\FilesystemAdapter;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

final class ConversationAttachments
{
    public const MAX_BYTES = 16 * 1024 * 1024;

    public const MAX_FILES = 5;

    public const MIME = [
        'image/jpeg' => 'jpg',
        'image/png' => 'png',
        'image/webp' => 'webp',
        'application/pdf' => 'pdf',
    ];

    private const TTL_MINUTES = 30;

    public function __construct(private readonly AttachmentGuard $guard, private readonly TenantContext $context) {}

    public function upload(UploadedFile $file, User $actor): array
    {
        $mime = $this->mime((string) $file->getMimeType());
        $size = (int) $file->getSize();
        $this->size($size);
        $name = Str::limit($file->getClientOriginalName() ?: 'adjunto', 200, '');
        $this->guard->ensureCleanFile((string) $file->getRealPath(), $name, 'Conversación', 'adjunto');
        $tenantId = $this->context->idOrFail();
        $uploadId = (string) Str::uuid7();
        $path = $this->path($tenantId, $uploadId, $mime);

        if ($this->disk()->putFileAs(dirname($path), $file, basename($path)) === false) {
            throw ApiException::conflict('INB-BR-11', 'No pudimos guardar el archivo. Inténtalo de nuevo en unos segundos.');
        }

        $this->remember($tenantId, $uploadId, $actor, $path, $name, $mime, $size, (string) hash_file('sha256', (string) $file->getRealPath()), true);

        return ['upload_id' => $uploadId, 'file_name' => $name, 'mime' => $mime, 'size' => $size];
    }

    public function presign(array $data, User $actor): array
    {
        $mime = $this->mime((string) $data['mime']);
        $size = (int) $data['size'];
        $this->size($size);
        $disk = $this->disk();

        if (! $disk->providesTemporaryUploadUrls()) {
            throw ApiException::conflict('INB-BR-11', 'El almacenamiento no admite cargas prefirmadas. Adjunta el archivo desde la bandeja.');
        }

        $tenantId = $this->context->idOrFail();
        $uploadId = (string) Str::uuid7();
        $path = $this->path($tenantId, $uploadId, $mime);
        $expires = now()->addMinutes(self::TTL_MINUTES);
        $signed = $disk->temporaryUploadUrl($path, $expires, ['ContentType' => $mime]);
        $this->remember($tenantId, $uploadId, $actor, $path, Str::limit((string) $data['file_name'], 200, ''), $mime, $size, Str::lower((string) $data['sha256']), false);

        return [
            'upload_id' => $uploadId,
            'method' => 'PUT',
            'url' => $signed['url'],
            'headers' => ['Content-Type' => $mime, ...($signed['headers'] ?? [])],
            'expires_at' => $expires->toIso8601String(),
        ];
    }

    public function claim(array $uploadIds, User $actor, string $conversationCode): array
    {
        $tenantId = $this->context->idOrFail();

        return array_map(function (string $uploadId) use ($tenantId, $actor, $conversationCode): array {
            $pending = Cache::get($this->key($tenantId, $uploadId));

            if (! is_array($pending) || $pending['user_id'] !== $actor->getKey()) {
                throw ApiException::unprocessable('INB-BR-11', 'Un adjunto ya no está disponible. Vuelve a adjuntarlo.');
            }

            if (! $pending['scanned']) {
                $disk = $this->disk();

                if (! $disk->exists($pending['path']) || $disk->size($pending['path']) !== $pending['size']) {
                    throw ApiException::unprocessable('INB-BR-11', "El archivo {$pending['file_name']} todavía no se terminó de subir.");
                }

                try {
                    $this->guard->ensureClean((string) $disk->get($pending['path']), (string) $pending['file_name'], 'Conversación', $conversationCode);
                } catch (ApiException $blocked) {
                    if ($blocked->ruleCode === 'FILE_INFECTED') {
                        $disk->delete($pending['path']);
                        Cache::forget($this->key($tenantId, $uploadId));
                    }

                    throw $blocked;
                }
            }

            return [...$pending, 'upload_id' => $uploadId];
        }, array_values(array_unique($uploadIds)));
    }

    public function release(array $claimed): void
    {
        $tenantId = $this->context->idOrFail();

        foreach ($claimed as $file) {
            Cache::forget($this->key($tenantId, (string) $file['upload_id']));
        }
    }

    private function remember(string $tenantId, string $uploadId, User $actor, string $path, string $name, string $mime, int $size, string $sha256, bool $scanned): void
    {
        Cache::put($this->key($tenantId, $uploadId), [
            'user_id' => $actor->getKey(),
            'path' => $path,
            'file_name' => $name,
            'mime' => $mime,
            'size' => $size,
            'sha256' => $sha256,
            'scanned' => $scanned,
        ], now()->addMinutes(self::TTL_MINUTES));
    }

    private function mime(string $mime): string
    {
        if (! isset(self::MIME[$mime])) {
            throw ApiException::unprocessable('INB-BR-11', 'Solo puedes adjuntar imágenes (JPG, PNG, WebP) o PDF.');
        }

        return $mime;
    }

    private function size(int $size): void
    {
        if ($size <= 0 || $size > self::MAX_BYTES) {
            throw ApiException::unprocessable('INB-BR-11', 'Cada adjunto puede pesar hasta 16 MB.');
        }
    }

    private function path(string $tenantId, string $id, string $mime): string
    {
        return "tenants/{$tenantId}/inbox/{$id}.".self::MIME[$mime];
    }

    private function key(string $tenantId, string $uploadId): string
    {
        return "inbox:attachment-upload:{$tenantId}:{$uploadId}";
    }

    private function disk(): FilesystemAdapter
    {
        return Storage::disk((string) config('filesystems.default'));
    }
}
