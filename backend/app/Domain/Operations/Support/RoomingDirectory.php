<?php

declare(strict_types=1);

namespace App\Domain\Operations\Support;

use App\Domain\Iam\Models\User;
use App\Domain\Operations\Actions\RoomingPrefill;
use App\Domain\Shared\Tenancy\TenantContext;
use Carbon\CarbonImmutable;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class RoomingDirectory
{
    public function __construct(private readonly OpsCommon $common, private readonly RoomingPrefill $prefill) {}

    public function list(User $viewer): array
    {
        $canModify = $viewer->can('reservations.modify');

        return [
            'today' => $this->common->today(),
            'can' => ['modify' => $canModify],
            'room_types' => $this->roomTypes(),
            'items' => $this->items($this->lists()->orderBy('l.check_in')->get()),
            'candidates' => $canModify ? $this->candidates() : [],
            'prefill' => $this->prefillable(),
            'hotels' => $canModify ? DB::table('catalog_providers')->whereNull('deleted_at')->where('type', 'Hotel')->where('status', 'activo')->orderBy('name')->get(['id as value', 'name as label', 'city as hint']) : [],
        ];
    }

    public function find(User $viewer, string $id): ?array
    {
        $item = Str::isUuid($id) ? $this->items($this->lists()->where('l.id', $id)->get())->first() : null;

        return $item === null ? null : [...$item, 'today' => $this->common->today(), 'can' => ['modify' => $viewer->can('reservations.modify')], 'room_types' => $this->roomTypes()];
    }

    public function validateProposal(array $item, array $proposal): array
    {
        $roster = collect($item['passengers']);
        $known = $roster->keyBy('id');
        $blocks = [];
        $seen = [];
        $rooms = collect($proposal)->values()->map(function (array $room, int $index) use ($known, &$blocks, &$seen): array {
            $number = Str::upper(trim((string) ($room['room_number'] ?? ''))) ?: 'sin número ('.($index + 1).')';
            $ids = array_values(array_unique($room['passenger_ids'] ?? []));

            foreach ($ids as $passengerId) {
                if (! $known->has($passengerId)) {
                    $blocks[] = "La habitación {$number} incluye un pasajero que no es de esta reserva.";
                } elseif (isset($seen[$passengerId])) {
                    $blocks[] = "{$known[$passengerId]['name']} figura en las habitaciones {$seen[$passengerId]} y {$number}.";
                } else {
                    $seen[$passengerId] = $number;
                }
            }

            return [
                'number' => $number,
                'type' => $room['room_type'],
                'capacity' => RoomTypes::capacity($room['room_type']),
                'status' => $room['status'] ?? 'pendiente',
                'guests' => collect($ids)->filter(fn (string $passengerId): bool => $known->has($passengerId))->map(fn (string $passengerId): array => $known[$passengerId])->values(),
            ];
        });
        $duplicated = $rooms->pluck('number')->duplicates()->unique();

        if ($duplicated->isNotEmpty()) {
            $blocks[] = 'Número de habitación repetido: '.$duplicated->implode(', ').'.';
        }

        $warnings = $this->warnings($rooms, $roster->map(fn (array $passenger): object => (object) ['id' => $passenger['id'], 'full_name' => $passenger['name']]));
        $blocks = [...$blocks, ...collect($warnings)->where('level', 'bad')->pluck('text')->all()];

        return [
            'id' => $item['id'],
            'valid' => $blocks === [],
            'blocks' => array_values(array_unique($blocks)),
            'warnings' => collect($warnings)->where('level', '<>', 'bad')->values()->all(),
            'rooms' => $rooms->count(),
            'placed' => count($seen),
            'passengers' => $roster->count(),
        ];
    }

    public function document(array $item): array
    {
        $tenant = app(TenantContext::class)->tenant();

        return [
            'id' => $item['id'],
            'title' => "Rooming list {$item['reservation']['code']}",
            'agency' => $tenant->commercial_name,
            'hotel' => $item['hotel'],
            'city' => $item['city'],
            'reservation' => $item['reservation'],
            'check_in' => $item['check_in'],
            'check_out' => $item['check_out'],
            'nights' => $item['nights'],
            'status' => $item['status'],
            'version' => max(1, $item['sent_version']),
            'sent_at' => $item['sent_at'],
            'rooms' => $item['rooms']->map(fn (array $room): array => ['number' => $room['number'], 'type' => $room['type'], 'status' => $room['status'], 'guests' => $room['guests']->pluck('name')->values()])->values(),
            'totals' => ['rooms' => $item['rooms']->count(), 'guests' => $item['rooms']->sum(fn (array $room): int => $room['guests']->count())],
            'warnings' => $item['warnings'],
            'generated_at' => now()->toIso8601String(),
        ];
    }

    private function roomTypes(): Collection
    {
        return collect(RoomTypes::CAPACITY)->map(fn (int $capacity, string $type) => ['value' => $type, 'label' => $type, 'hint' => $capacity === 1 ? '1 persona' : "{$capacity} personas"])->values();
    }

    private function lists(): Builder
    {
        return DB::table('ops_rooming_lists as l')
            ->join('booking_reservations as r', 'r.id', '=', 'l.reservation_id')
            ->leftJoin('catalog_providers as h', 'h.id', '=', 'l.hotel_provider_id')
            ->whereNull('l.deleted_at')
            ->select(['l.*', 'r.code as reservation_code', 'r.title as reservation_title', 'r.status as reservation_status', 'h.name as hotel']);
    }

    private function items(Collection $lists): Collection
    {
        $rooms = DB::table('ops_rooming_rooms')->whereIn('rooming_list_id', $lists->pluck('id'))->orderBy('room_number')->get()->groupBy('rooming_list_id');
        $guests = DB::table('ops_rooming_guests as g')->join('booking_passengers as p', 'p.id', '=', 'g.passenger_id')->whereIn('g.rooming_list_id', $lists->pluck('id'))
            ->get(['g.room_id', 'g.rooming_list_id', 'p.id', 'p.full_name', 'p.pax_type'])->groupBy('room_id');
        $passengers = DB::table('booking_passengers')->whereIn('reservation_id', $lists->pluck('reservation_id')->unique())->orderBy('seq')->get(['id', 'reservation_id', 'full_name', 'pax_type'])->groupBy('reservation_id');
        $names = $this->common->userNames();

        return $lists->map(function ($list) use ($rooms, $guests, $passengers, $names): array {
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
                'lock_version' => (int) $list->lock_version,
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
        })->values();
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

    private function prefillable(): Collection
    {
        return DB::table('booking_reservations as r')->whereNull('r.deleted_at')->whereNotIn('r.status', ['cancelada', 'completada', 'borrador'])
            ->whereExists(fn ($query) => $query->from('booking_reservation_web_snapshots as w')->join('booking_reservation_web_lodging as l', 'l.snapshot_id', '=', 'w.id')->whereColumn('w.reservation_id', 'r.id'))
            ->orderBy('r.travel_from')->get(['r.id', 'r.code', 'r.title'])
            ->map(fn (object $row): array => ['reservation' => $row->code, 'title' => $row->title, 'legs' => $this->prefill->pending($row->id)->map(fn (array $leg): array => ['city' => $leg['city'], 'hotel' => $leg['hotel'], 'rooms' => count($leg['rooms'])])->values()])
            ->filter(fn (array $row): bool => $row['legs']->isNotEmpty())->values();
    }

    private function candidates(): Collection
    {
        return DB::table('booking_reservations')->whereNull('deleted_at')->whereNotIn('status', ['cancelada', 'completada', 'borrador'])->orderBy('travel_from')
            ->get(['code', 'title', 'travel_from', 'travel_to'])
            ->map(fn (object $row): array => ['value' => $row->code, 'label' => "{$row->code} · {$row->title}", 'hint' => "{$row->travel_from} al {$row->travel_to}", 'from' => $row->travel_from, 'to' => $row->travel_to])->values();
    }
}
