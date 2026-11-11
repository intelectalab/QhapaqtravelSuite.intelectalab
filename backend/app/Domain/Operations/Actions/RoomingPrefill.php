<?php

declare(strict_types=1);

namespace App\Domain\Operations\Actions;

use App\Domain\Iam\Models\User;
use App\Domain\Operations\Support\RoomTypes;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class RoomingPrefill
{
    public function __construct(private readonly AuditLogger $audit) {}

    public function pending(string $reservationId): Collection
    {
        return $this->legs($reservationId)->reject(fn (array $leg): bool => $leg['exists'])->values();
    }

    public function run(string $reservationCode, User $actor): array
    {
        $reservation = DB::table('booking_reservations')->whereNull('deleted_at')->where('code', $reservationCode)->first(['id', 'code', 'status'])
            ?? throw ApiException::unprocessable('VALIDATION_ERROR', 'Elige una reserva.');

        if (in_array($reservation->status, ['cancelada', 'completada', 'borrador'], true)) {
            throw ApiException::unprocessable('OPS-BR-36', 'La reserva no admite rooming list en su estado actual.');
        }

        $legs = $this->pending($reservation->id);

        if ($legs->isEmpty()) {
            throw ApiException::conflict('OPS-V21-02', $this->legs($reservation->id)->isEmpty() ? 'La reserva web no trae alojamiento para prellenar.' : 'Las rooming lists de esta reserva ya existen.');
        }

        $passengers = DB::table('booking_passengers')->where('reservation_id', $reservation->id)->orderBy('seq')->get(['id', 'pax_type']);

        return DB::transaction(function () use ($reservation, $legs, $passengers, $actor): array {
            $created = [];

            foreach ($legs as $leg) {
                $id = (string) Str::uuid7();
                DB::table('ops_rooming_lists')->insert([
                    'id' => $id,
                    'reservation_id' => $reservation->id,
                    'hotel_provider_id' => $leg['provider_id'],
                    'leg_id' => $leg['leg'],
                    'city' => $leg['city'],
                    'hotel_name' => $leg['hotel'],
                    'source' => 'booking.lodging',
                    'check_in' => $leg['check_in'],
                    'check_out' => $leg['check_out'],
                    'status' => 'borrador',
                    'created_by' => $actor->getKey(),
                ]);
                $stay = "[{$leg['check_in']},{$leg['check_out']})";
                $lodged = DB::table('ops_rooming_guests')->whereIn('passenger_id', $passengers->pluck('id'))->whereRaw('stay && ?::daterange', [$stay])->pluck('passenger_id')->map(fn (mixed $id): string => (string) $id)->all();
                $rooms = $this->distribute($leg['rooms'], $passengers->reject(fn (object $passenger): bool => in_array((string) $passenger->id, $lodged, true)));

                foreach ($rooms as $index => $room) {
                    $roomId = (string) Str::uuid7();
                    DB::table('ops_rooming_rooms')->insert(['id' => $roomId, 'rooming_list_id' => $id, 'hotel_provider_id' => $leg['provider_id'], 'stay' => $stay, 'room_number' => $leg['prefix'].'-'.($index + 1), 'room_type' => $room['type'], 'capacity' => RoomTypes::capacity($room['type']), 'status' => 'pendiente', 'created_by' => $actor->getKey()]);

                    foreach ($room['guests'] as $passengerId) {
                        DB::table('ops_rooming_guests')->insert(['room_id' => $roomId, 'rooming_list_id' => $id, 'passenger_id' => $passengerId, 'stay' => $stay, 'created_by' => $actor->getKey()]);
                    }
                }

                $this->audit->log('Rooming list', $reservation->code, 'prellenar_reserva_web', null, "{$leg['city']} · {$leg['hotel']} · ".count($rooms).' hab.');
                $created[] = ['id' => $id, 'city' => $leg['city'], 'hotel' => $leg['hotel'], 'rooms' => count($rooms)];
            }

            return ['created' => $created];
        });
    }

    private function legs(string $reservationId): Collection
    {
        $snapshot = DB::table('booking_reservation_web_snapshots as w')->join('booking_reservations as r', 'r.id', '=', 'w.reservation_id')->where('w.reservation_id', $reservationId)->orderByDesc('w.created_at')->first(['w.id', 'w.service_date', 'r.travel_from']);

        if ($snapshot === null) {
            return collect();
        }

        $lines = DB::table('booking_reservation_web_lodging as l')->leftJoin('catalog_accommodation_hotels as h', 'h.id', '=', 'l.hotel_id')->where('l.snapshot_id', $snapshot->id)->orderBy('l.created_at')
            ->get(['l.leg_id', 'l.city', 'l.hotel_name', 'l.room_type', 'l.rooms', 'l.nights', 'h.provider_id']);
        $existing = DB::table('ops_rooming_lists')->where('reservation_id', $reservationId)->whereNull('deleted_at')->get(['leg_id', 'hotel_provider_id']);
        $offset = 0;
        $start = CarbonImmutable::parse($snapshot->service_date ?? $snapshot->travel_from);

        return $lines->groupBy(fn (object $line): string => (string) ($line->leg_id ?? $line->city))->map(function (Collection $group, string $leg) use (&$offset, $start, $existing): array {
            $first = $group->first();
            $nights = max(1, (int) $first->nights);
            $checkIn = $start->addDays($offset);
            $offset += $nights;
            $provider = $first->provider_id === null ? null : (string) $first->provider_id;

            return [
                'leg' => $leg,
                'city' => $first->city,
                'hotel' => $first->hotel_name,
                'provider_id' => $provider,
                'prefix' => Str::upper(Str::substr(preg_replace('/[^A-Za-z]/', '', Str::ascii((string) $first->city)) ?: 'HAB', 0, 3)),
                'check_in' => $checkIn->toDateString(),
                'check_out' => $checkIn->addDays($nights)->toDateString(),
                'nights' => $nights,
                'rooms' => $group->flatMap(fn (object $line): array => array_fill(0, max(0, (int) $line->rooms), isset(RoomTypes::CAPACITY[$line->room_type]) ? $line->room_type : 'Doble'))->values()->all(),
                'exists' => $existing->contains(fn (object $list): bool => $list->leg_id === $leg || ($provider !== null && $list->leg_id === null && (string) $list->hotel_provider_id === $provider)),
            ];
        })->values();
    }

    private function distribute(array $types, Collection $passengers): array
    {
        $rooms = array_map(fn (string $type): array => ['type' => $type, 'guests' => [], 'adults' => 0], $types);

        if ($rooms === []) {
            return [];
        }

        foreach (['ADT', 'CHD'] as $kind) {
            foreach ($passengers->where('pax_type', $kind) as $passenger) {
                $free = array_filter($rooms, fn (array $room): bool => count($room['guests']) < RoomTypes::capacity($room['type']));

                if ($free === []) {
                    break;
                }

                uasort($free, fn (array $a, array $b): int => count($a['guests']) <=> count($b['guests']));
                $key = array_key_first($free);
                $rooms[$key]['guests'][] = (string) $passenger->id;
                $rooms[$key]['adults'] += $kind === 'ADT' ? 1 : 0;
            }
        }

        foreach ($passengers->where('pax_type', 'INF') as $passenger) {
            $withAdult = array_filter($rooms, fn (array $room): bool => $room['adults'] > 0);
            $pool = $withAdult === [] ? $rooms : $withAdult;
            uasort($pool, fn (array $a, array $b): int => count($a['guests']) <=> count($b['guests']));
            $rooms[array_key_first($pool)]['guests'][] = (string) $passenger->id;
        }

        return $rooms;
    }
}
