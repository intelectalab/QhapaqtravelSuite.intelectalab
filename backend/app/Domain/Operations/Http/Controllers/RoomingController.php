<?php

declare(strict_types=1);

namespace App\Domain\Operations\Http\Controllers;

use App\Domain\Iam\Models\User;
use App\Domain\Operations\Actions\RoomingPrefill;
use App\Domain\Operations\Actions\RoomingWorkflow;
use App\Domain\Operations\Support\RoomingDirectory;
use App\Domain\Operations\Support\RoomTypes;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class RoomingController
{
    public function __construct(private readonly RoomingWorkflow $workflow) {}

    public function index(Request $request, RoomingDirectory $directory): JsonResponse
    {
        return response()->json(['data' => $directory->list($this->user($request))]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'reservation_code' => ['required', 'string', 'max:30'],
            'hotel_id' => ['required', 'uuid'],
            'check_in' => ['required', 'date'],
            'check_out' => ['required', 'date', 'after:check_in'],
        ], [
            'reservation_code.*' => 'Elige la reserva.',
            'hotel_id.*' => 'Elige el hotel.',
            'check_in.*' => 'Indica la fecha de ingreso.',
            'check_out.after' => 'La salida debe ser posterior al ingreso.',
            'check_out.*' => 'Indica la fecha de salida.',
        ]);

        return response()->json(['data' => ['id' => $this->workflow->create($data, $this->user($request))]], 201);
    }

    public function prefill(Request $request, RoomingPrefill $prefill): JsonResponse
    {
        $data = $request->validate(['reservation' => ['required', 'string', 'max:30']], ['reservation.*' => 'Elige la reserva.']);

        return response()->json(['data' => $prefill->run($data['reservation'], $this->user($request))], 201);
    }

    public function destroy(Request $request, string $list): JsonResponse
    {
        $this->workflow->archive($list, $this->user($request));

        return response()->json(['data' => ['id' => $list]]);
    }

    public function saveRoom(Request $request, string $list, ?string $room = null): JsonResponse
    {
        $data = $request->validate([
            'room_number' => ['required', 'string', 'max:10'],
            'room_type' => ['required', 'in:'.implode(',', array_keys(RoomTypes::CAPACITY))],
            'status' => ['required', 'in:pendiente,confirmada,observada'],
            'passenger_ids' => ['nullable', 'array'],
            'passenger_ids.*' => ['uuid'],
        ], [
            'room_number.*' => 'Escribe el número de habitación.',
            'room_type.*' => 'Elige el tipo de habitación.',
            'status.*' => 'Elige el estado.',
            'passenger_ids.*' => 'Elige pasajeros de la lista.',
        ]);
        $this->workflow->saveRoom($list, $room, $data, $this->user($request));

        return response()->json(['data' => ['id' => $list]], $room ? 200 : 201);
    }

    public function deleteRoom(Request $request, string $list, string $room): JsonResponse
    {
        $this->workflow->deleteRoom($list, $room, $this->user($request));

        return response()->json(['data' => ['id' => $list]]);
    }

    public function confirm(Request $request, string $list): JsonResponse
    {
        $this->workflow->confirm($list, $this->user($request));

        return response()->json(['data' => ['id' => $list]]);
    }

    public function send(Request $request, string $list): JsonResponse
    {
        $this->workflow->send($list, $this->user($request));

        return response()->json(['data' => ['id' => $list]]);
    }

    private function user(Request $request): User
    {
        $user = $request->user();
        assert($user instanceof User);

        return $user;
    }
}
