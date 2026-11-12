<?php

declare(strict_types=1);

namespace App\Domain\Admin\Actions;

use App\Domain\Admin\Support\NotificationCatalog;
use App\Domain\Admin\Support\NotificationLog;
use App\Domain\Admin\Support\NotificationTemplates;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Tenancy\TenantContext;
use App\Jobs\RetryNotificationMessage;
use App\Jobs\SendNotificationEmail;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class ManageNotifications
{
    private const PERMANENT = '131026';

    public function __construct(
        private readonly AuditLogger $audit,
        private readonly NotificationLog $log,
        private readonly NotificationTemplates $templates,
        private readonly TenantContext $context,
    ) {}

    public function rule(string $event, array $data, User $actor): void
    {
        $catalog = NotificationCatalog::EVENTS[$event] ?? throw ApiException::notFound('El evento no existe.');

        DB::transaction(function () use ($event, $catalog, $data, $actor): void {
            $row = DB::table('notif_event_rules')->where('event_code', $event)->lockForUpdate()->first();
            $current = (array) ($row ?? ['ch_email' => false, 'ch_whatsapp' => false, 'ch_push' => false, 'ch_portal' => false, 'recipients' => $catalog['recipients'], 'timing' => 'immediate', 'condition' => 'always']);
            $values = [];

            foreach (['ch_email', 'ch_whatsapp', 'ch_push', 'ch_portal', 'recipients', 'timing', 'condition'] as $key) {
                $values[$key] = array_key_exists($key, $data) ? $data[$key] : $current[$key];
            }

            foreach (['ch_email', 'ch_whatsapp', 'ch_push', 'ch_portal'] as $channel) {
                $values[$channel] = (bool) $values[$channel];
            }

            if ($event === 'incidencia.critica' && ! ($values['ch_email'] || $values['ch_whatsapp'] || $values['ch_push'] || $values['ch_portal'])) {
                throw ApiException::unprocessable('NTF-BR-01', 'La incidencia crítica debe avisarse por al menos un canal.');
            }

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

    public function testRule(string $event, array $rule, User $actor): array
    {
        $channels = collect(['email', 'whatsapp', 'push', 'portal'])->filter(fn (string $channel): bool => (bool) $rule['ch_'.$channel])->values();

        if ($channels->isEmpty()) {
            throw ApiException::unprocessable('NTF-BR-02', 'Este evento no tiene canales activos: activa al menos uno para probarlo.');
        }

        return DB::transaction(function () use ($event, $channels, $actor): array {
            $codes = $channels->map(function (string $channel) use ($event, $actor): string {
                $template = $this->templates->current($event, $channel === 'portal' ? 'email' : $channel);

                return (string) $this->deliver($actor, $event, $channel, $template['preview']['subject'], $template['preview']['body'], $template['id'])->code;
            })->all();
            $this->audit->log('Notificación', $event, 'probar_regla', null, implode(', ', $codes));

            return $codes;
        });
    }

    public function saveTemplate(string $event, string $channel, array $data, User $actor): void
    {
        $this->templates->assertTarget($event, $channel);
        $this->assertContent($channel, (string) $data['subject'], (string) $data['body']);

        DB::transaction(function () use ($event, $channel, $data, $actor): void {
            $current = $this->templates->current($event, $channel);

            if ($current['subject'] === $data['subject'] && $current['body'] === $data['body'] && ($current['provider_template_id'] ?? null) === ($data['provider_template_id'] ?? null)) {
                throw ApiException::unprocessable('NTF-BR-05', 'La plantilla no tiene cambios que guardar.');
            }

            $tenant = DB::table('notif_templates')->whereNotNull('tenant_id')->where('event_code', $event)->where('channel', $channel);
            (clone $tenant)->lockForUpdate()->get(['id']);
            $version = (int) (clone $tenant)->max('version') + 1;
            (clone $tenant)->where('is_current', true)->update(['is_current' => false]);
            DB::table('notif_templates')->insert([
                'id' => (string) Str::uuid7(),
                'event_code' => $event,
                'channel' => $channel,
                'version' => $version,
                'subject' => $data['subject'],
                'body' => $data['body'],
                'is_current' => true,
                'provider_template_id' => $data['provider_template_id'] ?? null,
                'created_by' => $actor->getKey(),
            ]);
            $this->audit->log('Notificación', "{$event}.{$channel}", 'editar_plantilla', "v{$current['version']}", "v{$version}");
        });
    }

    public function restoreTemplate(string $event, string $channel): void
    {
        $this->templates->assertTarget($event, $channel);

        DB::transaction(function () use ($event, $channel): void {
            $updated = DB::table('notif_templates')->whereNotNull('tenant_id')->where('event_code', $event)->where('channel', $channel)->where('is_current', true)->update(['is_current' => false]);

            if ($updated === 0) {
                throw ApiException::conflict('NTF-BR-05', 'Esta notificación ya usa la plantilla predeterminada.');
            }

            $this->audit->log('Notificación', "{$event}.{$channel}", 'restaurar_plantilla', 'agencia', 'sistema');
        });
    }

    public function testTemplate(string $event, string $channel, array $data, User $actor): object
    {
        $template = $this->templates->current($event, $channel);
        $subject = (string) ($data['subject'] ?? $template['subject']);
        $body = (string) ($data['body'] ?? $template['body']);
        $this->assertContent($channel, $subject, $body);

        return DB::transaction(function () use ($event, $channel, $subject, $body, $template, $actor): object {
            $message = $this->deliver($actor, $event, $channel, NotificationCatalog::render($subject), NotificationCatalog::render($body), $template['id']);
            $this->audit->log('Notificación', "{$event}.{$channel}", 'probar_plantilla', null, (string) $message->code);

            return $message;
        });
    }

    public function retry(string $id): string
    {
        return DB::transaction(function () use ($id): string {
            $message = $this->message($id);

            if ($message->status !== 'fallido') {
                throw ApiException::unprocessable('NTF-BR-07', 'Solo se reintentan los envíos fallidos.');
            }

            if ($this->permanent($message)) {
                throw ApiException::conflict('NTF-BR-07', 'Es un error permanente: reintentar no lo resuelve. Corrige el destinatario o avisa por otro canal.');
            }

            DB::table('notif_messages')->where('id', $message->id)->update(['status' => 'pendiente', 'retries' => (int) $message->retries + 1]);
            RetryNotificationMessage::for($message, $this->context->idOrFail());
            $this->audit->log('Notificación', (string) $message->code, 'reintentar', 'fallido', 'pendiente');

            return (string) $message->id;
        });
    }

    public function retryFailed(): array
    {
        return DB::transaction(function (): array {
            $failed = DB::table('notif_messages')->where('status', 'fallido')->lockForUpdate()->get(['id', 'code', 'channel', 'retries', 'last_error']);
            [$permanent, $retryable] = $failed->partition(fn (object $message): bool => $this->permanent($message));

            foreach ($retryable as $message) {
                DB::table('notif_messages')->where('id', $message->id)->update(['status' => 'pendiente', 'retries' => (int) $message->retries + 1]);
                RetryNotificationMessage::for($message, $this->context->idOrFail());
            }

            if ($retryable->isNotEmpty()) {
                $this->audit->log('Notificación', 'fallidos', 'reintentar', $retryable->count().' fallidos', 'pendiente');
            }

            return ['retried' => $retryable->count(), 'skipped' => $permanent->count(), 'codes' => $retryable->pluck('code')->values()->all()];
        });
    }

    public function fallback(string $id, User $actor): string
    {
        return DB::transaction(function () use ($id, $actor): string {
            $message = $this->message($id);

            if ($message->channel === 'email' || $message->is_fallback) {
                throw ApiException::unprocessable('NTF-BR-08', 'El reenvío por correo solo aplica a envíos por otros canales que no sean ya un reenvío.');
            }

            $email = $this->emailFor($message) ?? throw ApiException::unprocessable('NTF-BR-08', 'No hay un correo registrado para este destinatario.');

            if (DB::table('notif_messages')->where('fallback_of_id', $message->id)->exists()) {
                throw ApiException::conflict('NTF-BR-08', 'Este envío ya se reenvió por correo.');
            }

            $copy = $this->log->record([
                'event_code' => $message->event_code,
                'channel' => 'email',
                'recipient_user_id' => $message->recipient_user_id,
                'recipient_address' => $email,
                'subject' => $message->subject,
                'body_rendered' => $message->body_rendered,
                'source_type' => $message->source_type,
                'source_id' => $message->source_id,
                'client_id' => $message->client_id,
                'reservation_id' => $message->reservation_id,
                'audience' => $message->audience,
                'is_fallback' => true,
                'fallback_of_id' => $message->id,
                'status' => 'pendiente',
                'created_by' => $actor->getKey(),
            ]);
            $this->queueEmail((string) $copy->id);
            $this->audit->log('Notificación', (string) $message->code, 'reenviar_correo', $message->channel, (string) $copy->code);

            return (string) $copy->id;
        });
    }

    private function deliver(User $actor, string $event, string $channel, string $subject, string $body, ?string $templateId): object
    {
        $address = match ($channel) {
            'email' => $actor->email,
            'whatsapp' => $actor->phone,
            default => null,
        };
        $missing = $channel === 'whatsapp' && ($address === null || trim((string) $address) === '');
        $message = $this->log->record([
            'event_code' => $event,
            'channel' => $channel,
            'recipient_user_id' => $actor->getKey(),
            'recipient_address' => $address,
            'subject' => mb_substr('[Prueba] '.$subject, 0, 200),
            'body_rendered' => $body,
            'template_id' => $templateId,
            'source_type' => 'Prueba',
            'status' => $missing ? 'fallido' : ($channel === 'email' && $address !== null ? 'pendiente' : 'enviado'),
            'last_error' => $missing ? 'Tu usuario no tiene un teléfono registrado para WhatsApp.' : null,
            'created_by' => $actor->getKey(),
        ]);

        if ($channel === 'email' && $address !== null) {
            $this->queueEmail((string) $message->id);
        }

        return $message;
    }

    private function assertContent(string $channel, string $subject, string $body): void
    {
        $unknown = NotificationCatalog::unknownVariables($subject, $body);

        if ($unknown !== []) {
            throw ApiException::unprocessable('NTF-BR-03', 'Variables no permitidas: '.implode(', ', array_map(fn (string $name): string => '{{'.$name.'}}', $unknown)).'.');
        }

        if ($channel === 'push' && mb_strlen($body) > 140) {
            throw ApiException::unprocessable('NTF-BR-04', 'El mensaje push no puede superar los 140 caracteres.');
        }
    }

    private function emailFor(object $message): ?string
    {
        $email = $message->recipient_user_id ? DB::table('iam_users')->where('id', $message->recipient_user_id)->value('email') : null;
        $email ??= $message->client_id ? DB::table('crm_clients')->where('id', $message->client_id)->value('email') : null;
        $email ??= str_contains((string) $message->recipient_address, '@') ? $message->recipient_address : null;

        return $email === null ? null : (string) $email;
    }

    private function queueEmail(string $messageId): void
    {
        dispatch((new SendNotificationEmail($messageId))->forTenant($this->context->idOrFail()))->afterCommit();
    }

    private function message(string $id): object
    {
        return DB::table('notif_messages')->where(Str::isUuid($id) ? 'id' : 'code', $id)->lockForUpdate()->first() ?? throw ApiException::notFound('El envío no existe.');
    }

    private function permanent(object $message): bool
    {
        return $message->last_error !== null && str_contains((string) $message->last_error, self::PERMANENT);
    }

    private function describe(array $values): string
    {
        $channels = collect(['ch_email' => 'Correo', 'ch_whatsapp' => 'WhatsApp', 'ch_push' => 'Push', 'ch_portal' => 'Portal'])->filter(fn (string $label, string $key): bool => (bool) ($values[$key] ?? false))->implode(', ');

        return implode(' · ', [$channels ?: 'Sin canales', $values['recipients'], NotificationCatalog::TIMINGS[$values['timing']] ?? $values['timing'], NotificationCatalog::CONDITIONS[$values['condition']] ?? $values['condition']]);
    }
}
