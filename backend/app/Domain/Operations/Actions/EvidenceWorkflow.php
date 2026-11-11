<?php

declare(strict_types=1);

namespace App\Domain\Operations\Actions;

use App\Domain\Iam\Models\User;
use App\Domain\Integrations\Support\AttachmentGuard;
use App\Domain\Operations\Support\EvidenceStore;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Tenancy\TenantContext;
use Illuminate\Database\QueryException;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\StreamedResponse;

final class EvidenceWorkflow
{
    public function __construct(private readonly AuditLogger $audit, private readonly TenantContext $context, private readonly AttachmentGuard $guard) {}

    public function presign(array $data, User $actor): array
    {
        $mime = $this->allowedMime((string) $data['mime']);
        $size = (int) $data['size'];
        $this->ensureSize($size);
        $disk = EvidenceStore::disk();

        if (! $disk->providesTemporaryUploadUrls()) {
            throw ApiException::conflict('OPS-BR-70', 'El almacenamiento no admite cargas prefirmadas. Sube el archivo desde la ficha de la orden.');
        }

        $tenantId = $this->context->idOrFail();
        $uploadId = (string) Str::uuid7();
        $path = EvidenceStore::path($tenantId, $uploadId, $mime);
        $expires = now()->addMinutes(EvidenceStore::UPLOAD_TTL_MINUTES);
        $signed = $disk->temporaryUploadUrl($path, $expires, ['ContentType' => $mime]);
        Cache::put(EvidenceStore::uploadKey($tenantId, $uploadId), [
            'user_id' => $actor->getKey(),
            'path' => $path,
            'file_name' => Str::limit((string) $data['file_name'], 200, ''),
            'mime' => $mime,
            'size' => $size,
            'sha256' => Str::lower((string) $data['sha256']),
        ], $expires);

        return [
            'upload_id' => $uploadId,
            'method' => 'PUT',
            'url' => $signed['url'],
            'headers' => ['Content-Type' => $mime, ...($signed['headers'] ?? [])],
            'expires_at' => $expires->toIso8601String(),
        ];
    }

    public function registerForOrder(string $code, ?string $service, array $uploads, string $source, User $actor): array
    {
        $order = $this->openOrder($code);
        $serviceId = $this->service($order, $service);

        return DB::transaction(fn (): array => array_map(fn (array $upload): array => $this->fromUpload($upload, ['order_id' => $order->id, 'reservation_service_id' => $serviceId, 'incident_id' => null], $source, $actor, $order->code), $uploads));
    }

    public function registerForIncident(string $code, array $uploads, string $source, User $actor): array
    {
        $incident = $this->openIncident($code);

        return DB::transaction(fn (): array => array_map(fn (array $upload): array => $this->fromUpload($upload, ['order_id' => $incident->order_id, 'reservation_service_id' => null, 'incident_id' => $incident->id], $source, $actor, $incident->code, $incident->id), $uploads));
    }

    public function uploadForOrder(string $code, UploadedFile $file, ?string $service, User $actor): array
    {
        $order = $this->openOrder($code);

        return $this->fromFile($file, ['order_id' => $order->id, 'reservation_service_id' => $this->service($order, $service), 'incident_id' => null], $actor, $order->code);
    }

    public function uploadForIncident(string $code, UploadedFile $file, User $actor): array
    {
        $incident = $this->openIncident($code);

        return $this->fromFile($file, ['order_id' => $incident->order_id, 'reservation_service_id' => null, 'incident_id' => $incident->id], $actor, $incident->code, $incident->id);
    }

    public function remove(string $id, string $reason, User $actor): void
    {
        $evidence = $this->evidence($id);

        if ($evidence->order_status !== null && in_array($evidence->order_status, ['completada', 'cancelada'], true)) {
            throw ApiException::conflict('OPS-BR-05', 'La orden ya está cerrada: sus evidencias quedan como respaldo del cierre.');
        }

        DB::table('ops_evidences')->where('id', $evidence->id)->update(['removed_at' => now(), 'removed_by' => $actor->getKey(), 'removed_reason' => $reason, 'updated_by' => $actor->getKey(), 'updated_at' => now()]);

        if ($evidence->incident_id !== null) {
            $this->incidentLog($evidence->incident_id, $actor, "Evidencia retirada: {$evidence->file_name}. Motivo: {$reason}");
        }

        $this->audit->log('Evidencia', $evidence->order_code ?? $evidence->incident_code ?? $evidence->id, 'retirar_evidencia', $evidence->file_name, $reason);
    }

