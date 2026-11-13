<?php

declare(strict_types=1);

namespace App\Domain\Operations\Actions;

use App\Domain\Iam\Models\User;
use App\Domain\Operations\Support\OpsMail;
use App\Domain\Operations\Support\RoomTypes;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class RoomingWorkflow
{
    public function __construct(private readonly AuditLogger $audit) {}

    public function create(array $data, User $actor): string
    {
        $reservation = DB::table('booking_reservations')->whereNull('deleted_at')->where('code', $data['reservation_code'])->first(['id', 'code', 'status'])
            ?? throw ApiException::unprocessable('VALIDATION_ERROR', 'Elige una reserva.');

        if (in_array($reservation->status, ['cancelada', 'completada', 'borrador'], true)) {
            throw ApiException::unprocessable('OPS-BR-36', 'La reserva no admite rooming list en su estado actual.');
        }

        $hotel = DB::table('catalog_providers')->whereNull('deleted_at')->where('id', $data['hotel_id'])->where('type', 'Hotel')->where('status', 'activo')->first(['id', 'name'])
            ?? throw ApiException::unprocessable('OPS-BR-36', 'Elige un hotel activo.');

        if (DB::table('ops_rooming_lists')->where('reservation_id', $reservation->id)->where('hotel_provider_id', $hotel->id)->whereNull('deleted_at')->exists()) {
            throw ApiException::conflict('OPS-BR-36', 'Esta reserva ya tiene una rooming list en ese hotel.');
        }

        $values = ['source' => 'manual', 'check_in' => $data['check_in'], 'check_out' => $data['check_out'], 'status' => 'borrador'];
        $archived = DB::table('ops_rooming_lists')->where('reservation_id', $reservation->id)->where('hotel_provider_id', $hotel->id)->whereNotNull('deleted_at')->value('id');

        if ($archived !== null) {
            $id = (string) $archived;
            DB::table('ops_rooming_lists')->where('id', $id)->update([...$values, 'deleted_at' => null, 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
        } else {
            $id = (string) Str::uuid7();
            DB::table('ops_rooming_lists')->insert(['id' => $id, 'reservation_id' => $reservation->id, 'hotel_provider_id' => $hotel->id, ...$values, 'created_by' => $actor->getKey()]);
        }
        $this->audit->log('Rooming list', $reservation->code, 'crear', null, "{$hotel->name} · {$data['check_in']} al {$data['check_out']}");

        return $id;
    }

    public function saveRoom(string $listId, ?string $roomId, array $data, User $actor): void
    {
        $list = $this->list($listId);
        $capacity = RoomTypes::capacity($data['room_type']);
        $guests = array_values(array_unique($data['passenger_ids'] ?? []));
        $passengers = DB::table('booking_passengers')->where('reservation_id', $list->reservation_id)->whereIn('id', $guests)->get(['id', 'full_name', 'pax_type']);

        if ($passengers->count() !== count($guests)) {
            throw ApiException::unprocessable('VALIDATION_ERROR', 'Elige pasajeros de esta reserva.');
        }

        if ($passengers->where('pax_type', '<>', 'INF')->count() > $capacity) {
            throw ApiException::unprocessable('OPS-BR-32', "Una habitación {$data['room_type']} admite {$capacity} ".($capacity === 1 ? 'persona.' : 'personas.'));
        }

        $taken = DB::table('ops_rooming_guests as g')->join('ops_rooming_rooms as r', 'r.id', '=', 'g.room_id')->join('booking_passengers as p', 'p.id', '=', 'g.passenger_id')
            ->where('g.rooming_list_id', $list->id)->whereIn('g.passenger_id', $guests)->when($roomId, fn ($query) => $query->where('g.room_id', '<>', $roomId))
            ->first(['p.full_name', 'r.room_number']);

        if ($taken !== null) {
            throw ApiException::conflict('OPS-BR-30', "{$taken->full_name} ya está en la habitación {$taken->room_number}.");
        }

        $stay = "[{$list->check_in},{$list->check_out})";

        try {
            DB::transaction(function () use ($list, $roomId, $data, $capacity, $guests, $stay, $actor): void {
                $values = ['room_number' => Str::upper(trim($data['room_number'])), 'room_type' => $data['room_type'], 'capacity' => $capacity, 'status' => $data['status'], 'updated_at' => now()];

                if ($roomId === null) {
                    $roomId = (string) Str::uuid7();
                    DB::table('ops_rooming_rooms')->insert(['id' => $roomId, 'rooming_list_id' => $list->id, 'hotel_provider_id' => $list->hotel_provider_id, 'stay' => $stay, ...$values, 'created_by' => $actor->getKey()]);
                } else {
                    $this->room($roomId, $list->id);
                    DB::table('ops_rooming_rooms')->where('id', $roomId)->update([...$values, 'updated_by' => $actor->getKey()]);
                    DB::table('ops_rooming_guests')->where('room_id', $roomId)->delete();
                }

                foreach ($guests as $passengerId) {
                    DB::table('ops_rooming_guests')->insert(['room_id' => $roomId, 'rooming_list_id' => $list->id, 'passenger_id' => $passengerId, 'stay' => $stay, 'created_by' => $actor->getKey()]);
                }

                $this->touch($list, $actor);
            });
        } catch (QueryException $exception) {
            throw match ($exception->getCode()) {
                '23505' => ApiException::conflict('OPS-BR-31', 'Ya existe esa habitación en la lista.'),
                '23P01' => ApiException::conflict('OPS-BR-31', 'Esa habitación o algún pasajero ya está ocupado en esas fechas en otra rooming list.'),
                default => $exception,
            };
        }

        $this->audit->log('Rooming list', $list->reservation_code, $roomId ? 'editar_habitacion' : 'agregar_habitacion', null, "{$data['room_number']} · {$data['room_type']} · ".count($guests).' huéspedes');
    }

    public function deleteRoom(string $listId, string $roomId, User $actor): void
    {
        $list = $this->list($listId);
        $room = $this->room($roomId, $list->id);
        DB::transaction(function () use ($room, $list, $actor): void {
            DB::table('ops_rooming_rooms')->where('id', $room->id)->delete();
            $this->touch($list, $actor);
        });
        $this->audit->log('Rooming list', $list->reservation_code, 'eliminar_habitacion', $room->room_number, null);
    }

    public function confirm(string $listId, User $actor): void
    {
        $list = $this->list($listId);
        $this->ensureConsistent($list);
        DB::table('ops_rooming_lists')->where('id', $list->id)->update(['status' => 'confirmada', 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
        $this->audit->log('Rooming list', $list->reservation_code, 'confirmar', $list->status, 'confirmada');
    }

    public function send(string $listId, User $actor): void
    {
        $list = $this->list($listId);

        if (! in_array($list->status, ['confirmada', 'enviada'], true)) {
            throw ApiException::conflict('OPS-BR-34', 'Confirma la rooming list antes de enviarla al hotel.');
        }

        $this->ensureConsistent($list);
        DB::table('ops_rooming_lists')->where('id', $list->id)->update(['status' => 'enviada', 'sent_at' => now(), 'sent_by' => $actor->getKey(), 'sent_version' => (int) $list->sent_version + 1, 'hotel_ack_at' => null, 'hotel_ack_by' => null, 'hotel_confirmed_at' => null, 'hotel_confirmed_by' => null, 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
        $this->audit->log('Rooming list', $list->reservation_code, 'enviar_hotel', $list->status, 'enviada v'.((int) $list->sent_version + 1));
        app(OpsMail::class)->rooming((string) $list->id);
    }

    public function archive(string $listId, User $actor): void
    {
        $list = $this->list($listId);

        if ($list->status === 'enviada') {
            throw ApiException::conflict('OPS-BR-34', 'La lista ya se envió al hotel: modifícala y reenvíala en lugar de eliminarla.');
        }

        DB::table('ops_rooming_lists')->where('id', $list->id)->update(['deleted_at' => now(), 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
        DB::table('ops_rooming_rooms')->where('rooming_list_id', $list->id)->delete();
        $this->audit->log('Rooming list', $list->reservation_code, 'eliminar', $list->status, null);
    }

    public function listOfRoom(string $roomId): object
    {
        $listId = Str::isUuid($roomId) ? DB::table('ops_rooming_rooms')->where('id', $roomId)->value('rooming_list_id') : null;

        return $this->list((string) ($listId ?? throw ApiException::notFound('La habitación no existe.')));
    }

    private function ensureConsistent(object $list): void
    {
        $over = DB::table('ops_rooming_rooms as r')->leftJoin('ops_rooming_guests as g', 'g.room_id', '=', 'r.id')->leftJoin('booking_passengers as p', fn ($join) => $join->on('p.id', '=', 'g.passenger_id')->where('p.pax_type', '<>', 'INF'))
            ->where('r.rooming_list_id', $list->id)->groupBy('r.id', 'r.room_number', 'r.capacity')->havingRaw('count(p.id) > r.capacity')->pluck('r.room_number');

        if ($over->isNotEmpty()) {
            throw ApiException::conflict('OPS-BR-34', 'Corrige la capacidad de la habitación '.$over->implode(', ').' antes de continuar.');
        }

        if (! DB::table('ops_rooming_rooms')->where('rooming_list_id', $list->id)->exists()) {
            throw ApiException::conflict('OPS-BR-34', 'Agrega al menos una habitación.');
        }
    }

    private function touch(object $list, User $actor): void
    {
        if (in_array($list->status, ['confirmada', 'enviada'], true)) {
            DB::table('ops_rooming_lists')->where('id', $list->id)->update(['status' => 'modificada', 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
        }
    }

    private function list(string $id): object
    {
        if (! Str::isUuid($id)) {
            throw ApiException::notFound('La rooming list no existe.');
        }

        return DB::table('ops_rooming_lists as l')->join('booking_reservations as r', 'r.id', '=', 'l.reservation_id')->whereNull('l.deleted_at')->where('l.id', $id)
            ->first(['l.*', 'r.code as reservation_code']) ?? throw ApiException::notFound('La rooming list no existe.');
    }

    private function room(string $id, string $listId): object
    {
        if (! Str::isUuid($id)) {
            throw ApiException::notFound('La habitación no existe.');
        }

        return DB::table('ops_rooming_rooms')->where('id', $id)->where('rooming_list_id', $listId)->first() ?? throw ApiException::notFound('La habitación no existe.');
    }
}
