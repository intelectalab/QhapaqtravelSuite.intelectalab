<?php

declare(strict_types=1);

namespace App\Domain\Portal\Actions;

use App\Domain\Crm\Support\CodeSequence;
use App\Domain\Portal\Support\PortalAccount;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class PortalMessages
{
    private const DEFAULT_SLA_MINUTES = 240;

    public function __construct(private readonly CodeSequence $sequence, private readonly AuditLogger $audit) {}

    public function send(PortalAccount $account, array $data): string
    {
        $reservation = ! empty($data['trip']) ? $account->reservation($data['trip']) : ($account->isPassenger() ? $account->reservations()->first() : null);
        $user = $account->user;

        return DB::transaction(function () use ($account, $data, $reservation, $user): string {
            $now = now();
            $conversation = ! empty($data['conversation'])
                ? DB::table('collab_conversations')->where('code', $data['conversation'])->where('channel', 'portal')->where('client_id', $account->client->id)
                    ->when($account->reservationId, fn ($query) => $query->where('reservation_id', $account->reservationId))->lockForUpdate()->first(['id', 'code', 'status', 'unread_count'])
                    ?? throw ApiException::notFound('No encontramos esa conversación en tu cuenta.')
                : null;

            if ($conversation === null) {
                $sla = (int) (DB::table('collab_channel_accounts')->where('channel', 'portal')->where('status', 'activo')->value('first_response_sla_minutes') ?: self::DEFAULT_SLA_MINUTES);
                $code = $this->sequence->next('collab_conversations', 'CNV-');
                $id = (string) DB::table('collab_conversations')->insertGetId([
                    'code' => $code,
                    'channel' => 'portal',
                    'contact_name' => $user->name,
                    'contact_email' => $user->email,
                    'contact_phone' => $account->client->phone,
                    'subject' => Str::limit(trim((string) ($data['subject'] ?? '')) ?: ($reservation ? "Consulta sobre {$reservation->title}" : 'Consulta desde el portal'), 180, ''),
                    'status' => 'abierta',
                    'priority' => ($data['topic'] ?? null) === 'salud' ? 'alta' : 'media',
                    'assignee_id' => $account->advisorId(),
                    'client_id' => $account->client->id,
                    'reservation_id' => $reservation?->id,
                    'first_response_due_at' => $now->copy()->addMinutes($sla),
                    'last_inbound_at' => $now,
                    'last_message_at' => $now,
                    'unread_count' => 1,
                    'created_by' => $user->getKey(),
                    'updated_by' => $user->getKey(),
                ], 'id');
                $before = null;
            } else {
                $id = (string) $conversation->id;
                $code = $conversation->code;
                $before = $conversation->status;
                DB::table('collab_conversations')->where('id', $id)->update(['status' => 'abierta', 'last_inbound_at' => $now, 'last_message_at' => $now, 'unread_count' => (int) $conversation->unread_count + 1, 'resolved_at' => null, 'resolved_by' => null, 'updated_by' => $user->getKey(), 'updated_at' => $now]);
            }

            DB::table('collab_messages')->insert([
                'id' => (string) Str::uuid7(),
                'conversation_id' => $id,
                'channel' => 'portal',
                'direction' => 'in',
                'author_user_id' => $user->getKey(),
                'body' => $data['body'],
                'sent_at' => $now,
                'created_by' => $user->getKey(),
            ]);
            $this->audit->log('Conversación', $code, 'mensaje_portal', $before, 'abierta');

            return $code;
        });
    }
}
