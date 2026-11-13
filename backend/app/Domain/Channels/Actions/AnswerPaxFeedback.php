<?php

declare(strict_types=1);

namespace App\Domain\Channels\Actions;

use App\Domain\Admin\Actions\ManagePaxMessages;
use App\Domain\Admin\Actions\PaxMessageScheduler;
use App\Domain\Channels\Support\ChannelKit;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class AnswerPaxFeedback
{
    public function __construct(private readonly AuditLogger $audit, private readonly ChannelKit $kit) {}

    public function reply(string $code, string $text, User $actor): void
    {
        $row = $this->kit->row('channel_pax_feedback', $code, ['id', 'status']);

        if ($row->status === 'derivado') {
            throw ApiException::conflict('PAX-FB-02', 'El comentario ya se derivó a una incidencia; la respuesta se da desde la incidencia.');
        }

        DB::table('channel_pax_feedback')->where('id', $row->id)->update([
            'reply' => $text,
            'status' => 'respondido',
            'replied_at' => now(),
            'replied_by' => $actor->getKey(),
            'updated_by' => $actor->getKey(),
            'updated_at' => now(),
        ]);
        $this->audit->log('Comentario del pasajero', $code, 'responder', $row->status, 'respondido');
    }

    public function respond(string $code, string $channel, string $text, string $status, User $actor): array
    {
        $scheduler = app(PaxMessageScheduler::class);

        return DB::transaction(function () use ($code, $channel, $text, $status, $actor, $scheduler): array {
            $feedback = DB::table('channel_pax_feedback')->where('code', $code)->lock('for no key update')->first() ?? throw ApiException::notFound();

            if ($feedback->status === 'derivado') {
                throw ApiException::conflict('PAX-FB-02', 'El comentario ya se derivó a una incidencia; la respuesta se da desde la incidencia.');
            }

            if ($status === 'leido' && ! in_array($feedback->status, ['nuevo', 'leido'], true)) {
                throw ApiException::conflict('PAX-FB-03', 'Un comentario ya respondido no vuelve a quedar en seguimiento.');
            }

            $reservationCode = (string) DB::table('booking_reservations')->where('id', $feedback->reservation_id)->value('code');
            $reservation = $scheduler->reservation($reservationCode) ?? throw ApiException::notFound('La reserva del comentario no existe.');
            $recipient = match ($channel) {
                'email' => $feedback->contact_email ?: $scheduler->recipient('email', $reservation),
                'whatsapp' => $feedback->contact_phone ?: $scheduler->recipient('whatsapp', $reservation),
                default => $scheduler->recipient('portal', $reservation),
            } ?? throw ApiException::unprocessable('MSG-03', 'El pasajero no tiene un contacto para ese canal.');
            $now = now();

            DB::table('channel_pax_feedback')->where('id', $feedback->id)->update([
                'reply' => $text,
                'status' => $status,
                'replied_at' => $now,
                'replied_by' => $actor->getKey(),
                'updated_by' => $actor->getKey(),
                'updated_at' => $now,
            ]);
            $message = app(ManagePaxMessages::class)->feedbackReply($feedback, $reservation, $channel, (string) $recipient, $text, $actor);
            $conversation = $feedback->conversation_id ? $this->answerConversation((string) $feedback->conversation_id, $text, $status === 'respondido', $actor) : null;
            $this->audit->log('Comentario del pasajero', $code, 'responder', $feedback->status, "{$status} · {$channel}");

            return ['code' => $code, 'status' => $status, 'message' => $message, 'conversation' => $conversation];
        });
    }

    public function markRead(string $code, User $actor): void
    {
        $row = $this->kit->row('channel_pax_feedback', $code, ['id', 'status']);

        if ($row->status !== 'nuevo') {
            throw ApiException::conflict('PAX-FB-01', 'Solo un comentario nuevo se marca como leído.');
        }

        DB::table('channel_pax_feedback')->where('id', $row->id)->update(['status' => 'leido', 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
        $this->audit->log('Comentario del pasajero', $code, 'marcar_leido', $row->status, 'leido');
    }

    private function answerConversation(string $conversationId, string $text, bool $resolve, User $actor): ?string
    {
        $conversation = DB::table('collab_conversations')->where('id', $conversationId)->first(['id', 'code', 'channel', 'status', 'first_response_at']);

        if ($conversation === null) {
            return null;
        }

        $now = now();
        DB::table('collab_messages')->insert([
            'id' => (string) Str::uuid7(),
            'conversation_id' => $conversation->id,
            'channel' => $conversation->channel,
            'direction' => 'out',
            'author_user_id' => $actor->getKey(),
            'body' => $text,
            'delivery_status' => 'enviado',
            'sent_at' => $now,
            'created_by' => $actor->getKey(),
        ]);
        $status = $resolve ? 'resuelta' : ($conversation->status === 'resuelta' ? 'resuelta' : 'pendiente');
        DB::table('collab_conversations')->where('id', $conversation->id)->update([
            'status' => $status,
            'first_response_at' => $conversation->first_response_at ?? $now,
            'last_message_at' => $now,
            'unread_count' => 0,
            'resolved_at' => $status === 'resuelta' ? $now : null,
            'resolved_by' => $status === 'resuelta' ? $actor->getKey() : null,
            'lock_version' => DB::raw('lock_version + 1'),
            'updated_by' => $actor->getKey(),
            'updated_at' => $now,
        ]);
        $this->audit->log('Conversación', (string) $conversation->code, $resolve ? 'responder_y_resolver' : 'responder', $conversation->status, $status);

        return (string) $conversation->code;
    }
}
