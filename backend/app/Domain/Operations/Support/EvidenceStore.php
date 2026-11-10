<?php

declare(strict_types=1);

namespace App\Domain\Operations\Support;

use Illuminate\Filesystem\FilesystemAdapter;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

final class EvidenceStore
{
    public const MAX_BYTES = 10 * 1024 * 1024;

    public const MIME = [
        'image/jpeg' => 'jpg',
        'image/png' => 'png',
        'image/webp' => 'webp',
        'image/heic' => 'heic',
        'image/heif' => 'heif',
        'application/pdf' => 'pdf',
    ];

    public const UPLOAD_TTL_MINUTES = 30;

    public static function disk(): FilesystemAdapter
    {
        return Storage::disk(self::diskName());
    }

    public static function diskName(): string
    {
        return (string) config('filesystems.default');
    }

    public static function path(string $tenantId, string $id, string $mime): string
    {
        return "tenants/{$tenantId}/ops/evidences/{$id}.".self::MIME[$mime];
    }

    public static function uploadKey(string $tenantId, string $uploadId): string
    {
        return "ops:evidence-upload:{$tenantId}:{$uploadId}";
    }

    public function forOrder(string $orderId): Collection
    {
        $names = DB::table('iam_users')->pluck('name', 'id');

        return DB::table('ops_evidences as e')
            ->leftJoin('booking_reservation_services as s', 's.id', '=', 'e.reservation_service_id')
            ->leftJoin('ops_incidents as i', 'i.id', '=', 'e.incident_id')
            ->where('e.order_id', $orderId)->whereNull('e.removed_at')
            ->orderByDesc('e.captured_at')
            ->get(['e.id', 'e.file_name', 'e.mime_type', 'e.size_bytes', 'e.source', 'e.captured_at', 'e.uploaded_by', 's.code as service_code', 's.name as service_name', 'i.code as incident_code'])
            ->map(fn (object $file): array => [
                'id' => $file->id,
                'name' => $file->file_name,
                'mime' => $file->mime_type,
                'size' => (int) $file->size_bytes,
                'source' => $file->source,
                'at' => $file->captured_at,
                'by' => $names[$file->uploaded_by] ?? null,
                'service' => $file->service_code ? ['code' => $file->service_code, 'name' => $file->service_name] : null,
                'incident' => $file->incident_code,
            ])->values();
    }
}
