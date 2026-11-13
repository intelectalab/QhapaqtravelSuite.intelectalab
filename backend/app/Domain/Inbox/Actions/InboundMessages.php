<?php

declare(strict_types=1);

namespace App\Domain\Inbox\Actions;

use App\Domain\Crm\Support\CodeSequence;
use App\Domain\Inbox\Support\InboxNotices;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class InboundMessages
{
    private const TAGS = ['whatsapp' => '{WhatsApp}', 'email' => '{Correo}'];

    public function __construct(
        private readonly CodeSequence $codes,
        private readonly AuditLogger $audit,
        private readonly InboxNotices $notices,
        private readonly ConversationAttachments $attachments,
    ) {}

    public function receive(string $channel, string $accountId, array $message): array
    {
        $existing = DB::table('collab_messages')->where('channel', $channel)->where('external_message_id', $message['external_id'])->first(['conversation_id']);

        if ($existing !== null) {
            return ['conversation' => DB::table('collab_conversations')->where('id', $existing->conversation_id)->value('code'), 'created' => false, 'duplicate' => true];
        }

        $account = DB::table('collab_channel_accounts')->where('id', $accountId)->first(['id', 'first_response_sla_minutes']);
        $now = Carbon::now();
        $sentAt = isset($message['sent_at']) ? Carbon::parse($message['sent_at']) : $now;
        $conversation = $this->thread($channel, $accountId, $message);

        if ($conversation === null) {
            $id = $this->open($channel, $accountId, (int) ($account->first_response_sla_minutes ?? 240), $message, $now);
            $code = (string) DB::table('collab_conversations')->where('id', $id)->value('code');
            $before = null;
        } else {
            $id = (string) $conversation->id;
            $code = (string) $conversation->code;
            $before = (string) $conversation->status;
            DB::table('collab_conversations')->where('id', $id)->update([
                'status' => 'abierta',
                'last_inbound_at' => $now,
                'last_message_at' => $now,
                'unread_count' => (int) $conversation->unread_count + 1,
                'resolved_at' => null,
                'resolved_by' => null,
                'lock_version' => DB::raw('lock_version + 1'),
                'updated_at' => $now,
            ]);

            if ($before !== 'abierta') {
                DB::table('collab_messages')->insert(['id' => (string) Str::uuid7(), 'conversation_id' => $id, 'channel' => $channel, 'direction' => 'system', 'body' => 'La conversación se reabrió porque el cliente escribió de nuevo.', 'sent_at' => $now]);
            }
        }

        $messageId = (string) Str::uuid7();
        DB::table('collab_messages')->insert([
            'id' => $messageId,
            'conversation_id' => $id,
            'channel' => $channel,
            'direction' => 'in',
            'body' => $message['body'],
            'external_message_id' => $message['external_id'],
            'sent_at' => $sentAt,
        ]);
        $files = $this->attach($messageId, $code, (array) ($message['attachments'] ?? []));

        $this->audit->log('Conversación', $code, $before === null ? 'crear' : 'mensaje_entrante', $before, $before === null ? $channel : 'abierta');

        if ($files !== []) {
            $this->audit->log('Conversación', $code, 'adjuntar', null, implode(', ', $files));
        }

        $before === null ? $this->notices->created($id) : $this->notices->inbound($id);

        return ['conversation' => $code, 'created' => $before === null, 'duplicate' => false];
    }

    private function thread(string $channel, string $accountId, array $message): ?object
    {
        $columns = ['id', 'code', 'status', 'unread_count'];

        if ($channel === 'email') {
            $references = array_values(array_filter((array) ($message['references'] ?? [])));
            $previous = $references === [] ? null : DB::table('collab_messages')->where('channel', 'email')->whereIn('external_message_id', $references)->orderByDesc('sent_at')->value('conversation_id');

            return $previous === null ? null : DB::table('collab_conversations')->where('id', $previous)->lockForUpdate()->first($columns);
        }

        return DB::table('collab_conversations')->where('channel', $channel)->where('channel_account_id', $accountId)->where('external_thread_id', $message['thread_id'])
            ->orderByDesc('last_message_at')->lockForUpdate()->first($columns);
    }

    private function open(string $channel, string $accountId, int $sla, array $message, Carbon $now): string
    {
        $email = isset($message['contact_email']) ? Str::lower(trim((string) $message['contact_email'])) : null;
        $phone = (string) preg_replace('/\D+/', '', (string) ($message['contact_phone'] ?? ''));
        $phone = $phone === '' ? null : $phone;
        $client = $email !== null
            ? DB::table('crm_clients')->whereNull('deleted_at')->where('email_norm', $email)->value('id')
            : ($phone !== null && strlen($phone) >= 9 ? DB::table('crm_clients')->whereNull('deleted_at')->where('phone_norm', substr($phone, -9))->value('id') : null);
        $id = (string) Str::uuid7();

        DB::table('collab_conversations')->insert([
            'id' => $id,
            'code' => $this->codes->next('collab_conversations', 'CNV-'),
            'channel' => $channel,
            'channel_account_id' => $accountId,
            'external_thread_id' => Str::limit((string) $message['thread_id'], 190, ''),
            'contact_name' => Str::limit(trim((string) ($message['contact_name'] ?? '')) ?: ($email ?? ($phone !== null ? '+'.$phone : 'Contacto sin nombre')), 160, ''),
            'contact_email' => $email,
            'contact_phone' => $phone !== null ? Str::limit('+'.$phone, 30, '') : null,
            'subject' => Str::limit(trim((string) ($message['subject'] ?? '')) ?: Str::limit(trim((string) $message['body']), 120), 200, ''),
            'status' => 'abierta',
            'priority' => 'media',
            'tags' => self::TAGS[$channel] ?? '{}',
            'client_id' => $client,
            'first_response_due_at' => $now->copy()->addMinutes($sla),
            'last_inbound_at' => $now,
            'last_message_at' => $now,
            'unread_count' => 1,
        ]);

        return $id;
    }

    private function attach(string $messageId, string $code, array $files): array
    {
        $saved = [];

        foreach (array_slice($files, 0, ConversationAttachments::MAX_FILES) as $file) {
            try {
                $stored = $this->attachments->storeInbound((string) ($file['content'] ?? ''), (string) ($file['file_name'] ?? 'adjunto'), (string) ($file['mime'] ?? ''), $code);
            } catch (ApiException) {
                continue;
            }

            DB::table('collab_message_attachments')->insert([
                'id' => (string) Str::uuid7(),
                'message_id' => $messageId,
                'file_name' => $stored['file_name'],
                'mime' => $stored['mime'],
                'size_bytes' => $stored['size'],
                'storage_path' => $stored['path'],
                'sha256' => $stored['sha256'],
                'scan_status' => 'limpio',
            ]);
            $saved[] = $stored['file_name'];
        }

        return $saved;
    }
}
