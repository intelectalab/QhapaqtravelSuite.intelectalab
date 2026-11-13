<?php

declare(strict_types=1);

namespace App\Domain\Marketing\Support;

use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Tenancy\TenantContext;
use Carbon\CarbonInterface;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use stdClass;

final class DeliveryReceipts
{
    public const CAMPAIGN_EVENTS = ['delivered', 'opened', 'clicked', 'bounced', 'replied'];

    public const ACKS = ['entregado' => 'delivered', 'leido' => 'opened', 'fallido' => 'failed', 'delivered' => 'delivered', 'read' => 'opened', 'failed' => 'failed'];

    public const LOOKUP = ['mkt_campaign_recipients', 'notif_pax_messages', 'notif_messages'];

    private const LABELS = ['delivered' => 'entregado', 'opened' => 'abierto', 'clicked' => 'clic', 'bounced' => 'rebotado', 'failed' => 'fallido', 'replied' => 'respondido'];

    private const REACHED = ['delivered', 'opened', 'clicked', 'replied'];

    public function __construct(
        private readonly TenantContext $context,
        private readonly AuditLogger $audit,
        private readonly UnsubscribeConfirmation $confirmation,
    ) {}

    public static function tenantOf(string $providerMessageId, array $tables = self::LOOKUP): ?string
    {
        foreach (array_intersect($tables, self::LOOKUP) as $table) {
            $tenant = DB::connection('pgsql_platform')->table($table)->where('provider_message_id', $providerMessageId)->value('tenant_id');

            if ($tenant !== null) {
                return (string) $tenant;
            }
        }

        return null;
    }

    public static function isOptOut(?string $text): bool
    {
        return preg_match('/^\s*baja[\s.!¡]*$/iu', (string) $text) === 1;
    }

    public function claim(string $channel, string $eventId, array $payload): bool
    {
        return DB::table('collab_inbound_events')->insertOrIgnore([
            'id' => (string) Str::uuid7(),
            'tenant_id' => $this->context->idOrFail(),
            'channel' => $channel,
            'external_event_id' => mb_substr($eventId, 0, 190),
            'payload' => json_encode($payload, JSON_UNESCAPED_UNICODE),
            'status' => 'procesado',
            'processed_at' => now(),
        ]) === 1;
    }

    public function apply(string $event, string $messageId, CarbonInterface $at, ?string $detail = null): ?array
    {
        $recipient = $this->recipient(fn ($query) => $query->where('r.provider_message_id', $messageId));

        if ($recipient !== null) {
            return $this->record($recipient, $event, $at, $detail);
        }

        return $this->passenger($event, $messageId, $at, $detail) ?? $this->notification($event, $messageId, $at, $detail);
    }

    public function reply(string $channel, ?string $messageId, ?string $from, ?string $text, CarbonInterface $at): ?array
    {
        $digits = preg_replace('/\D/', '', (string) $from);
        $recipient = match (true) {
            filled($messageId) => $this->recipient(fn ($query) => $query->where('r.provider_message_id', $messageId)),
            $channel === 'whatsapp' && $digits !== '' => $this->recipient(fn ($query) => $query->where('c.channel', 'whatsapp')->whereRaw("regexp_replace(r.address, '\\D', '', 'g') = ?", [$digits])->orderByDesc('r.created_at')),
            default => null,
        };

        if ($recipient === null) {
            return null;
        }

        $result = $this->record($recipient, 'replied', $at, null);

        if (self::isOptOut($text) && $this->optOut($recipient, $at)) {
            return [...$result, 'result' => 'baja'];
        }

        return $result;
    }

    private function recipient(callable $scope): ?stdClass
    {
        $query = DB::table('mkt_campaign_recipients as r')->join('mkt_campaigns as c', 'c.id', '=', 'r.campaign_id');
        $scope($query);
        $row = $query->first(['r.id', 'r.campaign_id', 'r.subject_type', 'r.subject_id', 'r.address', 'r.status', 'r.delivered_at', 'r.opened_at', 'r.clicked_at', 'r.replied_at', 'r.unsubscribed_at', 'c.code as campaign_code', 'c.channel']);

        return $row instanceof stdClass ? $row : null;
    }

    private function record(stdClass $recipient, string $event, CarbonInterface $at, ?string $detail): array
    {
        $reached = in_array($event, self::REACHED, true);
        $open = in_array($recipient->status, ['pendiente', 'enviado'], true);
        $status = match (true) {
            $reached && $open => 'entregado',
            $event === 'bounced' && $recipient->status !== 'rebotado' => 'rebotado',
            $event === 'failed' && $open => 'fallido',
            default => null,
        };
        $values = array_filter([
            'status' => $status,
            'delivered_at' => $reached && $recipient->delivered_at === null ? $at : null,
            'opened_at' => in_array($event, ['opened', 'clicked'], true) && $recipient->opened_at === null ? $at : null,
            'clicked_at' => $event === 'clicked' && $recipient->clicked_at === null ? $at : null,
            'replied_at' => $event === 'replied' && $recipient->replied_at === null ? $at : null,
            'error' => in_array($status, ['rebotado', 'fallido'], true) ? mb_substr(trim((string) $detail) ?: ($status === 'rebotado' ? 'El servidor de destino rechazó el correo.' : 'El proveedor no pudo entregar el mensaje.'), 0, 500) : null,
        ], fn (mixed $value): bool => $value !== null);
        $current = $status ?? (string) $recipient->status;

        if ($values === []) {
            return ['result' => 'duplicado', 'kind' => 'campaña', 'reference' => (string) $recipient->campaign_code, 'status' => $current];
        }

        DB::table('mkt_campaign_recipients')->where('id', $recipient->id)->update([...$values, 'updated_at' => now()]);
        $this->audit->log('Campaña', (string) $recipient->campaign_code, 'acuse_envio', (string) $recipient->status, self::LABELS[$event].' · '.$recipient->address);

        return ['result' => 'actualizado', 'kind' => 'campaña', 'reference' => (string) $recipient->campaign_code, 'status' => $current];
    }

