<?php

declare(strict_types=1);

namespace Database\Seeders\Modules;

use App\Domain\Platform\Models\Tenant;
use Database\Support\KitSeeds;
use Database\Support\SeedsTenant;
use Illuminate\Support\Facades\DB;

final class ChannelsPortalsSeeder
{
    use SeedsTenant;

    public function __construct(private readonly Tenant $tenant) {}

    protected function tenant(): Tenant
    {
        return $this->tenant;
    }

    public function run(): void
    {
        $feedback = $this->feedback();
        $this->messages($feedback);
        $this->wishlists();
    }

    private function feedback(): array
    {
        $ids = [];

        foreach (KitSeeds::read('paxFeedback') as $seed) {
            $reservationId = $this->idByCode('booking_reservations', $seed['resId']);

            if ($reservationId === null) {
                continue;
            }

            $ids[$seed['id']] = $this->upsert('channel_pax_feedback', ['code' => $seed['id']], [
                'reservation_id' => $reservationId,
                'passenger_name' => $seed['passenger'],
                'type' => $seed['type'],
                'rating' => $seed['rating'],
                'reservation_service_id' => $this->idByCode('booking_reservation_services', $seed['serviceId']),
                'text' => $seed['text'],
                'status' => $seed['status'],
                'reply' => $seed['reply'],
                'replied_at' => $this->moment($seed['repliedAt']),
                'replied_by' => $seed['repliedBy'] ? $this->userId($seed['repliedBy']) : null,
                'channel' => $seed['channel'] ?? null,
                'contact_email' => $seed['contact']['email'] ?? null,
                'contact_phone' => $seed['contact']['phone'] ?? null,
                'created_at' => $this->moment($seed['createdAt']),
                'updated_at' => $this->moment($seed['repliedAt'] ?? $seed['createdAt']),
            ]);
        }

        return $ids;
    }

    private function messages(array $feedback): void
    {
        foreach (KitSeeds::read('paxMessages') as $seed) {
            $reservationId = $this->idByCode('booking_reservations', $seed['resId'] ?? null);
            $status = $seed['status'];
            $sent = $this->moment($seed['sentAt'] ?? null);

            $this->upsert('notif_pax_messages', ['code' => $seed['id']], [
                'reservation_id' => $reservationId,
                'template_id' => $this->idByCode('notif_pax_message_templates', $seed['templateId'] ?? null),
                'feedback_id' => isset($seed['feedbackId']) ? ($feedback[$seed['feedbackId']] ?? null) : null,
                'channel' => $seed['channel'],
                'recipient' => $seed['to'],
                'subject' => $seed['subject'] ?? null,
                'body' => $seed['body'] ?? null,
                'status' => $status,
                'direction' => $seed['direction'] ?? 'saliente',
                'origin' => ($seed['auto'] ?? true) ? 'auto' : 'manual',
                'scheduled_at' => $this->moment($seed['scheduledAt'] ?? null),
                'sent_at' => $sent,
                'delivered_at' => in_array($status, ['entregado', 'leido'], true) ? $sent : null,
                'read_at' => $this->moment($seed['readAt'] ?? null),
                'attempts' => (int) ($seed['attempts'] ?? 0),
                'error' => $seed['error'] ?? null,
                'lang' => mb_strtoupper($seed['lang'] ?? 'ES'),
                'created_at' => $this->moment($seed['scheduledAt'] ?? $seed['sentAt'] ?? null) ?? now(),
            ]);
        }
    }

    private function wishlists(): void
    {
        foreach (KitSeeds::read('wishlists') as $clientCode => $products) {
            $clientId = $this->idByCode('crm_clients', $clientCode);

            foreach ($clientId ? $products : [] as $productCode) {
                $productId = $this->idByCode('catalog_products', $productCode, 'ref');

                if ($productId !== null) {
                    DB::table('channel_wishlist_items')->insertOrIgnore([
                        'tenant_id' => $this->tenant->getKey(),
                        'crm_client_id' => $clientId,
                        'product_id' => $productId,
                    ]);
                }
            }
        }
    }
}
