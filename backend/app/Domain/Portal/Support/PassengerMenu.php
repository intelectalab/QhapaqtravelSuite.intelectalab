<?php

declare(strict_types=1);

namespace App\Domain\Portal\Support;

use App\Domain\Booking\Rules\RuleResolver;
use App\Domain\Channels\Support\OwnReviewIntake;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Support\Facades\DB;
use stdClass;

final class PassengerMenu
{
    public function __construct(private readonly PassengerTrip $trips, private readonly RuleResolver $rules) {}

    public function for(PortalAccount $account): ?array
    {
        try {
            $reservation = $this->trips->reservation($account);
        } catch (ApiException) {
            return null;
        }

        $messages = $this->rules->on('R-PAX-MESSAGES');
        $companions = $this->rules->on('R-COMPANIONS');
        $reviews = $this->rules->on('R-OWN-REVIEWS');
        $alerts = $this->trips->incidents($reservation)->reject(fn (stdClass $row): bool => (bool) $row->acked);
        $critical = $alerts->sortBy(fn (stdClass $row): int => array_search($row->severity, ['critica', 'alta', 'media', 'baja'], true) ?: 0)->first();
        $full = DB::table('booking_reservations')->where('id', $reservation->id)->first(['id', 'code', 'title', 'status', 'travel_from']);

        return [
            'trip' => $reservation->code,
            'sections' => [
                'messages' => $messages,
                'feedback' => $this->rules->on('R-PAX-FEEDBACK'),
                'companions' => $companions,
                'reviews' => $reviews,
            ],
            'counts' => [
                'messages' => $messages ? $this->unread((string) $reservation->id) : 0,
                'companions' => $companions ? DB::table('booking_passengers')->where('reservation_id', $reservation->id)->where(fn ($query) => $query->where('pending', true)->orWhere('is_placeholder', true))->count() : 0,
                'reviews' => $reviews && $full !== null ? count(array_filter(OwnReviewIntake::items($full, (string) $account->user->getKey()), fn (array $item): bool => $item['eligible'])) : 0,
                'alerts' => $alerts->count(),
            ],
            'alert' => $critical ? ['code' => $critical->code, 'severity' => $critical->severity, 'title' => $critical->public_title ?: $critical->title] : null,
        ];
    }

    private function unread(string $reservationId): int
    {
        return DB::table('channel_trip_messages')->where('reservation_id', $reservationId)->where('sender_type', '<>', 'passenger')->whereNull('read_at')->count()
            + DB::table('notif_pax_messages')->where('reservation_id', $reservationId)->whereIn('status', ['enviado', 'entregado'])->count();
    }
}
