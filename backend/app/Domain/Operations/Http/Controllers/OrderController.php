<?php

declare(strict_types=1);

namespace App\Domain\Operations\Http\Controllers;

use App\Domain\Iam\Models\User;
use App\Domain\Operations\Actions\AssignmentWorkflow;
use App\Domain\Operations\Actions\OrderWorkflow;
use App\Domain\Operations\Actions\ServiceCompletion;
use App\Domain\Operations\Support\OpsNotices;
use App\Domain\Operations\Support\OrderDirectory;
use App\Domain\Operations\Support\OrderFlow;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class OrderController
{
    public function __construct(private readonly OrderDirectory $directory, private readonly OrderWorkflow $workflow) {}

    public function index(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->directory->list($this->user($request))]);
    }

    public function show(Request $request, string $code): JsonResponse
    {
        return response()->json(['data' => $this->directory->find($this->user($request), $code) ?? throw ApiException::notFound('La orden operativa no existe.')]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'reservation_code' => ['required', 'string', 'max:30'],
            'coordinator_id' => ['required', 'uuid'],
        ], ['reservation_code.*' => 'Elige una reserva confirmada.', 'coordinator_id.*' => 'Elige un coordinador.']);
        $code = $this->workflow->create($data['reservation_code'], $data['coordinator_id'], $this->user($request));

        return response()->json(['data' => ['code' => $code]], 201);
    }

    public function update(Request $request, string $code): JsonResponse
    {
        $data = $request->validate(['coordinator_id' => ['required', 'uuid']], ['coordinator_id.*' => 'Elige un coordinador.']);
        $this->workflow->update($code, $data['coordinator_id'], $this->user($request));

        return response()->json(['data' => ['code' => $code]]);
    }

    public function advance(Request $request, string $code, string $action): JsonResponse
    {
        $status = OrderFlow::ACTIONS[$action];
        $this->workflow->advance($code, $status, $this->user($request));

        return response()->json(['data' => ['code' => $code, 'status' => $status]]);
    }

    public function addTask(Request $request, string $code): JsonResponse
    {
        $data = $request->validate(['title' => ['required', 'string', 'min:3', 'max:250']], ['title.*' => 'Escribe la tarea (mínimo 3 caracteres).']);
        $this->workflow->addTask($code, $data['title'], $this->user($request));

        return response()->json(['data' => ['code' => $code]], 201);
    }

    public function updateTask(Request $request, string $task): JsonResponse
    {
        $data = $request->validate(['done' => ['required', 'boolean']]);
        $this->workflow->toggleTask($task, (bool) $data['done'], $this->user($request));

        return response()->json(['data' => ['id' => $task]]);
    }

    public function deleteTask(Request $request, string $task): JsonResponse
    {
        $this->workflow->deleteTask($task, $this->user($request));

        return response()->json(['data' => ['id' => $task]]);
    }

    public function assign(Request $request, string $assignment, AssignmentWorkflow $assignments): JsonResponse
    {
        $data = $request->validate([
            'guide_id' => ['nullable', 'uuid'],
            'driver_id' => ['nullable', 'uuid'],
            'vehicle_id' => ['nullable', 'uuid'],
            'ack_warnings' => ['nullable', 'boolean'],
            'notify' => ['nullable', 'array'],
            'notify.*' => ['string', 'in:'.implode(',', OpsNotices::CHANNELS)],
        ], ['*.uuid' => 'Elige un recurso de la lista.', 'notify.*' => 'Elige cómo avisar al equipo.']);

        return response()->json(['data' => $assignments->assign($assignment, $data, $this->user($request))]);
    }

    public function validateAssignment(Request $request, string $assignment, AssignmentWorkflow $assignments): JsonResponse
    {
        $data = $request->validate([
            'guide_id' => ['nullable', 'uuid'],
            'driver_id' => ['nullable', 'uuid'],
            'vehicle_id' => ['nullable', 'uuid'],
        ], ['*.uuid' => 'Elige un recurso de la lista.']);

        return response()->json(['data' => $assignments->preview($assignment, $data)]);
    }

    public function checkins(Request $request, string $assignment, AssignmentWorkflow $assignments): JsonResponse
    {
        $data = $request->validate([
            'passenger_ids' => ['present', 'array'],
            'passenger_ids.*' => ['uuid'],
        ], ['passenger_ids.*' => 'Elige pasajeros de la lista.']);

        return response()->json(['data' => $assignments->checkins($assignment, $data['passenger_ids'], $this->user($request))]);
    }

    public function confirmAssignment(Request $request, string $assignment, AssignmentWorkflow $assignments): JsonResponse
    {
        $assignments->confirm($assignment, $this->user($request));

        return response()->json(['data' => ['id' => $assignment]]);
    }

    public function releaseAssignment(Request $request, string $assignment, AssignmentWorkflow $assignments): JsonResponse
    {
        $assignments->release($assignment, $this->user($request));

        return response()->json(['data' => ['id' => $assignment]]);
    }

    public function completeService(Request $request, string $service, ServiceCompletion $completion): JsonResponse
    {
        $data = $request->validate(['note' => ['nullable', 'string', 'max:500']], ['note.*' => 'La observación admite hasta 500 caracteres.']);

        return response()->json(['data' => $completion->complete($service, $data['note'] ?? null, $this->user($request))]);
    }

    private function user(Request $request): User
    {
        $user = $request->user();
        assert($user instanceof User);

        return $user;
    }
}
