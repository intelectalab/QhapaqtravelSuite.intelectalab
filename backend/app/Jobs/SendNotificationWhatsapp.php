<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Domain\Admin\Support\AdapterRetryPolicy;
use App\Domain\Admin\Support\IntegrationErrors;
use App\Domain\Admin\Support\StaffNotices;
use App\Domain\Inbox\Support\WhatsappAccounts;
use App\Domain\Integrations\Contracts\MessagingChannel;
use App\Domain\Integrations\Data\OutboundMessage;
use App\Domain\Platform\Support\NotificationThrottler;
use App\Domain\Platform\Support\UsageMeter;
use App\Domain\Shared\Tenancy\Jobs\RestoreTenantContext;
use App\Domain\Shared\Tenancy\Jobs\TenantAware;
use App\Domain\Shared\Tenancy\TenantDatabase;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Support\Facades\DB;
use RuntimeException;
use Throwable;

final class SendNotificationWhatsapp implements ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use TenantAware;

    public int $tries = AdapterRetryPolicy::TRIES;

    public int $timeout = AdapterRetryPolicy::TIMEOUT_SECONDS;

    public array $delays = [];

    public function __construct(public readonly string $messageId)
    {
        $this->onQueue('notifications');
        $policy = AdapterRetryPolicy::for('whatsapp');
        [$this->tries, $this->delays, $this->timeout] = [$policy['tries'], $policy['backoff'], $policy['timeout']];
    }

    public function backoff(): array
    {
        return $this->delays !== [] ? $this->delays : AdapterRetryPolicy::delays();
    }

    public function middleware(): array
    {
        return [new RestoreTenantContext];
    }

    public function handle(MessagingChannel $channel, WhatsappAccounts $accounts, NotificationThrottler $throttler): void
    {
        $message = DB::table('notif_messages')->where('id', $this->messageId)->lock('for no key update')->first(['id', 'code', 'event_code', 'channel', 'status', 'recipient_address', 'subject', 'body_rendered']);

        if ($message === null || $message->status !== 'pendiente' || $message->channel !== 'whatsapp' || blank($message->recipient_address)) {
            return;
        }

        if (($reason = $throttler->reason('whatsapp', $this->tenantId, (string) $message->event_code)) !== null) {
            DB::table('notif_messages')->where('id', $message->id)->update(['last_error' => $reason]);
            dispatch((new self((string) $message->id))->forTenant((string) $this->tenantId))->delay($throttler->resumesAt());

            return;
        }

        $sender = $accounts->sender();

        if ($sender === null) {
            DB::table('notif_messages')->where('id', $message->id)->update(['status' => 'fallido', 'last_error' => StaffNotices::WHATSAPP_MISSING]);

            return;
        }

        $template = $this->template((string) $message->event_code);
        $result = $channel->send(new OutboundMessage(
            channel: 'whatsapp',
            to: (string) $message->recipient_address,
            subject: $message->subject,
            body: (string) $message->body_rendered,
            templateCode: $template?->name,
            variables: $template === null ? [] : ['mensaje' => (string) $message->body_rendered],
            locale: (string) ($template->lang ?? 'es'),
            sender: $sender,
        ));

        if ($result->ok) {
            DB::table('notif_messages')->where('id', $message->id)->update(['status' => 'enviado', 'sent_at' => now(), 'provider_message_id' => $result->externalId, 'last_error' => null]);
            IntegrationErrors::resolve($this->tenantId, 'notification', $this->ref($message));

            if ($this->tenantId !== null) {
                UsageMeter::record((string) $this->tenantId, 'whatsapp_month');
            }

            return;
        }

        if ($result->errorClass === 'cuota') {
            DB::table('notif_messages')->where('id', $message->id)->update(['last_error' => mb_substr((string) $result->message, 0, 500)]);
            dispatch((new self((string) $message->id))->forTenant((string) $this->tenantId))->delay($throttler->resumesAt());

            return;
        }

        if ($result->errorClass === 'transitorio') {
            DB::table('notif_messages')->where('id', $message->id)->update(['retries' => DB::raw('retries + 1'), 'last_error' => mb_substr((string) $result->message, 0, 500)]);

            throw new RuntimeException((string) $result->message);
        }

        DB::table('notif_messages')->where('id', $message->id)->update(['status' => 'fallido', 'last_error' => mb_substr((string) $result->message, 0, 500)]);
        IntegrationErrors::record($this->tenantId, 'notification', $this->ref($message), 'WhatsApp · '.$message->recipient_address, (string) $result->message, 1, 1, true);
    }

    public function failed(Throwable $e): void
    {
        if ($this->tenantId === null) {
            return;
        }

        $message = app(TenantDatabase::class)->run($this->tenantId, function () use ($e): ?object {
            DB::table('notif_messages')->where('id', $this->messageId)->where('status', 'pendiente')
                ->update(['status' => 'fallido', 'last_error' => mb_substr($e->getMessage(), 0, 500)]);

            return DB::table('notif_messages')->where('id', $this->messageId)->first(['id', 'code', 'recipient_address']);
        });

        if ($message !== null) {
            IntegrationErrors::record($this->tenantId, 'notification', $this->ref($message), 'WhatsApp · '.$message->recipient_address, IntegrationErrors::describe($e), $this->tries, $this->tries);
        }
    }

    private function template(string $event): ?object
    {
        return DB::table('collab_whatsapp_templates')->where('status', 'aprobada')->where('name', str_replace('.', '_', $event))
            ->orderByRaw("case when lang = 'es' then 0 else 1 end")->first(['name', 'lang']);
    }

    private function ref(object $message): string
    {
        return (string) ($message->code ?: 'MSG-'.substr((string) $message->id, -8));
    }
}
