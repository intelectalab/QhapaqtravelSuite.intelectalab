<?php

declare(strict_types=1);

namespace App\Domain\Operations\Http\Controllers;

use App\Domain\Iam\Models\User;
use App\Domain\Operations\Actions\IncidentWorkflow;
use App\Domain\Operations\Actions\RoomingWorkflow;
use App\Domain\Operations\Actions\VoucherWorkflow;
use App\Domain\Operations\Support\IncidentDirectory;
use App\Domain\Operations\Support\RoomingDirectory;
use App\Domain\Operations\Support\RoomTypes;
use App\Domain\Operations\Support\VoucherDirectory;
use App\Domain\Shared\Concurrency\IfMatch;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

final class FollowUpContractController
{
    public function rooming(Request $request, string $id, RoomingDirectory $directory): JsonResponse
    {
        return $this->json($this->roomingItem($request, $id, $directory));
    }

    public function validateRooming(Request $request, string $id, RoomingDirectory $directory): JsonResponse
    {
        $item = $this->roomingItem($request, $id, $directory);
        $data = $request->validate([
            'rooms' => ['present', 'array', 'max:200'],
            'rooms.*.room_number' => ['nullable', 'string', 'max:10'],
            'rooms.*.room_type' => ['required', 'in:'.implode(',', array_keys(RoomTypes::CAPACITY))],
            'rooms.*.status' => ['nullable', 'in:pendiente,confirmada,observada'],
            'rooms.*.passenger_ids' => ['nullable', 'array'],
            'rooms.*.passenger_ids.*' => ['uuid'],
        ], [
            'rooms.*.room_type.*' => 'Elige el tipo de cada habitación.',
            'rooms.*.passenger_ids.*' => 'Elige pasajeros de la lista.',
            'rooms.*' => 'Envía la distribución de habitaciones.',
        ]);

        return $this->json($directory->validateProposal($item, $data['rooms']));
    }

    public function roomingDocument(Request $request, string $id, RoomingDirectory $directory): JsonResponse
    {
        return $this->json($directory->document($this->roomingItem($request, $id, $directory)));
    }

    public function replaceRoom(Request $request, string $id, RoomingWorkflow $workflow, RoomingDirectory $directory): JsonResponse
    {
        $list = $this->lockedList($request, $id, $workflow);
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
        $workflow->saveRoom($list->id, $id, $data, $this->user($request));
        $item = $directory->find($this->user($request), $list->id);
        $room = collect($item['rooms'] ?? [])->firstWhere('id', $id);

        return $this->json([...($room ?? ['id' => $id]), 'rooming_list_id' => $list->id, 'list_status' => $item['status'] ?? null, 'list_lock_version' => $item['lock_version'] ?? null]);
    }

    public function deleteRoom(Request $request, string $id, RoomingWorkflow $workflow): Response
    {
        $list = $this->lockedList($request, $id, $workflow);
        $workflow->deleteRoom($list->id, $id, $this->user($request));

        return response()->noContent();
    }

    public function pendingVouchers(VoucherDirectory $directory): JsonResponse
    {
        return $this->json($directory->pending()->all());
    }

    public function checkVoucher(Request $request, VoucherWorkflow $workflow): JsonResponse
    {
        $data = $request->validate([
            'reservation_service_id' => ['required', 'string', 'max:40'],
            'provider_id' => ['nullable', 'uuid'],
        ], ['reservation_service_id.*' => 'Elige el servicio confirmado.', 'provider_id.*' => 'Elige el proveedor.']);

        return $this->json($workflow->check($data['reservation_service_id'], $data['provider_id'] ?? null));
    }

    public function voucher(Request $request, string $id, VoucherDirectory $directory): JsonResponse
    {
        return $this->json($directory->find($this->user($request), $id) ?? throw ApiException::notFound('El voucher no existe.'));
    }

    public function resendVoucher(Request $request, string $id, VoucherWorkflow $workflow, VoucherDirectory $directory): JsonResponse
    {
        $voucher = $directory->find($this->user($request), $id) ?? throw ApiException::notFound('El voucher no existe.');
        $sent = $workflow->resend($voucher['code'], $this->user($request));

        return response()->json(['data' => $directory->find($this->user($request), $voucher['code']), 'meta' => ['sent' => $sent]]);
    }

    public function incidentAssignee(Request $request, string $id, IncidentWorkflow $workflow, IncidentDirectory $directory): JsonResponse
    {
        $data = $request->validate(['assignee_id' => ['required', 'uuid']], ['assignee_id.*' => 'Elige un responsable de la lista.']);
        $code = $workflow->codeOf($id);
        $workflow->assign($code, $data['assignee_id'], $this->user($request));

        return $this->json($directory->find($this->user($request), $code) ?? []);
    }

    public function incidentClassification(Request $request, string $id, IncidentWorkflow $workflow, IncidentDirectory $directory): JsonResponse
    {
        $data = $request->validate([
            'type' => ['required', 'in:'.implode(',', IncidentDirectory::TYPES)],
            'severity' => ['required', 'in:'.implode(',', IncidentDirectory::SEVERITIES)],
        ], ['type.*' => 'Elige el tipo de incidencia.', 'severity.*' => 'Elige la severidad.']);
        $code = $workflow->codeOf($id);
        $workflow->classify($code, $data['type'], $data['severity'], $this->user($request));

        return $this->json($directory->find($this->user($request), $code) ?? []);
    }

    private function roomingItem(Request $request, string $id, RoomingDirectory $directory): array
    {
        return $directory->find($this->user($request), $id) ?? throw ApiException::notFound('La rooming list no existe.');
    }

    private function lockedList(Request $request, string $roomId, RoomingWorkflow $workflow): object
    {
        $list = $workflow->listOfRoom($roomId);
        $body = $request->input('lock_version');
        $expected = IfMatch::from($request, ! is_numeric($body)) ?? (int) $body;
        IfMatch::assertMatches($expected, (int) $list->lock_version, 'La rooming list');

        return $list;
    }

    private function user(Request $request): User
    {
        $user = $request->user();
        assert($user instanceof User);

        return $user;
    }

    private function json(array $data, int $status = 200): JsonResponse
    {
        return response()->json(['data' => $data], $status);
    }
}
