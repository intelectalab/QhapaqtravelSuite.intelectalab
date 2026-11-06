<?php

declare(strict_types=1);

namespace App\Domain\Operations\Support;

use App\Domain\Iam\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

final class RoomingDirectory
{
    public function __construct(private readonly OpsCommon $common) {}

    public function list(User $viewer): array
    {
        $lists = DB::table('ops_rooming_lists as l')
            ->join('booking_reservations as r', 'r.id', '=', 'l.reservation_id')
            ->leftJoin('catalog_providers as h', 'h.id', '=', 'l.hotel_provider_id')
            ->whereNull('l.deleted_at')
            ->orderBy('l.check_in')
            ->get(['l.*', 'r.code as reservation_code', 'r.title as reservation_title', 'r.status as reservation_status', 'h.name as hotel']);
        $rooms = DB::table('ops_rooming_rooms')->whereIn('rooming_list_id', $lists->pluck('id'))->orderBy('room_number')->get()->groupBy('rooming_list_id');
        $guests = DB::table('ops_rooming_guests as g')->join('booking_passengers as p', 'p.id', '=', 'g.passenger_id')->whereIn('g.rooming_list_id', $lists->pluck('id'))
            ->get(['g.room_id', 'g.rooming_list_id', 'p.id', 'p.full_name', 'p.pax_type'])->groupBy('room_id');
        $passengers = DB::table('booking_passengers')->whereIn('reservation_id', $lists->pluck('reservation_id')->unique())->orderBy('seq')->get(['id', 'reservation_id', 'full_name', 'pax_type'])->groupBy('reservation_id');
        $names = $this->common->userNames();
        $canModify = $viewer->can('reservations.modify');

        return [
            'today' => $this->common->today(),
            'can' => ['modify' => $canModify],
            'room_types' => collect(RoomTypes::CAPACITY)->map(fn (int $capacity, string $type) => ['value' => $type, 'label' => $type, 'hint' => $capacity === 1 ? '1 persona' : "{$capacity} personas"])->values(),
            'items' => $lists->map(function (object $list) use ($rooms, $guests, $passengers, $names): array {
                $listRooms = collect($rooms[$list->id] ?? [])->map(fn ($room) => [
                    'id' => $room->id,
                    'number' => $room->room_number,
                    'type' => $room->room_type,
                    'capacity' => (int) $room->capacity,
                    'status' => $room->status,
                    'note' => $room->hotel_note,
                    'guests' => collect($guests[$room->id] ?? [])->map(fn ($guest) => ['id' => $guest->id, 'name' => $guest->full_name, 'infant' => $guest->pax_type === 'INF'])->values(),
                ])->values();
                $roster = collect($passengers[$list->reservation_id] ?? []);

                return [
                    'id' => $list->id,
                    'reservation' => ['code' => $list->reservation_code, 'title' => $list->reservation_title, 'status' => $list->reservation_status],
                    'hotel' => $list->hotel ?? $list->hotel_name,
                    'city' => $list->city,
                    'check_in' => $list->check_in,
                    'check_out' => $list->check_out,
                    'nights' => (int) CarbonImmutable::parse($list->check_in)->diffInDays(CarbonImmutable::parse($list->check_out)),
                    'status' => $list->status,
                    'sent_at' => $list->sent_at,
                    'sent_by' => $list->sent_by ? ($names[$list->sent_by] ?? null) : null,
                    'sent_version' => (int) $list->sent_version,
                    'hotel_ack_at' => $list->hotel_ack_at,
                    'hotel_confirmed_at' => $list->hotel_confirmed_at,
                    'rooms' => $listRooms,
                    'passengers' => $roster->map(fn ($passenger) => ['id' => $passenger->id, 'name' => $passenger->full_name, 'infant' => $passenger->pax_type === 'INF'])->values(),
                    'warnings' => $this->warnings($listRooms, $roster),
                ];
            })->values(),
            'candidates' => $canModify ? $this->candidates() : [],
            'hotels' => $canModify ? DB::table('catalog_providers')->whereNull('deleted_at')->where('type', 'Hotel')->where('status', 'activo')->orderBy('name')->get(['id as value', 'name as label', 'city as hint']) : [],
        ];
    }

    public function warnings(Collection $rooms, Collection $roster): array
    {
        $placed = $rooms->flatMap(fn (array $room) => $room['guests']->pluck('id'))->all();
        $warnings = [];
        $empty = $rooms->filter(fn (array $room) => $room['guests']->isEmpty())->pluck('number');
        $over = $rooms->filter(fn (array $room) => $room['guests']->where('infant', false)->count() > $room['capacity'])->pluck('number');
        $observed = $rooms->where('status', 'observada')->pluck('number');
        $missing = $roster->reject(fn (object $passenger) => in_array($passenger->id, $placed, true))->pluck('full_name');

        if ($over->isNotEmpty()) {
            $warnings[] = ['level' => 'bad', 'text' => 'Sobre la capacidad: habitación '.$over->implode(', ').'.'];
        }

        if ($observed->isNotEmpty()) {
            $warnings[] = ['level' => 'warn', 'text' => 'El hotel observó la habitación '.$observed->implode(', ').'.'];
        }

        if ($missing->isNotEmpty()) {
            $warnings[] = ['level' => 'warn', 'text' => $missing->count() === 1 ? "{$missing->first()} aún no tiene habitación." : "{$missing->count()} pasajeros aún no tienen habitación."];
        }

        if ($empty->isNotEmpty()) {
            $warnings[] = ['level' => 'info', 'text' => 'Habitación sin huéspedes: '.$empty->implode(', ').'.'];
        }

        return $warnings;
    }

    private function candidates(): Collection
    {
        return DB::table('booking_reservations')->whereNull('deleted_at')->whereNotIn('status', ['cancelada', 'completada', 'borrador'])->orderBy('travel_from')
            ->get(['code', 'title', 'travel_from', 'travel_to'])
            ->map(fn (object $row): array => ['value' => $row->code, 'label' => "{$row->code} · {$row->title}", 'hint' => "{$row->travel_from} al {$row->travel_to}", 'from' => $row->travel_from, 'to' => $row->travel_to])->values();
    }
}