    public function file(string $id): StreamedResponse
    {
        $evidence = $this->evidence($id);
        $disk = EvidenceStore::disk();

        if (! $disk->exists($evidence->storage_path)) {
            throw ApiException::notFound('El archivo de la evidencia no está disponible.');
        }

        return response()->stream(function () use ($disk, $evidence): void {
            $stream = $disk->readStream($evidence->storage_path);

            if (is_resource($stream)) {
                fpassthru($stream);
                fclose($stream);
            }
        }, 200, [
            'Content-Type' => $evidence->mime_type,
            'Content-Length' => (string) $evidence->size_bytes,
            'Content-Disposition' => 'inline; filename="'.addcslashes($evidence->file_name, '"\\').'"',
            'Cache-Control' => 'private, max-age=300',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }

    private function fromUpload(array $upload, array $owner, string $source, User $actor, string $entityCode, ?string $incidentId = null): array
    {
        $tenantId = $this->context->idOrFail();
        $key = EvidenceStore::uploadKey($tenantId, (string) $upload['upload_id']);
        $pending = Cache::get($key);

        if (! is_array($pending) || $pending['user_id'] !== $actor->getKey()) {
            throw ApiException::unprocessable('OPS-BR-70', 'La carga no existe o venció. Vuelve a subir el archivo.');
        }

        if (isset($upload['sha256']) && Str::lower((string) $upload['sha256']) !== $pending['sha256']) {
            throw ApiException::unprocessable('OPS-BR-71', 'La huella del archivo no coincide con la carga solicitada.');
        }

        $disk = EvidenceStore::disk();

        if (! $disk->exists($pending['path']) || $disk->size($pending['path']) !== $pending['size']) {
            throw ApiException::unprocessable('OPS-BR-70', "El archivo {$pending['file_name']} todavía no se terminó de subir.");
        }

        try {
            $this->guard->ensureClean((string) $disk->get($pending['path']), (string) $pending['file_name'], 'Evidencia', $entityCode);
        } catch (ApiException $blocked) {
            if ($blocked->ruleCode === 'FILE_INFECTED') {
                $disk->delete($pending['path']);
                Cache::forget($key);
            }

            throw $blocked;
        }

        $evidence = $this->insert($owner, $pending['path'], $pending['file_name'], $pending['mime'], $pending['size'], $pending['sha256'], $source, $actor, $entityCode, $incidentId);
        Cache::forget($key);

        return $evidence;
    }

    private function fromFile(UploadedFile $file, array $owner, User $actor, string $entityCode, ?string $incidentId = null): array
    {
        $mime = $this->allowedMime((string) $file->getMimeType());
        $size = (int) $file->getSize();
        $this->ensureSize($size);
        $sha256 = (string) hash_file('sha256', (string) $file->getRealPath());
        $this->ensureUnique($owner, $sha256);
        $id = (string) Str::uuid7();
        $path = EvidenceStore::path($this->context->idOrFail(), $id, $mime);
        $disk = EvidenceStore::disk();
        $name = Str::limit($file->getClientOriginalName() ?: basename($path), 200, '');
        $this->guard->ensureCleanFile((string) $file->getRealPath(), $name, 'Evidencia', $entityCode);

        if ($disk->putFileAs(dirname($path), $file, basename($path)) === false) {
            throw ApiException::conflict('OPS-BR-70', 'No pudimos guardar el archivo. Inténtalo de nuevo en unos segundos.');
        }

        try {
            return DB::transaction(fn (): array => $this->insert($owner, $path, $name, $mime, $size, $sha256, 'web', $actor, $entityCode, $incidentId, $id));
        } catch (\Throwable $exception) {
            $disk->delete($path);

            throw $exception;
        }
    }

    private function insert(array $owner, string $path, string $name, string $mime, int $size, string $sha256, string $source, User $actor, string $entityCode, ?string $incidentId, ?string $id = null): array
    {
        $this->ensureUnique($owner, $sha256);
        $id ??= (string) Str::uuid7();

        try {
            DB::table('ops_evidences')->insert([
                'id' => $id,
                ...$owner,
                'file_name' => $name,
                'storage_path' => $path,
                'mime_type' => $mime,
                'size_bytes' => $size,
                'sha256' => $sha256,
                'source' => $source,
                'captured_at' => now(),
                'captured_offline' => false,
                'uploaded_by' => $actor->getKey(),
                'created_by' => $actor->getKey(),
            ]);
        } catch (QueryException $exception) {
            if ($exception->getCode() === '23505') {
                throw $this->duplicate();
            }

            throw $exception;
        }

        if ($incidentId !== null) {
            $this->incidentLog($incidentId, $actor, "Evidencia adjunta: {$name}");
        }

        $this->audit->log('Evidencia', $entityCode, 'registrar_evidencia', null, $name, evidence: ['sha256' => $sha256, 'size' => $size, 'mime' => $mime, 'source' => $source]);

        return ['id' => $id, 'name' => $name, 'mime' => $mime, 'size' => $size, 'source' => $source, 'sha256' => $sha256];
    }

    private function ensureUnique(array $owner, string $sha256): void
    {
        $query = DB::table('ops_evidences')->whereNull('removed_at')->where('sha256', $sha256);
        $owner['order_id'] !== null ? $query->where('order_id', $owner['order_id']) : $query->where('incident_id', $owner['incident_id']);

        if ($query->exists()) {
            throw $this->duplicate();
        }
    }

    private function duplicate(): ApiException
    {
        return ApiException::conflict('OPS-BR-71', 'Ese archivo ya está registrado como evidencia de esta orden.');
    }

    private function allowedMime(string $mime): string
    {
        $mime = Str::lower($mime);

        if (! array_key_exists($mime, EvidenceStore::MIME)) {
            throw ApiException::unprocessable('OPS-BR-70', 'La evidencia debe ser una imagen (JPG, PNG, WEBP o HEIC) o un PDF.');
        }

        return $mime;
    }

    private function ensureSize(int $size): void
    {
        if ($size <= 0 || $size > EvidenceStore::MAX_BYTES) {
            throw ApiException::unprocessable('OPS-BR-70', 'La evidencia debe pesar como máximo 10 MB.');
        }
    }

    private function openOrder(string $code): object
    {
        $order = DB::table('ops_orders')->whereNull('deleted_at')->where('code', $code)->first(['id', 'code', 'status', 'reservation_id']) ?? throw ApiException::notFound('La orden operativa no existe.');

        if (in_array($order->status, ['completada', 'cancelada'], true)) {
            throw ApiException::conflict('OPS-BR-05', 'La orden ya está cerrada.');
        }

        return $order;
    }

    private function openIncident(string $code): object
    {
        $incident = DB::table('ops_incidents as i')->leftJoin('ops_orders as o', 'o.id', '=', 'i.order_id')->where('i.code', $code)
            ->first(['i.id', 'i.code', 'i.status', 'i.order_id', 'o.status as order_status']) ?? throw ApiException::notFound('La incidencia no existe.');

        if ($incident->status === 'cerrada') {
            throw ApiException::conflict('OPS-BR-05', 'La incidencia está cerrada. Reábrela para adjuntar evidencias.');
        }

        if (in_array($incident->order_status, ['completada', 'cancelada'], true)) {
            throw ApiException::conflict('OPS-BR-05', 'La orden de esta incidencia ya está cerrada.');
        }

        return $incident;
    }

    private function service(object $order, ?string $service): ?string
    {
        if ($service === null || $service === '') {
            return null;
        }

        $query = DB::table('booking_reservation_services')->where('reservation_id', $order->reservation_id);
        $query->where(Str::isUuid($service) ? 'id' : 'code', $service);

        return $query->value('id') ?? throw ApiException::unprocessable('VALIDATION_ERROR', 'El servicio no pertenece a esta orden.');
    }

    private function evidence(string $id): object
    {
        if (! Str::isUuid($id)) {
            throw ApiException::notFound('La evidencia no existe.');
        }

        return DB::table('ops_evidences as e')
            ->leftJoin('ops_orders as o', 'o.id', '=', 'e.order_id')
            ->leftJoin('ops_incidents as i', 'i.id', '=', 'e.incident_id')
            ->where('e.id', $id)->whereNull('e.removed_at')
            ->first(['e.id', 'e.file_name', 'e.storage_path', 'e.mime_type', 'e.size_bytes', 'e.incident_id', 'o.code as order_code', 'o.status as order_status', 'i.code as incident_code'])
            ?? throw ApiException::notFound('La evidencia no existe.');
    }

    private function incidentLog(string $incidentId, User $actor, string $message): void
    {
        DB::table('ops_incident_logs')->insert(['incident_id' => $incidentId, 'user_id' => $actor->getKey(), 'kind' => 'evidencia', 'message' => $message, 'visibility' => 'interna', 'created_by' => $actor->getKey()]);
    }
}
