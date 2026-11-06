<?php

declare(strict_types=1);

namespace Database\Seeders\Modules;

use App\Domain\Operations\Support\RoomTypes;
use App\Domain\Platform\Models\Tenant;
use Database\Support\KitSeeds;
use Database\Support\SeedsTenant;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

final class OperationsRoomingSeeder
{
    use SeedsTenant;

    public function __construct(private readonly Tenant $tenant) {}

    protected function tenant(): Tenant
    {
        return $this->tenant;
    }

    protected function shift(): int
    {
        return $this->shiftDays ??= OperationsTimeline::shift($this->tenant) ?? (int) Carbon::parse(self::KIT_TODAY)->diffInDays(Carbon::today(), false);
    }

    public function run(): void
    {
        foreach (KitSeeds::read('rooming') as $seed) {
            $reservationId = $this->idByCode('booking_reservations', $seed['resId']);
            $hotelId = $this->idByCode('catalog_providers', $seed['hotel'], 'ref');

            if ($reservationId === null || $hotelId === null) {
                continue;
            }

            $status = match ($seed['status'] ?? 'borrador') {
                'enviado' => 'enviada',
                default => $seed['status'] ?? 'borrador',
            };
            $checkIn = $this->day($seed['checkIn']);
            $checkOut = $this->day($seed['checkOut']);
            $stay = "[{$checkIn},{$checkOut})";
            $listId = $this->upsert('ops_rooming_lists', ['reservation_id' => $reservationId, 'hotel_provider_id' => $hotelId], [
                'source' => 'manual',
                'check_in' => $checkIn,
                'check_out' => $checkOut,
                'status' => $status,
                'sent_at' => $status === 'enviada' ? $this->moment(Carbon::parse($seed['checkIn'])->subDays(5)->toDateString().' 09:00') : null,
                'sent_by' => $status === 'enviada' ? $this->userId('U06') : null,
                'sent_version' => $status === 'enviada' ? 1 : 0,
                'created_by' => $this->userId('U05'),
                'deleted_at' => null,
            ]);
            $passengers = DB::table('booking_passengers')->where('reservation_id', $reservationId)->pluck('id', 'full_name');
            $observation = DB::table('ops_incidents')->where('reservation_id', $reservationId)->where('type', 'Proveedor')->first(['id', 'description']);

            foreach ($seed['rooms'] as $room) {
                $observed = $room['status'] === 'observada';
                $roomId = $this->upsert('ops_rooming_rooms', ['rooming_list_id' => $listId, 'room_number' => $room['room']], [
                    'hotel_provider_id' => $hotelId,
                    'stay' => $stay,
                    'room_type' => $room['type'],
                    'capacity' => RoomTypes::capacity($room['type']),
                    'status' => $room['status'],
                    'hotel_note' => $observed ? $observation?->description : null,
                    'incident_id' => $observed ? $observation?->id : null,
                ]);

                foreach ($room['pax'] as $name) {
                    $passengerId = $passengers[$name] ?? null;

                    if ($passengerId === null) {
                        continue;
                    }

                    $this->upsert('ops_rooming_guests', ['rooming_list_id' => $listId, 'passenger_id' => $passengerId], [
                        'room_id' => $roomId,
                        'stay' => $stay,
                    ]);
                }
            }
        }
    }
}