    private function optOut(stdClass $recipient, CarbonInterface $at): bool
    {
        $source = "Respuesta BAJA a la campaña {$recipient->campaign_code}";
        $consent = DB::table('mkt_consents')->where('subject_type', $recipient->subject_type)->where('subject_id', $recipient->subject_id)->where('channel', $recipient->channel)->lockForUpdate()->first(['id', 'code', 'status']);
        $revoked = false;

        if ($consent !== null && $consent->status !== 'revocado') {
            DB::table('mkt_consents')->where('id', $consent->id)->update(['status' => 'revocado', 'revoked_at' => $at, 'revoke_source' => $source, 'revoke_campaign_id' => $recipient->campaign_id, 'lock_version' => DB::raw('lock_version + 1'), 'updated_at' => now()]);
            DB::table('mkt_consent_events')->insert([
                'id' => (string) Str::uuid7(),
                'tenant_id' => $this->context->idOrFail(),
                'consent_id' => $consent->id,
                'event' => 'revocado',
                'source' => $source,
                'evidence' => $source.' · '.$at->format('Y-m-d H:i'),
                'occurred_at' => $at,
            ]);
            $this->audit->log('Consentimiento', (string) $consent->code, "baja_{$recipient->channel}", 'otorgado', "revocado · {$source}");
            $this->confirmation->send((string) $recipient->subject_type, (string) $recipient->subject_id, (string) $recipient->channel, (string) $consent->id);
            $revoked = true;
        }

        if ($recipient->unsubscribed_at === null) {
            DB::table('mkt_campaign_recipients')->where('id', $recipient->id)->update(['unsubscribed_at' => $at, 'updated_at' => now()]);
            $this->audit->log('Campaña', (string) $recipient->campaign_code, 'baja_destinatario', null, (string) $recipient->address);
            $revoked = true;
        }

        return $revoked;
    }

    private function passenger(string $event, string $messageId, CarbonInterface $at, ?string $detail): ?array
    {
        $message = DB::table('notif_pax_messages')->where('provider_message_id', $messageId)->first(['id', 'code', 'status', 'delivered_at', 'read_at']);

        if (! $message instanceof stdClass) {
            return null;
        }

        $next = match ($event) {
            'delivered' => $message->status === 'enviado' ? 'entregado' : null,
            'opened', 'clicked', 'replied' => in_array($message->status, ['enviado', 'entregado'], true) ? 'leido' : null,
            default => in_array($message->status, ['programado', 'enviado'], true) ? 'fallido' : null,
        };

        if ($next === null) {
            return ['result' => 'duplicado', 'kind' => 'mensaje al pasajero', 'reference' => (string) $message->code, 'status' => (string) $message->status];
        }

        DB::table('notif_pax_messages')->where('id', $message->id)->update(array_filter([
            'status' => $next,
            'delivered_at' => $next !== 'fallido' && $message->delivered_at === null ? $at : null,
            'read_at' => $next === 'leido' && $message->read_at === null ? $at : null,
            'error' => $next === 'fallido' ? mb_substr(trim((string) $detail) ?: 'El proveedor no pudo entregar el mensaje.', 0, 500) : null,
            'updated_at' => now(),
        ], fn (mixed $value): bool => $value !== null));
        $this->audit->log('Mensaje al pasajero', (string) $message->code, 'acuse', (string) $message->status, $next);

        return ['result' => 'actualizado', 'kind' => 'mensaje al pasajero', 'reference' => (string) $message->code, 'status' => $next];
    }

    private function notification(string $event, string $messageId, CarbonInterface $at, ?string $detail): ?array
    {
        $message = DB::table('notif_messages')->where('provider_message_id', $messageId)->first(['id', 'code', 'status', 'read_at']);

        if (! $message instanceof stdClass) {
            return null;
        }

        $failed = in_array($event, ['failed', 'bounced'], true) && $message->status !== 'fallido';
        $values = array_filter([
            'status' => $failed ? 'fallido' : null,
            'last_error' => $failed ? mb_substr(trim((string) $detail) ?: 'El proveedor no pudo entregar el mensaje.', 0, 500) : null,
            'read_at' => in_array($event, ['opened', 'clicked'], true) && $message->read_at === null ? $at : null,
        ], fn (mixed $value): bool => $value !== null);
        $reference = (string) ($message->code ?? $message->id);
        $status = $failed ? 'fallido' : (string) $message->status;

        if ($values === []) {
            return ['result' => 'duplicado', 'kind' => 'notificación', 'reference' => $reference, 'status' => $status];
        }

        DB::table('notif_messages')->where('id', $message->id)->update($values);
        $this->audit->log('Notificación', $reference, 'acuse', (string) $message->status, $failed ? 'fallido' : 'leído');

        return ['result' => 'actualizado', 'kind' => 'notificación', 'reference' => $reference, 'status' => $status];
    }
}
