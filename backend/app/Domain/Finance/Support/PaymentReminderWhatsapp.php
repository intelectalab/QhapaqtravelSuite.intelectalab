<?php

declare(strict_types=1);

namespace App\Domain\Finance\Support;

use App\Domain\Growth\Shared\GrowthRules;
use App\Domain\Inbox\Support\WhatsappAccounts;
use App\Domain\Integrations\Contracts\MessagingChannel;
use App\Domain\Integrations\Data\OutboundMessage;
use App\Domain\Shared\Audit\AuditLogger;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class PaymentReminderWhatsapp
{
    public const EVENT = 'pago.recordatorio';

    public const TEMPLATE = 'pago_recordatorio';

    public const OPTED_OUT = 'WhatsApp omitido: el cliente se dio de baja';

    public function __construct(
        private readonly WhatsappAccounts $accounts,
        private readonly MessagingChannel $messaging,
        private readonly GrowthRules $rules,
        private readonly AuditLogger $audit,
    ) {}

    public static function optedOut(?string $clientId): bool
    {
        return $clientId !== null && DB::table('mkt_consents')->where('subject_type', 'client')->where('subject_id', $clientId)->where('channel', 'whatsapp')->where('status', 'revocado')->exists();
    }

    public function send(?string $phone, array $variables, array $source): array
    {
        if (self::optedOut(isset($source['client_id']) ? (string) $source['client_id'] : null)) {
            $this->recordOptOut($source);

            return ['sent' => false, 'reason' => self::OPTED_OUT.'.', 'opted_out' => true];
        }

        $digits = (string) preg_replace('/\D+/', '', (string) $phone);
        $sender = $this->rules->enabled('R-WHATSAPP-OFFICIAL') ? $this->accounts->sender() : null;
        $template = $sender === null ? null : $this->template();

        $skip = match (true) {
            $sender === null => 'La agencia no tiene WhatsApp conectado: salió solo por correo.',
            strlen($digits) < 9 => 'El cliente no tiene celular: salió solo por correo.',
            $template === null => 'Falta que Meta apruebe la plantilla «'.self::TEMPLATE.'»: salió solo por correo.',
            default => null,
        };

        if ($skip !== null) {
            return ['sent' => false, 'reason' => $skip];
        }

        $values = array_map('strval', $variables);
        $body = (string) preg_replace_callback('/\{\{\s*([a-z0-9_]+)\s*\}\}/', fn (array $match): string => $values[$match[1]] ?? '', (string) $template->body);
        $to = '+'.$digits;
        $result = $this->messaging->send(new OutboundMessage('whatsapp', $to, null, $body, (string) $template->name, $values, (string) $template->lang, $sender));

        DB::table('notif_messages')->insert([
            'id' => (string) Str::uuid7(),
            'event_code' => self::EVENT,
            'channel' => 'whatsapp',
            'recipient_address' => mb_substr($to, 0, 190),
            'subject' => 'Recordatorio de pago',
            'body_rendered' => $body,
            'source_type' => $source['source_type'] ?? null,
            'source_id' => $source['source_id'] ?? null,
            'client_id' => $source['client_id'] ?? null,
            'reservation_id' => $source['reservation_id'] ?? null,
            'audience' => 'client',
            'status' => $result->ok ? 'enviado' : 'fallido',
            'last_error' => $result->ok ? null : mb_substr((string) $result->message, 0, 500),
            'provider_message_id' => $result->ok ? $result->externalId : null,
            'sent_at' => $result->ok ? now() : null,
        ]);

        return $result->ok
            ? ['sent' => true, 'reason' => null, 'to' => $to]
            : ['sent' => false, 'reason' => 'WhatsApp no aceptó el mensaje: '.$result->message];
    }

    private function recordOptOut(array $source): void
    {
        $code = ($source['source_type'] ?? null) === 'fin_receivable' && isset($source['source_id']) ? DB::table('fin_receivables')->where('id', $source['source_id'])->value('code') : null;

        if ($code !== null) {
            $this->audit->log('Cuenta por cobrar', (string) $code, 'omitir_whatsapp', null, self::OPTED_OUT);
        }
    }

    private function template(): ?object
    {
        return DB::table('collab_whatsapp_templates')->where('status', 'aprobada')
            ->where(fn ($query) => $query->where('name', self::TEMPLATE)->orWhere('purpose', 'recordatorio'))
            ->orderByRaw('case when name = ? then 0 else 1 end', [self::TEMPLATE])
            ->orderByRaw("case when lang = 'es' then 0 else 1 end")
            ->first(['name', 'lang', 'body']);
    }
}
