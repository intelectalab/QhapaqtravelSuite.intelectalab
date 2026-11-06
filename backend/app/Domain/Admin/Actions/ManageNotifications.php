<?php

declare(strict_types=1);

namespace App\Domain\Admin\Actions;

use App\Domain\Admin\Support\NotificationCatalog;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Support\Facades\DB;

final class ManageNotifications
{
    public function __construct(private readonly AuditLogger $audit) {}

    public function rule(string $event, array $data, User $actor): void
    {
        $catalog = NotificationCatalog::EVENTS[$event] ?? throw ApiException::notFound('El evento no existe.');
        $values = [
            'ch_email' => (bool) $data['email'],
            'ch_whatsapp' => (bool) $data['whatsapp'],
            'ch_push' => (bool) $data['push'],
            'ch_portal' => (bool) $data['portal'],
            'recipients' => $data['recipients'],
            'timing' => $data['timing'],
            'condition' => $data['condition'],
        ];

        if ($event === 'incidencia.critica' && ! ($values['ch_email'] || $values['ch_whatsapp'] || $values['ch_push'] || $values['ch_portal'])) {
            throw ApiException::unprocessable('NTF-BR-01', 'La incidencia crítica debe avisarse por al menos un canal.');
        }

        DB::transaction(function () use ($event, $catalog, $values, $actor): void {
            $row = DB::table('notif_event_rules')->where('event_code', $event)->lockForUpdate()->first();

            if ($row === null) {
                DB::table('notif_event_rules')->insert(['event_code' => $event, 'label' => $catalog['label'], ...$values, 'created_by' => $actor->getKey(), 'updated_by' => $actor->getKey()]);
                $this->audit->log('Notificación', $event, 'actualizar_regla', null, $this->describe($values));

                return;
            }

            $before = $this->describe((array) $row);
            $after = $this->describe($values);

            if ($before === $after) {
                throw ApiException::unprocessable('CFG-BR-01', 'No hay cambios que guardar.');
            }

            DB::table('notif_event_rules')->where('id', $row->id)->update([...$values, 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
            $this->audit->log('Notificación', $event, 'actualizar_regla', $before, $after);
        });
    }

    public function retry(string $code): void
    {
        DB::transaction(function () use ($code): void {
            $message = DB::table('notif_messages')->where('code', $code)->lockForUpdate()->first() ?? throw ApiException::notFound('El envío no existe.');

            if ($message->status !== 'fallido') {
                throw ApiException::unprocessable('NTF-BR-07', 'Solo se reintentan los envíos fallidos.');
            }

            if ($message->last_error !== null && str_contains((string) $message->last_error, '131026')) {
                throw ApiException::conflict('NTF-BR-07', 'Es un error permanente: reintentar no lo resuelve. Corrige el destinatario o avisa por otro canal.');
            }

            DB::table('notif_messages')->where('id', $message->id)->update(['status' => 'pendiente', 'retries' => (int) $message->retries + 1]);
            $this->audit->log('Notificación', $code, 'reintentar', 'fallido', 'pendiente');
        });
    }

    private function describe(array $values): string
    {
        $channels = collect(['ch_email' => 'Correo', 'ch_whatsapp' => 'WhatsApp', 'ch_push' => 'Push', 'ch_portal' => 'Portal'])->filter(fn (string $label, string $key): bool => (bool) ($values[$key] ?? false))->implode(', ');

        return implode(' · ', [$channels ?: 'Sin canales', $values['recipients'], NotificationCatalog::TIMINGS[$values['timing']] ?? $values['timing'], NotificationCatalog::CONDITIONS[$values['condition']] ?? $values['condition']]);
    }
}
