<?php

declare(strict_types=1);

namespace App\Domain\Channels\Actions;

use App\Domain\Channels\Support\ChannelKit;
use App\Domain\Channels\Support\OwnReviewSettings;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Support\Facades\DB;

final class ModerateOwnReview
{
    private const TARGETS = ['publicar' => 'publicada', 'ocultar' => 'oculta', 'rechazar' => 'rechazada'];

    public function __construct(private readonly AuditLogger $audit, private readonly ChannelKit $kit) {}

    public function moderate(string $code, string $action, ?string $reason, User $actor): void
    {
        $review = $this->kit->row('crm_own_reviews', $code, ['id', 'status', 'consent_publish', 'lock_version']);
        $target = self::TARGETS[$action];

        if ($review->status === $target) {
            throw ApiException::conflict('RVW-00', 'La reseña ya está en ese estado.');
        }

        if ($target === 'publicada' && ! $review->consent_publish) {
            throw ApiException::unprocessable('RVW-05', 'El viajero no autorizó publicar esta reseña.');
        }

        if ($target !== 'publicada' && blank($reason)) {
            throw ApiException::unprocessable('RVW-07', 'Indica el motivo.');
        }

        DB::table('crm_own_reviews')->where('id', $review->id)->update([
            'status' => $target,
            'moderation_reason' => $target === 'publicada' ? null : $reason,
            'published_at' => $target === 'publicada' ? now() : null,
            'moderated_by' => $actor->getKey(),
            'lock_version' => $review->lock_version + 1,
            'updated_by' => $actor->getKey(),
            'updated_at' => now(),
        ]);
        $this->log($review->id, $action, $reason, $actor);
        $this->audit->log('Reseña propia', $code, $action, $review->status, trim($target.($reason ? " · {$reason}" : '')));
    }

    public function reply(string $code, string $text, User $actor): void
    {
        $review = $this->kit->row('crm_own_reviews', $code, ['id', 'reply_text', 'lock_version']);

        if (preg_match('/[\w.+-]+@[\w-]+\.[\w.]+|\b\d{3}[\s-]?\d{3}[\s-]?\d{3}\b/u', $text) === 1) {
            throw ApiException::unprocessable('RVW-08', 'La respuesta pública no puede incluir correos ni teléfonos.');
        }

        DB::table('crm_own_reviews')->where('id', $review->id)->update([
            'reply_text' => $text,
            'reply_by' => $actor->getKey(),
            'replied_at' => now(),
            'lock_version' => $review->lock_version + 1,
            'updated_by' => $actor->getKey(),
            'updated_at' => now(),
        ]);
        $action = $review->reply_text ? 'editar_respuesta' : 'responder';
        $this->log($review->id, $action, null, $actor);
        $this->audit->log('Reseña propia', $code, $action, $review->reply_text, $text);
    }

    public function sendRequest(string $code, User $actor): void
    {
        $request = $this->kit->row('crm_review_requests', $code, ['id', 'status']);

        if (! in_array($request->status, ['programada', 'vencida', 'enviada'], true)) {
            throw ApiException::conflict('RVW-09', 'Esta solicitud ya fue abierta o respondida.');
        }

        DB::table('crm_review_requests')->where('id', $request->id)->update([
            'status' => 'enviada',
            'sent_at' => now(),
            'expires_at' => now()->addDays((int) OwnReviewSettings::read()['invite']['expire_days']),
            'reminded_at' => $request->status === 'programada' ? null : now(),
            'updated_by' => $actor->getKey(),
            'updated_at' => now(),
        ]);
        $this->audit->log('Solicitud de reseña', $code, 'enviar', $request->status, 'enviada');
    }

    public function cancelRequest(string $code, User $actor): void
    {
        $request = $this->kit->row('crm_review_requests', $code, ['id', 'status']);

        if ($request->status !== 'programada') {
            throw ApiException::conflict('RVW-09', 'Solo se cancelan solicitudes programadas.');
        }

        DB::table('crm_review_requests')->where('id', $request->id)->update(['status' => 'cancelada', 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
        $this->audit->log('Solicitud de reseña', $code, 'cancelar', $request->status, 'cancelada');
    }

    private function log(string $reviewId, string $action, ?string $note, User $actor): void
    {
        DB::table('crm_own_review_log')->insert(['review_id' => $reviewId, 'action' => $action, 'note' => $note, 'user_id' => $actor->getKey()]);
    }
}
