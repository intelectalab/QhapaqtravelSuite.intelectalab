<?php

declare(strict_types=1);

namespace Database\Seeders\Modules;

use App\Domain\Platform\Models\Tenant;
use Database\Support\KitSeeds;
use Database\Support\SeedsTenant;
use Illuminate\Support\Facades\DB;

final class MobileAppsSeeder
{
    use SeedsTenant;

    private const CHAT_RESERVATION = 'RES-2026-000347';

    public function __construct(private readonly Tenant $tenant) {}

    protected function tenant(): Tenant
    {
        return $this->tenant;
    }

    public function run(): void
    {
        $reservationId = $this->idByCode('booking_reservations', self::CHAT_RESERVATION);

        if ($reservationId === null) {
            return;
        }

        $staff = DB::table('iam_users')->where('tenant_id', $this->tenant->getKey())->pluck('id', 'name');

        foreach (KitSeeds::read('paxApp')['chat'] ?? [] as $message) {
            $agency = $message['from'] === 'agency';
            $sender = $agency ? $staff->first(fn ($id, string $name): bool => str_starts_with((string) ($message['who'] ?? ''), implode(' ', array_slice(explode(' ', $name), 0, 2)))) : null;

            $this->upsert('channel_trip_messages', ['reservation_id' => $reservationId, 'created_at' => $this->moment($message['ts'])], [
                'sender_type' => $agency ? 'agency' : 'passenger',
                'sender_user_id' => $sender,
                'body' => $message['m'],
                'quick_reply' => false,
                'read_at' => $this->moment($message['ts']),
            ]);
        }
    }
}
