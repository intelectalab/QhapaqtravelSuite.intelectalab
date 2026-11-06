<?php

declare(strict_types=1);

namespace Database\Seeders\Modules;

use App\Domain\Platform\Models\Tenant;
use Database\Support\KitSeeds;
use Database\Support\SeedsTenant;
use Illuminate\Support\Carbon;

final class ChannelsReviewsSeeder
{
    use SeedsTenant;

    public function __construct(private readonly Tenant $tenant) {}

    protected function tenant(): Tenant
    {
        return $this->tenant;
    }

    public function run(): void
    {
        $this->external();
        $requests = $this->requests();
        $this->own($requests);
    }

    private function external(): void
    {
        $sources = [];

        foreach (KitSeeds::read('reviewIntegrations') as $seed) {
            $mask = preg_replace('/[^0-9a-zA-Z]/', '', (string) ($seed['keyMask'] ?? ''));
            $sources[$seed['id']] = $this->upsert('integration_review_sources', ['provider' => $seed['id']], [
                'status' => $seed['status'],
                'account_ref' => ($seed['account'] ?? '') !== '' ? $seed['account'] : null,
                'secret_last4' => strlen($mask) >= 4 ? substr($mask, -4) : null,
                'scopes' => '{'.implode(',', $seed['scopes'] ?? []).'}',
                'can_reply' => (bool) $seed['canReply'],
                'supports_invites' => (bool) $seed['invites'],
                'rating' => $seed['rating'],
                'review_count' => (int) ($seed['count'] ?? 0),
                'last_sync_at' => $this->moment($seed['lastSync']),
                'connected_at' => $this->moment($seed['connectedAt']),
                'connected_by' => $seed['connectedBy'] ? $this->userId($seed['connectedBy']) : null,
                'created_by' => $this->userId('U01'),
            ]);
        }

        foreach (KitSeeds::read('externalReviews') as $seed) {
            if (! isset($sources[$seed['source']])) {
                continue;
            }

            $this->upsert('channel_external_reviews', ['source_id' => $sources[$seed['source']], 'external_id' => $seed['id']], [
                'author_display' => $seed['author'],
                'review_date' => $this->day($seed['date']),
                'rating' => $seed['rating'],
                'title' => $seed['title'] ?? null,
                'body' => $seed['text'] ?? null,
                'lang' => isset($seed['lang']) ? mb_strtolower($seed['lang']) : null,
                'product_id' => $this->idByCode('catalog_products', $seed['productId'], 'ref'),
                'url' => $seed['url'] ?? null,
                'response_status' => $seed['responseStatus'],
                'reply' => ($seed['reply'] ?? '') !== '' ? $seed['reply'] : null,
                'replied_at' => $this->moment($seed['repliedAt'] ?? null),
                'replied_by' => ($seed['repliedBy'] ?? null) ? $this->userId($seed['repliedBy']) : null,
                'raw' => json_encode(['source_label' => $seed['_src'] ?? null, 'sample' => (bool) ($seed['sample'] ?? false)], JSON_UNESCAPED_UNICODE),
                'created_at' => $this->moment($seed['date'].' 08:00'),
            ]);
        }
    }

