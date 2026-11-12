<?php

declare(strict_types=1);

namespace App\Domain\Operations\Actions;

use App\Domain\Admin\Support\EmailNotifications;
use App\Domain\Admin\Support\StaffNotices;
use App\Domain\Iam\Models\User;
use App\Domain\Integrations\Support\AttachmentGuard;
use App\Domain\Operations\Support\TravelDocDirectory;
use App\Domain\Operations\Support\TravelDocRules;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Tenancy\TenantContext;
use Carbon\CarbonImmutable;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

final class TravelDocWorkflow
{
    public const MIME = ['application/pdf' => 'pdf', 'image/jpeg' => 'jpg', 'image/png' => 'png'];

    public const MAX_BYTES = 10 * 1024 * 1024;

    public function __construct(private readonly AuditLogger $audit, private readonly TravelDocRules $rules, private readonly AttachmentGuard $guard, private readonly TenantContext $context) {}

    public function validate(string $reservation, string $passenger, string $type, array $data, User $actor): string
    {
        $item = $this->item($reservation, $passenger, $type);
        $this->assertFileType($item);

        if ($item->doc_type === 'id_doc' && blank($data['doc_number'] ?? $item->doc_number)) {
            throw ApiException::unprocessable('DOC-BR-001', 'Registra el número del documento antes de validarlo.');
        }

        if ($item->doc_type === 'minor_auth' && $item->file_id === null) {
            throw ApiException::unprocessable('DOC-BR-006', 'Carga la partida de nacimiento o el permiso notarial antes de validar.');
        }

        if ($item->file_id === null) {
            throw ApiException::unprocessable('DOC-BR-013', 'Carga el archivo del documento antes de validarlo.');
        }

        $expiry = $data['expiry_date'] ?? $item->expiry_date;

        if ($item->doc_type === 'id_doc' && blank($expiry)) {
            throw ApiException::unprocessable('DOC-BR-001', 'Registra la fecha de vencimiento del documento de identidad.');
        }

        if ($expiry !== null && $expiry < $item->travel_to) {
            throw ApiException::unprocessable('DOC-BR-002', 'El documento vence antes de que termine el viaje.');
        }

        if ($item->doc_type === 'id_doc' && $expiry !== null) {
            $minimum = $this->rules->minExpiry($item, (string) $item->travel_to, $this->rules->settings());

            if ($expiry < $minimum) {
                throw ApiException::unprocessable('DOC-BR-001', 'El pasaporte debe vencer después del '.CarbonImmutable::parse($minimum)->format('d/m/Y').'. Solicita un documento renovado.');
            }
        }

        DB::table('ops_travel_doc_items')->where('id', $item->id)->update([
            'status' => 'completo',
            'doc_number' => $data['doc_number'] ?? $item->doc_number,
            'expiry_date' => $expiry,
            'observation' => null,
            'validated_by' => $actor->getKey(),
            'validated_at' => now(),
            'lock_version' => DB::raw('lock_version + 1'),
            'updated_by' => $actor->getKey(),
            'updated_at' => now(),
        ]);
        $this->audit->log('Documento de viaje', "{$item->reservation_code} · {$item->full_name}", 'validar', $item->status, TravelDocDirectory::LABELS[$item->doc_type] ?? $item->doc_type);

        return (string) $item->id;
    }

