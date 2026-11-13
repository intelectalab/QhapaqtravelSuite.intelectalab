<?php

declare(strict_types=1);

namespace App\Domain\Channels\Actions;

use App\Domain\Channels\Support\ExternalReviewDirectory;
use App\Domain\Crm\Support\CodeSequence;
use App\Domain\Iam\Models\User;
use App\Domain\Inbox\Support\InboxNotices;
use App\Domain\Integrations\Contracts\ReviewsProvider;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Tenancy\TenantContext;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use stdClass;

final class ExternalReviewDesk
{
    public const ESCALATE_MAX_RATING = 3;

    public function __construct(
        private readonly ReplyExternalReview $replies,
        private readonly ReviewsProvider $provider,
        private readonly CodeSequence $codes,
        private readonly AuditLogger $audit,
        private readonly TenantContext $context,
    ) {}

    public function reply(string $id, string $text, User $actor): array
    {
        $this->replies->reply($id, $text, $actor);
        $review = $this->find($id);

        if ($review->status === 'conectado' && (bool) $review->can_reply && $review->response_status === 'pendiente_publicar') {
            $result = $this->provider->reply(['provider' => $review->provider, 'account' => $review->account_ref], (string) $review->external_id, $text);

            if ($result->ok) {
                DB::table('channel_external_reviews')->where('id', $id)->update(['response_status' => 'publicada', 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
                $this->audit->log('Reseña externa', (string) $review->external_id, 'publicar_api', 'pendiente_publicar', 'publicada');
            }
        }

        $fresh = $this->find($id);

        return ['id' => $id, 'status' => $fresh->response_status, 'reply' => $fresh->reply, 'replied_at' => $fresh->replied_at, 'published_by_api' => $fresh->response_status === 'publicada'];
    }

    public function escalate(string $id, ?string $note, User $actor): array
    {
        return DB::transaction(function () use ($id, $note, $actor): array {
            $review = $this->find($id, true);

            if ((int) $review->rating > self::ESCALATE_MAX_RATING) {
                throw ApiException::unprocessable('REV-BR-05', 'Solo se derivan a postventa las reseñas de 3 estrellas o menos.');
            }

            if ($review->conversation_id !== null) {
                $existing = DB::table('collab_conversations')->where('id', $review->conversation_id)->value('code');

                throw ApiException::conflict('REV-BR-06', "Esta reseña ya se derivó a postventa en la conversación {$existing}.", ['conversation' => $existing]);
            }

            $now = Carbon::now($this->context->timezone());
            $code = $this->codes->next('collab_conversations', 'CNV-');
            $conversation = (string) Str::uuid7();
            $source = ExternalReviewDirectory::PROVIDERS[$review->provider] ?? $review->provider;
            $body = trim(($review->title ? $review->title."\n\n" : '').($review->body ?? '')).($note ? "\n\nNota interna: ".trim($note) : '');

            DB::table('collab_conversations')->insert([
                'id' => $conversation,
                'tenant_id' => $this->context->idOrFail(),
                'code' => $code,
                'channel' => 'form',
                'contact_name' => mb_substr((string) $review->author_display, 0, 160),
                'subject' => Str::limit("Reseña de {$review->rating} estrellas en {$source}: ".($review->title ?? Str::limit((string) $review->body, 80)), 195),
                'status' => 'abierta',
                'priority' => (int) $review->rating <= 2 ? 'alta' : 'media',
                'tags' => '{Reseña,Postventa}',
                'first_response_due_at' => $now->copy()->addMinutes(120),
                'last_inbound_at' => $now,
                'last_message_at' => $now,
                'unread_count' => 1,
                'created_by' => $actor->getKey(),
                'updated_by' => $actor->getKey(),
            ]);
            DB::table('collab_messages')->insert([
                'id' => (string) Str::uuid7(),
                'tenant_id' => $this->context->idOrFail(),
                'conversation_id' => $conversation,
                'channel' => 'form',
                'direction' => 'in',
                'body' => $body !== '' ? $body : 'Reseña sin texto.',
                'sent_at' => $now,
            ]);
            DB::table('channel_external_reviews')->where('id', $id)->update(['conversation_id' => $conversation, 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
            $this->audit->log('Reseña externa', (string) $review->external_id, 'derivar_postventa', null, $code);
            app(InboxNotices::class)->created($conversation);

            return ['id' => $id, 'conversation' => $code];
        });
    }

    private function find(string $id, bool $lock = false): stdClass
    {
        if (! Str::isUuid($id)) {
            throw ApiException::notFound('La reseña no existe.');
        }

        $query = DB::table('channel_external_reviews as e')->join('integration_review_sources as s', 's.id', '=', 'e.source_id')->where('e.id', $id);
        $row = ($lock ? $query->lock('for no key update') : $query)
            ->first(['e.id', 'e.external_id', 'e.rating', 'e.title', 'e.body', 'e.author_display', 'e.response_status', 'e.reply', 'e.replied_at', 'e.conversation_id', 's.provider', 's.status', 's.can_reply', 's.account_ref']);

        if (! $row instanceof stdClass) {
            throw ApiException::notFound('La reseña no existe.');
        }

        return $row;
    }
}
