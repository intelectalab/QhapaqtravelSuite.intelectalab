<?php

declare(strict_types=1);

namespace App\Domain\Portal\Support;

use App\Domain\Admin\Support\StaffNotices;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

final class PassengerNotices
{
    public function __construct(private readonly StaffNotices $notices) {}

    public function recipients(?string $reservationId): Collection
    {
        if ($reservationId === null) {
            return collect();
        }

        $clientId = DB::table('booking_reservations')->where('id', $reservationId)->value('client_id');

        return DB::table('iam_users')->whereNull('deleted_at')->where('status', 'activo')
            ->where(fn ($query) => $query->where('reservation_id', $reservationId)->when($clientId, fn ($inner) => $inner->orWhere(fn ($client) => $client->where('client_id', $clientId)->whereNull('reservation_id'))))
            ->pluck('id')->map(fn (mixed $id): string => (string) $id);
    }

    public function send(?string $reservationId, string $event, string $subject, string $body, string $sourceType, ?string $sourceId): int
    {
        $users = $this->recipients($reservationId);

        return $users->isEmpty() ? 0 : $this->notices->toUsers($users, $event, $subject, $body, $sourceType, $sourceId, $reservationId);
    }
}
