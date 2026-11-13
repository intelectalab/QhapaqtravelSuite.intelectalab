<?php

declare(strict_types=1);

namespace App\Domain\Inbox\Actions;

use App\Domain\Inbox\Jobs\ProcessInboundMessage;
use App\Domain\Integrations\Support\ChannelWebhooks;
use App\Domain\Shared\Tenancy\TenantDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class InboundEvents
{
    public function __construct(private readonly ChannelWebhooks $webhooks, private readonly TenantDatabase $database) {}

    public function accept(string $channel, object $account, string $raw, string $signature, array $messages): array
    {
        $tenantId = (string) $account->tenant_id;
        $results = $this->database->run($tenantId, function () use ($channel, $account, $raw, $signature, $messages): array {
            $this->webhooks->verify((string) $account->account_id, $raw, $signature);

            return array_map(fn (array $message): array => $this->record($channel, (string) $account->account_id, $message), $messages);
        });

        foreach ($results as $result) {
            if ($result['status'] === 'recibido') {
                ProcessInboundMessage::dispatch($result['event'], $tenantId);
            }
        }

        return array_map(fn (array $result): array => ['external_event_id' => $result['external_event_id'], 'status' => $result['status']], $results);
    }

    private function record(string $channel, string $accountId, array $message): array
    {
        $externalId = Str::limit((string) $message['external_id'], 190, '');
        $payload = json_encode(['account_id' => $accountId, 'message' => $message], JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
        $id = (string) Str::uuid7();
        $inserted = DB::table('collab_inbound_events')->insertOrIgnore(['id' => $id, 'channel' => $channel, 'external_event_id' => $externalId, 'payload' => $payload, 'status' => 'recibido']);

        if ($inserted === 1) {
            return ['event' => $id, 'external_event_id' => $externalId, 'status' => 'recibido'];
        }

        $previous = DB::table('collab_inbound_events')->where('channel', $channel)->where('external_event_id', $externalId)->lockForUpdate()->first(['id', 'status']);

        if ($previous !== null && $previous->status === 'error') {
            DB::table('collab_inbound_events')->where('id', $previous->id)->update(['status' => 'recibido', 'payload' => $payload, 'error' => null, 'received_at' => now()]);

            return ['event' => (string) $previous->id, 'external_event_id' => $externalId, 'status' => 'recibido'];
        }

        return ['event' => $previous?->id, 'external_event_id' => $externalId, 'status' => 'duplicado'];
    }
}