    public function observe(string $reservation, string $passenger, string $type, string $reason, User $actor): string
    {
        $item = $this->item($reservation, $passenger, $type);
        $this->assertFileType($item);
        DB::table('ops_travel_doc_items')->where('id', $item->id)->update(['status' => 'observado', 'observation' => $reason, 'validated_by' => null, 'validated_at' => null, 'lock_version' => DB::raw('lock_version + 1'), 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
        $this->audit->log('Documento de viaje', "{$item->reservation_code} · {$item->full_name}", 'observar', $item->status, $reason);
        $client = DB::table('booking_reservations as r')->join('crm_clients as c', 'c.id', '=', 'r.client_id')->where('r.id', $item->reservation_id)->first(['c.id', 'c.name', 'c.email']);
        $label = TravelDocDirectory::LABELS[$item->doc_type] ?? $item->doc_type;
        $notices = app(StaffNotices::class);
        $notices->email($client?->email, 'documentos.observado', "Revisa un documento de tu viaje {$item->reservation_code} · ".$notices->agency(), "Hola, {$client?->name}:\n\nRevisamos el documento «{$label}» de {$item->full_name} y necesitamos que lo corrijas:\n{$reason}\n\nPuedes cargar el documento corregido desde tu portal.\n\n".$notices->agency(), 'ops_travel_doc', (string) $item->id, 'client', ['client_id' => $client?->id, 'reservation_id' => $item->reservation_id]);

        return (string) $item->id;
    }

    public function upload(string $reservation, string $passenger, string $type, UploadedFile $file, array $data, User $actor): array
    {
        $item = $this->item($reservation, $passenger, $type);
        $this->assertFileType($item);
        $mime = (string) $file->getMimeType();

        if (! isset(self::MIME[$mime])) {
            throw ApiException::unprocessable('DOC-BR-013', 'Sube el documento en PDF, JPG o PNG.');
        }

        if ((int) $file->getSize() > self::MAX_BYTES) {
            throw ApiException::unprocessable('DOC-BR-013', 'El archivo pesa más de 10 MB.');
        }

        $name = Str::limit($file->getClientOriginalName() ?: 'documento.'.self::MIME[$mime], 200, '');
        $this->guard->ensureCleanFile((string) $file->getRealPath(), $name, 'Documento de viaje', "{$item->reservation_code} · {$item->full_name}");
        $disk = (string) config('filesystems.default');
        $id = (string) Str::uuid7();
        $path = "tenants/{$this->context->idOrFail()}/travel-docs/{$id}.".self::MIME[$mime];

        if (Storage::disk($disk)->putFileAs(dirname($path), $file, basename($path)) === false) {
            throw ApiException::conflict('DOC-BR-013', 'No pudimos guardar el archivo. Inténtalo de nuevo en unos segundos.');
        }

        try {
            DB::transaction(function () use ($item, $file, $data, $actor, $disk, $id, $path, $mime, $name): void {
                DB::table('sys_documents')->insert([
                    'id' => $id,
                    'doc_type' => 'travel_doc',
                    'entity_type' => 'ops_travel_doc_items',
                    'entity_id' => $item->id,
                    'version' => (int) DB::table('sys_documents')->where('entity_type', 'ops_travel_doc_items')->where('entity_id', $item->id)->max('version') + 1,
                    'storage_disk' => $disk,
                    'storage_path' => $path,
                    'file_name' => $name,
                    'mime_type' => $mime,
                    'size_bytes' => (int) $file->getSize(),
                    'sha256' => (string) hash_file('sha256', (string) $file->getRealPath()),
                    'created_by' => $actor->getKey(),
                ]);
                DB::table('ops_travel_doc_items')->where('id', $item->id)->update([
                    'status' => 'recibido',
                    'file_id' => $id,
                    'file_name' => $name,
                    'uploaded_by_type' => 'user',
                    'doc_number' => filled($data['doc_number'] ?? null) ? $data['doc_number'] : $item->doc_number,
                    'expiry_date' => filled($data['expiry_date'] ?? null) ? $data['expiry_date'] : $item->expiry_date,
                    'note' => filled($data['note'] ?? null) ? $data['note'] : $item->note,
                    'observation' => null,
                    'validated_by' => null,
                    'validated_at' => null,
                    'lock_version' => DB::raw('lock_version + 1'),
                    'updated_by' => $actor->getKey(),
                    'updated_at' => now(),
                ]);
                $this->audit->log('Documento de viaje', "{$item->reservation_code} · {$item->full_name}", $item->file_id ? 'reemplazar_archivo' : 'cargar', $item->status, 'recibido · '.(TravelDocDirectory::LABELS[$item->doc_type] ?? $item->doc_type).' · '.$name);
            });
        } catch (\Throwable $exception) {
            Storage::disk($disk)->delete($path);

            throw $exception;
        }

        return ['id' => (string) $item->id, 'file' => $name];
    }

    public function file(string $reservation, string $passenger, string $type): object
    {
        $item = $this->item($reservation, $passenger, $type);

        return DB::table('sys_documents')->where('id', $item->file_id)->first() ?? throw ApiException::notFound('El documento todavía no tiene archivo.');
    }

    public function saveContact(string $reservation, string $passenger, array $data, User $actor): void
    {
        $person = $this->passenger($reservation, $passenger);
        $before = DB::table('ops_travel_doc_contacts')->where('passenger_id', $person->id)->first();
        $values = ['name' => trim((string) $data['name']), 'phone' => trim((string) $data['phone']), 'relation' => $data['relation'], 'updated_by' => $actor->getKey(), 'updated_at' => now()];

        $before
            ? DB::table('ops_travel_doc_contacts')->where('id', $before->id)->update($values)
            : DB::table('ops_travel_doc_contacts')->insert([...$values, 'passenger_id' => $person->id, 'created_by' => $actor->getKey()]);
        DB::table('ops_travel_doc_items')->where('passenger_id', $person->id)->where('doc_type', 'emergency')->update(['status' => 'completo', 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
        $this->audit->log('Documento de viaje', "{$person->reservation_code} · {$person->full_name}", 'registrar_contacto', $before ? $before->name : 'pendiente', "{$values['name']} ({$values['relation']})");
    }

    public function saveAttention(string $reservation, string $passenger, array $data, User $actor): void
    {
        $note = trim((string) ($data['operational_note'] ?? ''));

        if ($note !== '' && preg_match(TravelDocRules::CLINICAL, $note) === 1) {
            throw ApiException::unprocessable('DOC-BR-009', 'La nota contiene términos clínicos. Describe solo la necesidad operativa (dieta, movilidad, asiento, ritmo).');
        }

        $person = $this->passenger($reservation, $passenger);
        $before = DB::table('ops_travel_doc_special')->where('passenger_id', $person->id)->first();
        $values = ['requires_attention' => (bool) $data['requires_attention'], 'operational_note' => $note === '' ? null : $note, 'updated_by' => $actor->getKey(), 'updated_at' => now()];

        $before
            ? DB::table('ops_travel_doc_special')->where('id', $before->id)->update($values)
            : DB::table('ops_travel_doc_special')->insert([...$values, 'passenger_id' => $person->id, 'created_by' => $actor->getKey()]);
        DB::table('ops_travel_doc_items')->where('passenger_id', $person->id)->where('doc_type', 'special')->update(['status' => 'completo', 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
        $this->audit->log('Documento de viaje', "{$person->reservation_code} · {$person->full_name}", 'declarar_atencion', $before === null ? 'sin declarar' : ($before->requires_attention ? 'sí' : 'no'), $values['requires_attention'] ? 'sí' : 'no');
    }

    public function requestFromClient(string $reservation, array $data, User $actor, EmailNotifications $notifications): array
    {
        $row = DB::table('booking_reservations as r')->join('crm_clients as c', 'c.id', '=', 'r.client_id')->leftJoin('iam_users as u', 'u.id', '=', 'r.owner_id')->whereNull('r.deleted_at')->where('r.code', $reservation)
            ->first(['r.id', 'r.code', 'r.owner_id', 'r.client_id', 'r.travel_from', 'c.name', 'c.email', 'u.name as owner_name']) ?? throw ApiException::notFound('La reserva no existe.');

        if (! $actor->can('operations.travel_docs') && (string) $row->owner_id !== (string) $actor->getKey()) {
            throw ApiException::forbidden('DOC-BR-012', 'Solo el asesor de la reserva u Operaciones pueden solicitar documentos.');
        }

        $settings = $this->rules->settings();
        $channels = array_values(array_intersect($settings['channels'], $data['channels'] ?? $settings['channels'])) ?: $settings['channels'];
        $pending = (int) DB::table('ops_travel_doc_items')->where('reservation_id', $row->id)->whereIn('status', ['pendiente', 'observado'])->count();

        if ($pending === 0) {
            throw ApiException::unprocessable('DOC-BR-012', 'El checklist no tiene documentos pendientes por solicitar.');
        }

        if (blank($row->email)) {
            throw ApiException::unprocessable('DOC-BR-012', 'El cliente no tiene correo registrado. Complétalo en su ficha.');
        }

        if (! in_array('Email', $channels, true)) {
            throw ApiException::unprocessable('DOC-BR-012', 'WhatsApp todavía no tiene un proveedor de envío conectado. Incluye el correo para enviar la solicitud.');
        }

        $ids = [$notifications->queue('documentos.recordatorio', (string) $row->email, [
            'cliente' => (string) $row->name,
            'reserva' => (string) $row->code,
            'fecha_viaje' => CarbonImmutable::parse((string) $row->travel_from)->format('d/m/Y'),
            'enlace' => rtrim((string) config('app.frontend_url'), '/').'/portal',
            'vendedor' => (string) ($row->owner_name ?? ''),
        ], ['source_type' => 'booking_reservation', 'source_id' => $row->id, 'client_id' => $row->client_id, 'reservation_id' => $row->id])];

        DB::table('ops_travel_doc_reminders')->insert([
            'reservation_id' => $row->id,
            'sent_at' => now(),
            'channels' => 'Email',
            'recipient' => mb_substr((string) $row->email, 0, 190),
            'trigger' => 'manual',
            'items_count' => $pending,
            'sent_by' => $actor->getKey(),
            'notification_ids' => '{'.implode(',', array_filter($ids)).'}',
        ]);
        $this->audit->log('Documento de viaje', (string) $row->code, 'solicitar_documentos', null, "{$pending} ítems · Email");

        return ['items' => $pending, 'channels' => ['Email'], 'not_sent' => array_values(array_diff($channels, ['Email'])), 'recipient' => $row->email];
    }

    private function assertFileType(object $item): void
    {
        if (! in_array($item->doc_type, TravelDocDirectory::FILE_TYPES, true)) {
            throw ApiException::notFound('El documento no existe.');
        }
    }

    private function passenger(string $reservation, string $passenger): object
    {
        if (! Str::isUuid($passenger)) {
            throw ApiException::notFound('El pasajero no existe.');
        }

        return DB::table('booking_passengers as p')->join('booking_reservations as r', 'r.id', '=', 'p.reservation_id')->whereNull('r.deleted_at')->where('r.code', $reservation)->where('p.id', $passenger)
            ->first(['p.id', 'p.full_name', 'r.code as reservation_code']) ?? throw ApiException::notFound('El pasajero no existe.');
    }

    private function item(string $reservation, string $passenger, string $type): object
    {
        if (! Str::isUuid($passenger)) {
            throw ApiException::notFound('El documento no existe.');
        }

        return DB::table('ops_travel_doc_items as i')->join('booking_reservations as r', 'r.id', '=', 'i.reservation_id')->join('booking_passengers as p', 'p.id', '=', 'i.passenger_id')
            ->where('r.code', $reservation)->where('i.passenger_id', $passenger)->where('i.doc_type', $type)
            ->first(['i.*', 'r.code as reservation_code', 'r.travel_from', 'r.travel_to', 'p.full_name', 'p.nationality', 'p.pax_type', 'p.birth_date']) ?? throw ApiException::notFound('El documento no existe.');
    }
}
