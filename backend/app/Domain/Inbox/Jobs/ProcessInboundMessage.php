<?php

declare(strict_types=1);

namespace App\Domain\Inbox\Jobs;

use App\Domain\Inbox\Actions\InboundMessages;
use App\Domain\Shared\Tenancy\TenantDatabase;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\DB;
use Throwable;

final class ProcessInboundMessage implements ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use SerializesModels;

    public int $tries = 3;

    public function __construct(public readonly string $eventId, public readonly string $tenantId)
    {
        $this->onQueue('integrations');
    }

    public function handle(TenantDatabase $database, InboundMessages $messages): void
    {
        try {
            $database->run($this->tenantId, fn () => $this->process($messages));
        } catch (Throwable $exception) {
            $database->run($this->tenantId, fn () => DB::table('collab_inbound_events')->where('id', $this->eventId)->update([
                'status' => 'error',
                'error' => mb_substr($exception->getMessage(), 0, 500),
                'processed_at' => now(),
            ]));
            report($exception);
        }
    }

    private function process(InboundMessages $messages): void
    {
        $event = DB::table('collab_inbound_events')->where('id', $this->eventId)->lockForUpdate()->first(['id', 'channel', 'payload', 'status']);

        if ($event === null || $event->status !== 'recibido') {
            return;
        }

        $payload = (array) json_decode((string) $event->payload, true);
        $message = (array) ($payload['message'] ?? []);
        $result = $messages->receive((string) $event->channel, (string) $payload['account_id'], $message);

        if (isset($message['attachments'])) {
            $message['attachments'] = array_map(fn (array $file): array => ['file_name' => $file['file_name'] ?? null, 'mime' => $file['mime'] ?? null, 'size' => (int) floor(strlen((string) ($file['content'] ?? '')) * 3 / 4)], (array) $message['attachments']);
        }

        DB::table('collab_inbound_events')->where('id', $event->id)->update([
            'status' => $result['duplicate'] ? 'duplicado' : 'procesado',
            'processed_at' => now(),
            'error' => null,
            'payload' => json_encode([...$payload, 'message' => $message, 'conversation' => $result['conversation']], JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE),
        ]);
    }
}
