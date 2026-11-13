<?php

declare(strict_types=1);

namespace App\Domain\Admin\Actions;

use App\Domain\Admin\Support\PaxTemplateDirectory;
use App\Domain\Admin\Support\PgArray;
use App\Domain\Crm\Support\CodeSequence;
use App\Domain\Iam\Models\User;
use App\Domain\Integrations\Contracts\MessagingChannel;
use App\Domain\Integrations\Data\OutboundMessage;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Tenancy\TenantContext;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class ManagePaxMessages
{
    private const MAX_ATTEMPTS = 5;

    public function __construct(
        private readonly PaxMessageScheduler $scheduler,
        private readonly MessagingChannel $messaging,
        private readonly CodeSequence $codes,
        private readonly PaxTemplateDirectory $directory,
        private readonly AuditLogger $audit,
        private readonly TenantContext $context,
    ) {}

    public function manual(string $reservationCode, array $data, User $actor): string
    {
        $reservation = $this->scheduler->reservation($reservationCode) ?? throw ApiException::notFound('La reserva no existe.');

        if (! in_array($reservation->status, PaxMessageScheduler::LIVE, true)) {
            throw ApiException::conflict('MSG-02', 'Solo se escriben mensajes a reservas vigentes.');
        }

        $template = isset($data['template']) ? DB::table('notif_pax_message_templates')->where('code', $data['template'])->first() : null;

        if (isset($data['template']) && $template === null) {
            throw ApiException::unprocessable('VALIDATION_ERROR', 'La plantilla elegida no existe.');
        }

        if ($template && ! in_array($data['channel'], PgArray::parse($template->channels), true)) {
            throw ApiException::unprocessable('MSG-01', 'Esa plantilla no usa el canal elegido.');
        }

        $recipient = $this->scheduler->recipient($data['channel'], $reservation) ?? throw ApiException::unprocessable('MSG-03', 'El cliente no tiene un contacto para ese canal.');
        $values = $this->directory->values($reservation->id);
        $subject = $data['subject'] ?? $template?->subject;
        $body = $data['body'] ?? ($template === null ? null : $template->body) ?? throw ApiException::unprocessable('VALIDATION_ERROR', 'Escribe el mensaje o elige una plantilla.');

        if ($data['channel'] !== 'whatsapp' && trim((string) $subject) === '') {
            throw ApiException::unprocessable('MSG-01', 'El asunto es obligatorio para correo y portal.');
        }

        $at = isset($data['scheduled_at']) ? CarbonImmutable::parse($data['scheduled_at'], $this->context->timezone())->utc() : null;

        if ($at !== null && $at->lessThan(CarbonImmutable::now()->subMinute())) {
            throw ApiException::unprocessable('VALIDATION_ERROR', 'La fecha de envío debe ser futura.');
        }
        $code = $this->codes->next('notif_pax_messages', 'MSG-', 6);
        $id = (string) Str::uuid7();

        DB::table('notif_pax_messages')->insert([
            'id' => $id,
            'code' => $code,
            'reservation_id' => $reservation->id,
            'template_id' => $template?->id,
            'channel' => $data['channel'],
            'recipient' => $recipient,
            'subject' => $subject ? PaxMessageScheduler::render((string) $subject, $values) : null,
            'body' => PaxMessageScheduler::render((string) $body, $values),
            'status' => 'programado',
            'direction' => 'saliente',
            'origin' => 'manual',
            'scheduled_at' => $at ?? now(),
            'attempts' => 0,
            'lang' => $template->lang ?? $reservation->lang,
            'created_by' => $actor->getKey(),
            'updated_by' => $actor->getKey(),
        ]);
        $this->audit->log('Mensaje al pasajero', $code, 'enviar_manual', null, "{$reservation->code} · {$data['channel']}".($at ? ' · programado '.$at->toIso8601String() : ''));

        if ($at === null || $at->lessThanOrEqualTo(CarbonImmutable::now())) {
            $this->deliver($id);
        }

        return $code;
    }

    public function feedbackReply(object $feedback, object $reservation, string $channel, string $recipient, string $body, User $actor): array
    {
        $code = $this->codes->next('notif_pax_messages', 'MSG-', 6);
        $id = (string) Str::uuid7();

        DB::table('notif_pax_messages')->insert([
            'id' => $id,
            'code' => $code,
            'reservation_id' => $reservation->id,
            'feedback_id' => $feedback->id,
            'channel' => $channel,
            'recipient' => $recipient,
            'subject' => $channel === 'whatsapp' ? null : "Respuesta a tu comentario · {$reservation->code}",
            'body' => $body,
            'status' => 'programado',
            'direction' => 'saliente',
            'origin' => 'manual',
            'scheduled_at' => now(),
            'attempts' => 0,
            'lang' => $reservation->lang ?? 'ES',
            'created_by' => $actor->getKey(),
            'updated_by' => $actor->getKey(),
        ]);
        $this->audit->log('Mensaje al pasajero', $code, 'responder_comentario', null, "{$feedback->code} · {$channel}");

        return ['code' => $code, 'status' => $this->deliver($id)];
    }

    public function sendNow(string $code, User $actor): string
    {
        $message = $this->find($code);

        if ($message->status !== 'programado') {
            throw ApiException::conflict('MSG-STATE', 'Solo se envía ahora un mensaje programado.');
        }

        $status = $this->deliver($message->id);
        $this->audit->log('Mensaje al pasajero', $code, 'enviar_ahora', 'programado', $status);

        return $status;
    }

    public function cancel(string $code, User $actor): void
    {
        $message = $this->find($code);

        if ($message->status !== 'programado') {
            throw ApiException::conflict('MSG-STATE', 'Solo se cancela un mensaje programado.');
        }

        DB::table('notif_pax_messages')->where('id', $message->id)->update(['status' => 'cancelado', 'error' => 'Cancelado por '.$actor->name, 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
        $this->audit->log('Mensaje al pasajero', $code, 'cancelar', 'programado', 'cancelado');
    }

    public function retry(string $code, User $actor): string
    {
        $message = $this->find($code);

        if ($message->status !== 'fallido') {
            throw ApiException::conflict('MSG-STATE', 'Solo se reintenta un mensaje fallido.');
        }

        if ((int) $message->attempts >= self::MAX_ATTEMPTS) {
            throw ApiException::conflict('MSG-ATTEMPTS', 'Ya se intentó '.self::MAX_ATTEMPTS.' veces: revisa el contacto del pasajero y envía uno nuevo.');
        }

        $status = $this->deliver($message->id);
        $this->audit->log('Mensaje al pasajero', $code, 'reintentar', 'fallido', $status);

        return $status;
    }

    public function reschedule(User $actor): array
    {
        $result = $this->scheduler->run();
        $this->audit->log('Mensaje al pasajero', 'programacion', 'recalcular', null, "{$result['scheduled']} nuevos · {$result['updated']} reprogramados · {$result['cancelled']} retirados");

        return $result;
    }

    public function test(string $templateCode, User $actor): string
    {
        $template = DB::table('notif_pax_message_templates')->where('code', $templateCode)->first() ?? throw ApiException::notFound('La plantilla no existe.');
        $sample = DB::table('booking_reservations')->whereNull('deleted_at')->whereIn('status', PaxMessageScheduler::LIVE)->orderByRaw('abs(travel_from - current_date)')->value('id');
        $values = $sample ? $this->directory->values((string) $sample) : [];
        $code = $this->codes->next('notif_pax_messages', 'MSG-', 6);
        $id = (string) Str::uuid7();

        DB::table('notif_pax_messages')->insert([
            'id' => $id,
            'code' => $code,
            'reservation_id' => null,
            'template_id' => $template->id,
            'channel' => 'email',
            'recipient' => Str::lower((string) $actor->email),
            'subject' => '[Prueba] '.PaxMessageScheduler::render((string) ($template->subject ?: $template->name), $values),
            'body' => PaxMessageScheduler::render((string) $template->body, $values),
            'status' => 'programado',
            'direction' => 'saliente',
            'origin' => 'prueba',
            'scheduled_at' => now(),
            'attempts' => 0,
            'lang' => $template->lang,
            'created_by' => $actor->getKey(),
            'updated_by' => $actor->getKey(),
        ]);
        $status = $this->deliver($id);
        $this->audit->log('Plantilla de mensaje', $templateCode, 'probar', null, "{$status} · {$actor->email}");

        return $status;
    }

    public function dispatchDue(): array
    {
        $due = DB::table('notif_pax_messages')->where('status', 'programado')->where('scheduled_at', '<=', now())->orderBy('scheduled_at')->limit(200)->pluck('id');
        $sent = 0;
        $failed = 0;

        foreach ($due as $id) {
            $this->deliver((string) $id) === 'enviado' ? $sent++ : $failed++;
        }

        return ['sent' => $sent, 'failed' => $failed];
    }

    private function deliver(string $id): string
    {
        $message = DB::table('notif_pax_messages')->where('id', $id)->first();

        if ($message === null || ! in_array($message->status, ['programado', 'fallido'], true)) {
            return (string) ($message->status ?? 'cancelado');
        }

        $result = $message->channel === 'portal'
            ? null
            : $this->messaging->send(new OutboundMessage($message->channel, (string) $message->recipient, $message->subject, $message->body, null, [], Str::lower((string) $message->lang)));
        $ok = $result === null || $result->ok;

        DB::table('notif_pax_messages')->where('id', $id)->update([
            'status' => $ok ? 'enviado' : 'fallido',
            'sent_at' => $ok ? now() : $message->sent_at,
            'attempts' => (int) $message->attempts + 1,
            'provider_message_id' => ($result === null ? null : $result->externalId) ?? $message->provider_message_id,
            'error' => $ok ? null : ($result->message ?? 'El proveedor rechazó el envío'),
            'updated_at' => now(),
        ]);

        return $ok ? 'enviado' : 'fallido';
    }

    private function find(string $code): object
    {
        return DB::table('notif_pax_messages')->where('code', $code)->first() ?? throw ApiException::notFound('El mensaje no existe.');
    }
}
