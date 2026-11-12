<?php

declare(strict_types=1);

namespace App\Domain\Channels\Actions;

use App\Domain\Iam\Models\User;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Support\Facades\DB;

final class ReplyExternalReview
{
    public function __construct(private readonly AuditLogger $audit) {}

    public function reply(string $id, string $text, User $actor): void
    {
        $review = $this->find($id);

        if ($review->response_status === 'publicada') {
            throw ApiException::conflict('REV-BR-04', 'La respuesta ya está publicada y no se cambia.');
        }

        $target = $review->response_status === 'no_admite' ? 'no_admite' : 'pendiente_publicar';

        DB::table('channel_external_reviews')->where('id', $id)->update([
            'reply' => $text,
            'response_status' => $target,
            'replied_at' => now(),
            'replied_by' => $actor->getKey(),
            'updated_by' => $actor->getKey(),
            'updated_at' => now(),
        ]);
        $this->audit->log('Reseña externa', $review->external_id, 'responder', $review->response_status, $target);
    }

    public function markPublished(string $id, User $actor): void
    {
        $review = $this->find($id);

        if (blank($review->reply)) {
            throw ApiException::conflict('REV-BR-03', 'Primero guarda la respuesta.');
        }

        if ($review->response_status === 'publicada') {
            throw ApiException::conflict('REV-BR-04', 'La respuesta ya figura como publicada.');
        }

        DB::table('channel_external_reviews')->where('id', $id)->update(['response_status' => 'publicada', 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
        $this->audit->log('Reseña externa', $review->external_id, 'marcar_publicada', $review->response_status, 'publicada');
    }

    private function find(string $id): object
    {
        $review = DB::table('channel_external_reviews')->where('id', $id)->first(['external_id', 'response_status', 'reply']);

        if ($review === null) {
            throw ApiException::notFound('La reseña no existe.');
        }

        return $review;
    }
}
