<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Domain\Admin\Support\IntegrationErrors;
use App\Domain\Integrations\Contracts\MessagingChannel;
use App\Domain\Integrations\Contracts\PushSender;
use App\Domain\Integrations\Data\OutboundMessage;
use App\Domain\Shared\Tenancy\Jobs\RestoreTenantContext;
use App\Domain\Shared\Tenancy\Jobs\TenantAware;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Support\Facades\DB;

final class RetryNotificationMessage implements ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use TenantAware;

    public int $tries = 3;

    public function __construct(public readonly string $messageId)
    {
        $this->onQueue('notifications');
    }

    public static function for(object $message, string $tenantId): void
    {
        match ($message->channel) {
            'email' => dispatch((new SendNotificationEmail((string) $message->id))->forTenant($tenantId))->afterCommit(),
            'portal' => DB::table('notif_messages')->where('id', $message->id)->update(['status' => 'enviado', 'sent_at' => now(), 'last_error' => null]),
            default => dispatch((new self((string) $message->id))->forTenant($tenantId))->afterCommit(),
        };
    }

    public function middleware(): array
    {
        return [new RestoreTenantContext];
    }

    public function handle(MessagingChannel $channel, PushSender $push): void
    {
        $message = DB::table('notif_messages')->where('id', $this->messageId)->lockForUpdate()->first(['id', 'code', 'channel', 'status', 'recipient_user_id', 'recipient_address', 'subject', 'body_rendered']);

        if ($message === null || $message->status !== 'pendiente') {
            return;
        }

        if ($message->channel === 'push') {
            $tokens = DB::table('ops_mobile_devices')->where('user_id', $message->recipient_user_id)->whereNull('revoked_at')->whereNotNull('expo_push_token')->pluck('expo_push_token')->all();
            $result = $tokens === [] ? null : $push->send($tokens, (string) $message->subject, (string) $message->body_rendered);
        } else {
            $result = $message->recipient_address ? $channel->send(new OutboundMessage(channel: (string) $message->channel, to: (string) $message->recipient_address, subject: $message->subject, body: (string) $message->body_rendered)) : null;
        }

        $ok = $result !== null && $result->ok;
        DB::table('notif_messages')->where('id', $message->id)->update([
            'status' => $ok ? 'enviado' : 'fallido',
            'sent_at' => $ok ? now() : null,
            'provider_message_id' => $ok ? $result->externalId : null,
            'last_error' => $ok ? null : mb_substr($result === null ? 'Sin destino para el canal' : (string) $result->message, 0, 500),
        ]);
        $ref = (string) ($message->code ?: 'MSG-'.substr((string) $message->id, -8));

        if ($ok) {
            IntegrationErrors::resolve($this->tenantId, 'notification', $ref);

            return;
        }

        $attempt = (int) DB::table('integration_errors')->where('source', 'notification')->where('ref_code', $ref)->where('status', 'reintentando')->value('attempt');
        IntegrationErrors::record($this->tenantId, 'notification', $ref, ucfirst((string) $message->channel).' · '.($message->recipient_address ?? 'sin destino'), $result === null ? 'Sin destino para el canal' : (string) $result->message, $attempt + 1, $this->tries, $result === null);
    }
}