    private function requests(): array
    {
        $settings = KitSeeds::read('ownReviewSettings');
        $expireDays = (int) ($settings['invite']['expireDays'] ?? 30);
        $byReview = [];

        foreach (KitSeeds::read('ownReviewRequests') as $seed) {
            $reservationId = $this->idByCode('booking_reservations', $seed['resId']);
            $clientId = $this->idByCode('crm_clients', $seed['clientId']);

            if ($reservationId === null || $clientId === null) {
                continue;
            }

            $id = $this->upsert('crm_review_requests', ['code' => $seed['id']], [
                'reservation_id' => $reservationId,
                'client_id' => $clientId,
                'to_address' => $seed['to'],
                'channel' => $seed['channel'],
                'lang' => $seed['lang'],
                'token_hash' => hash('sha256', $this->tenant->getKey().$seed['id']),
                'scheduled_at' => $this->moment($seed['scheduledAt']),
                'sent_at' => $this->moment($seed['sentAt']),
                'opened_at' => $this->moment($seed['openedAt']),
                'expires_at' => $seed['sentAt'] ? Carbon::parse($this->moment($seed['sentAt']))->addDays($expireDays)->toIso8601String() : null,
                'status' => $seed['status'],
                'is_demo' => (bool) ($seed['isDemo'] ?? false),
                'created_by' => $this->userId('U01'),
                'created_at' => $this->moment($seed['scheduledAt']),
            ]);

            foreach ($seed['reviewIds'] ?? [] as $reviewCode) {
                $byReview[$reviewCode] = $id;
            }
        }

        return $byReview;
    }

    private function own(array $requests): void
    {
        foreach (KitSeeds::read('ownReviews') as $seed) {
            $reservationId = $this->idByCode('booking_reservations', $seed['resId']);
            $productId = $this->idByCode('catalog_products', $seed['productId'], 'ref');
            $clientId = $this->idByCode('crm_clients', $seed['clientId']);

            if ($reservationId === null || $productId === null || $clientId === null) {
                continue;
            }

            $reply = $seed['reply'] ?? null;
            $published = $seed['status'] === 'publicada';
            $id = $this->upsert('crm_own_reviews', ['code' => $seed['id']], [
                'reservation_id' => $reservationId,
                'product_id' => $productId,
                'client_id' => $clientId,
                'author_display' => $seed['author'],
                'author_name' => $seed['authorName'],
                'country' => $seed['country'] ?? null,
                'travel_date' => $this->day($seed['travelDate']),
                'stars' => $seed['stars'],
                'subratings' => json_encode($seed['subratings'] ?? (object) []),
                'title' => $seed['title'],
                'body' => $seed['text'],
                'photos' => json_encode($seed['photos'] ?? []),
                'lang' => $seed['lang'],
                'verified' => (bool) ($seed['verified'] ?? true),
                'consent_publish' => true,
                'status' => $seed['status'],
                'moderation_reason' => ($seed['moderationReason'] ?? '') !== '' ? $seed['moderationReason'] : null,
                'reply_text' => $reply['text'] ?? null,
                'reply_by' => isset($reply['by']) ? $this->userId($reply['by']) : null,
                'replied_at' => $this->moment($reply['at'] ?? null),
                'helpful_count' => (int) ($seed['helpful'] ?? 0),
                'source' => $seed['source'],
                'request_id' => $requests[$seed['id']] ?? null,
                'is_demo' => (bool) ($seed['isDemo'] ?? false),
                'published_at' => $published ? $this->moment($seed['publishedAt'] ?? $seed['createdAt']) : null,
                'created_at' => $this->moment($seed['createdAt']),
                'updated_at' => $this->moment($seed['publishedAt'] ?? $seed['createdAt']),
            ]);

            $this->upsert('crm_own_review_log', ['review_id' => $id, 'action' => 'crear'], [
                'note' => 'Recibida desde '.$seed['source'],
                'created_at' => $this->moment($seed['createdAt']),
            ]);

            foreach ($seed['log'] ?? [] as $entry) {
                $action = match (true) {
                    str_contains($entry['m'], 'Publicada') => 'publicar',
                    str_contains($entry['m'], 'Rechaz') => 'rechazar',
                    str_contains($entry['m'], 'Oculta') => 'ocultar',
                    str_contains($entry['m'], 'espuesta') => 'responder',
                    default => null,
                };

                if ($action !== null) {
                    $this->upsert('crm_own_review_log', ['review_id' => $id, 'action' => $action], [
                        'note' => $entry['m'],
                        'user_id' => $this->userId($entry['u']),
                        'created_at' => $this->moment($entry['ts']),
                    ]);
                }
            }
        }
    }
}
