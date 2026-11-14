<?php

declare(strict_types=1);

namespace App\Domain\Site\Support;

use App\Domain\Admin\Support\StaffNotices;
use App\Domain\Crm\Support\Advisors;
use App\Domain\Integrations\Support\AttachmentGuard;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Tenancy\TenantContext;
use App\Domain\Shared\Time\BusinessHours;
use Carbon\CarbonImmutable;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use stdClass;
use Symfony\Component\HttpFoundation\StreamedResponse;

final class TransferProofs
{
    public const DOC_TYPE = 'transfer_proof';

    public const ENTITY = 'fin_payments';

    public const MAX_BYTES = 10 * 1024 * 1024;

    public const MIME = ['application/pdf' => 'pdf', 'image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];

    public const FINANCE = ['finance'];

    public const EVENT_RECEIVED = 'transferencia.constancia';

    public const EVENT_REMINDER = 'transferencia.recordatorio';

    public const EVENT_ESCALATED = 'transferencia.escalada';

    public const EVENT_UNVALIDATED = 'transferencia.sin_validar';

    public function __construct(
        private readonly AttachmentGuard $guard,
        private readonly TenantContext $context,
        private readonly StaffNotices $notices,
        private readonly BusinessHours $hours,
        private readonly TransferSettings $settings,
    ) {}

    public function pendingForOrder(string $orderId): Collection
    {
        return DB::table('fin_payments')->whereIn('reservation_id', DB::table('booking_reservations')->where('ecom_order_id', $orderId)->select('id'))
            ->where('kind', 'cobro')->where('status', 'pendiente')->orderBy('created_at')->get(['id', 'code', 'reservation_id', 'amount', 'currency', 'created_at']);
    }

    public function store(UploadedFile $file, Collection $payments, string $entity, string $entityId, ?string $userId = null): array
    {
        if ($payments->isEmpty()) {
            throw ApiException::conflict('SIT-PROOF-02', 'No hay un pago por validar al que adjuntar la constancia.');
        }

        $mime = (string) $file->getMimeType();

        if (! isset(self::MIME[$mime])) {
            throw ApiException::unprocessable('SIT-PROOF-01', 'Sube la constancia como foto (JPG, PNG o WEBP) o en PDF.', ['field' => 'file']);
        }

        if ((int) $file->getSize() > self::MAX_BYTES) {
            throw ApiException::unprocessable('SIT-PROOF-01', 'La constancia pesa más de 10 MB.', ['field' => 'file']);
        }

        $name = Str::limit($file->getClientOriginalName() ?: 'constancia.'.self::MIME[$mime], 200, '');
        $this->guard->ensureCleanFile((string) $file->getRealPath(), $name, $entity, $entityId);
        $disk = (string) config('filesystems.default');
        $path = "tenants/{$this->context->idOrFail()}/transfer-proofs/".Str::lower((string) Str::ulid()).'.'.self::MIME[$mime];

        if (Storage::disk($disk)->putFileAs(dirname($path), $file, basename($path)) === false) {
            throw ApiException::conflict('SIT-PROOF-03', 'No pudimos guardar la constancia. Inténtalo de nuevo en unos segundos.');
        }

        $sha = (string) hash_file('sha256', (string) $file->getRealPath());

        foreach ($payments as $payment) {
            DB::table('sys_documents')->insert([
                'id' => (string) Str::uuid7(),
                'doc_type' => self::DOC_TYPE,
                'entity_type' => self::ENTITY,
                'entity_id' => $payment->id,
                'version' => (int) DB::table('sys_documents')->where('entity_type', self::ENTITY)->where('entity_id', $payment->id)->where('doc_type', self::DOC_TYPE)->max('version') + 1,
                'storage_disk' => $disk,
                'storage_path' => $path,
                'file_name' => $name,
                'mime_type' => $mime,
                'size_bytes' => (int) $file->getSize(),
                'sha256' => $sha,
                'created_by' => $userId,
                'created_at' => now(),
            ]);
        }

        return ['file_name' => $name, 'uploaded_at' => now()->toIso8601String()];
    }

    public function notifyReceived(string $sourceType, string $sourceId, string $label, string $amount, string $currency): void
    {
        $subject = "Constancia de transferencia recibida · {$label}";
        $body = "El cliente subió la constancia de {$currency} {$amount}. Valídala en Finanzas › Pagos; el plazo corre en horas hábiles.";
        $this->notices->toRoles(self::FINANCE, self::EVENT_RECEIVED, $subject, $body, $sourceType, $sourceId);
        $this->emailRoles(self::FINANCE, self::EVENT_RECEIVED, $subject, $body, $sourceType, $sourceId);
    }

    public function emailRoles(array $roles, string $event, string $subject, string $body, string $sourceType, string $sourceId): void
    {
        foreach (app(Advisors::class)->all($roles) as $user) {
            $this->notices->emailUser((string) $user['id'], $event, $subject, $body."\n\n".$this->notices->agency(), $sourceType, $sourceId);
        }
    }

    public function latest(array $paymentIds): Collection
    {
        if ($paymentIds === []) {
            return collect();
        }

        return DB::table('sys_documents')->where('doc_type', self::DOC_TYPE)->where('entity_type', self::ENTITY)->whereIn('entity_id', $paymentIds)
            ->orderBy('created_at')->get(['entity_id', 'file_name', 'created_at'])
            ->groupBy('entity_id')
            ->map(fn (Collection $rows): array => ['first_at' => (string) $rows->first()->created_at, 'last_at' => (string) $rows->last()->created_at, 'file_name' => (string) $rows->last()->file_name, 'count' => $rows->count()]);
    }

    public function stage(string $uploadedAt, ?CarbonImmutable $now = null): array
    {
        $settings = $this->settings->read();
        $minutes = $this->hours->minutesBetween(CarbonImmutable::parse($uploadedAt), $now ?? CarbonImmutable::now());
        $escalateAt = $settings['reminder_minutes'] + $settings['escalate_minutes'];

        return [
            'business_minutes' => $minutes,
            'stage' => match (true) {
                $minutes >= $escalateAt => 'escalada',
                $minutes >= $settings['reminder_minutes'] => 'recordada',
                default => 'recibida',
            },
            'escalated' => $minutes >= $escalateAt,
        ];
    }

    public function forOrder(stdClass $order): ?array
    {
        $payments = $this->pendingForOrder((string) $order->id);
        $proofs = $this->latest($payments->pluck('id')->map(fn (mixed $id): string => (string) $id)->all());

        if ($proofs->isEmpty()) {
            return null;
        }

        return ['uploaded_at' => CarbonImmutable::parse((string) $proofs->min('last_at'))->toIso8601String(), 'file_name' => (string) $proofs->first()['file_name'], 'count' => (int) $proofs->max('count')];
    }

    public function orderHasProof(string $orderId): bool
    {
        return DB::table('sys_documents')->where('doc_type', self::DOC_TYPE)->where('entity_type', self::ENTITY)
            ->whereIn('entity_id', DB::table('fin_payments')->where('status', 'pendiente')->whereIn('reservation_id', DB::table('booking_reservations')->where('ecom_order_id', $orderId)->select('id'))->select('id'))
            ->exists();
    }

    public function download(string $paymentCode): StreamedResponse
    {
        $document = DB::table('sys_documents as d')->join('fin_payments as p', 'p.id', '=', 'd.entity_id')
            ->where('d.doc_type', self::DOC_TYPE)->where('d.entity_type', self::ENTITY)->where('p.code', $paymentCode)
            ->orderByDesc('d.created_at')->first(['d.storage_disk', 'd.storage_path', 'd.file_name', 'd.mime_type']);

        if ($document === null || ! Storage::disk((string) $document->storage_disk)->exists((string) $document->storage_path)) {
            throw ApiException::notFound('Este pago no tiene una constancia adjunta.');
        }

        return Storage::disk((string) $document->storage_disk)->download((string) $document->storage_path, (string) $document->file_name, ['Content-Type' => (string) $document->mime_type, 'Cache-Control' => 'private, no-store']);
    }
}
