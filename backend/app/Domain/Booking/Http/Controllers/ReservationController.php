<?php

declare(strict_types=1);

namespace App\Domain\Booking\Http\Controllers;

use App\Domain\Booking\Actions\ConvertQuote;
use App\Domain\Booking\Actions\ReservationChanges;
use App\Domain\Booking\Actions\ReservationReschedule;
use App\Domain\Booking\Actions\ReservationWorkflow;
use App\Domain\Booking\Support\ReservationDirectory;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class ReservationController
{
    public function __construct(private readonly ReservationDirectory $directory) {}

    public function index(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->directory->list($this->user($request))]);
    }

    public function show(Request $request, string $code): JsonResponse
    {
        return response()->json(['data' => $this->directory->find($this->user($request), $code) ?? throw ApiException::notFound('La reserva no existe.')]);
    }

    public function conversion(Request $request, string $code, ConvertQuote $convert): JsonResponse
    {
        return response()->json(['data' => $convert->preview($code, $this->user($request))]);
    }

    public function convert(Request $request, string $code, ConvertQuote $convert): JsonResponse
    {
        $data = $request->validate(['lock_version' => ['nullable', 'integer'], 'notes' => ['nullable', 'string', 'max:1000']]);
        $result = $convert->handle($code, isset($data['lock_version']) ? (int) $data['lock_version'] : null, $data['notes'] ?? null, $request->header('Idempotency-Key'), $this->user($request));

        return response()->json(['data' => $result], $result['created'] ? 201 : 200);
    }

    public function update(Request $request, string $code, ReservationWorkflow $workflow): JsonResponse
    {
        $data = $request->validate(['notes' => ['nullable', 'string', 'max:2000'], 'owner_id' => ['nullable', 'string']]);
        $workflow->update($code, $data, $this->user($request));

        return response()->json(['data' => ['code' => $code]]);
    }

    public function savePassenger(Request $request, string $code, ReservationWorkflow $workflow, ?string $passenger = null): JsonResponse
    {
        $data = $request->validate([
            'full_name' => ['required', 'string', 'min:3', 'max:150'],
            'pax_type' => ['required', 'in:ADT,CHD,INF'],
            'doc_type' => ['nullable', 'in:DNI,Pasaporte,CE'],
            'doc_number' => ['nullable', 'string', 'max:30'],
            'nationality' => ['nullable', 'string', 'max:60'],
            'birth_date' => ['nullable', 'date', 'before:today'],
            'phone' => ['nullable', 'string', 'max:30'],
            'email' => ['nullable', 'email', 'max:150'],
            'diet_notes' => ['nullable', 'string', 'max:200'],
            'relationship' => ['nullable', 'in:Titular,Cónyuge / pareja,Hijo/a,Padre / madre,Hermano/a,Amigo/a,Otro'],
            'is_lead' => ['nullable', 'boolean'],
        ], ['full_name.*' => 'Escribe el nombre completo.', 'email.email' => 'Revisa el correo.', 'birth_date.before' => 'La fecha de nacimiento debe ser anterior a hoy.']);
        $workflow->savePassenger($code, $passenger, $data, $this->user($request));

        return response()->json(['data' => ['code' => $code]], $passenger ? 200 : 201);
    }

    public function deletePassenger(Request $request, string $code, string $passenger, ReservationWorkflow $workflow): JsonResponse
    {
        $workflow->deletePassenger($code, $passenger, $this->user($request));

        return response()->json(['data' => ['code' => $code]]);
    }

    public function cancellation(Request $request, string $code, ReservationWorkflow $workflow): JsonResponse
    {
        return response()->json(['data' => $workflow->cancellationPreview($code, $this->user($request))]);
    }

    public function cancel(Request $request, string $code, ReservationWorkflow $workflow): JsonResponse
    {
        $data = $this->cancelData($request);
        $workflow->cancel($code, $data['reason'], $data['detail'], $this->user($request));

        return response()->json(['data' => ['code' => $code]]);
    }

    public function requestCancel(Request $request, string $code, ReservationWorkflow $workflow): JsonResponse
    {
        $data = $this->cancelData($request);
        $workflow->requestCancel($code, $data['reason'], $data['detail'], $this->user($request));

        return response()->json(['data' => ['code' => $code]], 201);
    }

    public function rejectCancelRequest(Request $request, string $code, ReservationWorkflow $workflow): JsonResponse
    {
        $data = $request->validate(['note' => ['required', 'string', 'min:3', 'max:500']], ['note.*' => 'Explica por qué no se anula.']);
        $workflow->rejectCancelRequest($code, $data['note'], $this->user($request));

        return response()->json(['data' => ['code' => $code]]);
    }

    public function changeOptions(Request $request, string $code, ReservationChanges $changes): JsonResponse
    {
        return response()->json(['data' => $changes->options($code, $this->user($request))]);
    }

    public function changePreview(Request $request, string $code, ReservationChanges $changes): JsonResponse
    {
        return response()->json(['data' => $changes->preview($code, $this->changeData($request, false), $this->user($request))]);
    }

    public function requestChange(Request $request, string $code, ReservationChanges $changes): JsonResponse
    {
        $data = $this->changeData($request, true);
        $changes->request($code, $data, $request->boolean('apply_now'), $this->user($request));

        return response()->json(['data' => ['code' => $code]], 201);
    }

    public function approveChange(Request $request, string $code, string $change, ReservationChanges $changes): JsonResponse
    {
        $changes->approve($code, $change, $this->user($request));

        return response()->json(['data' => ['code' => $code]]);
    }

    public function rejectChange(Request $request, string $code, string $change, ReservationChanges $changes): JsonResponse
    {
        $data = $request->validate(['note' => ['required', 'string', 'min:3', 'max:500']], ['note.*' => 'Explica por qué no se aplica.']);
        $changes->reject($code, $change, $data['note'], $this->user($request));

        return response()->json(['data' => ['code' => $code]]);
    }

    public function reschedulePreview(Request $request, string $code, ReservationReschedule $reschedule): JsonResponse
    {
        $data = $request->validate(['new_start' => ['nullable', 'date']]);

        return response()->json(['data' => $reschedule->preview($code, $data['new_start'] ?? null, $this->user($request))]);
    }

    public function reschedule(Request $request, string $code, ReservationReschedule $reschedule): JsonResponse
    {
        $data = $request->validate([
            'new_start' => ['required', 'date', 'after_or_equal:today'],
            'reason' => ['required', 'string', 'min:3', 'max:500'],
        ], ['new_start.required' => 'Elige la nueva fecha de inicio.', 'new_start.after_or_equal' => 'La nueva fecha no puede ser pasada.', 'reason.*' => 'Explica por qué cambia la fecha.']);
        $reschedule->apply($code, $data['new_start'], $data['reason'], $this->user($request));

        return response()->json(['data' => ['code' => $code]]);
    }

    private function changeData(Request $request, bool $full): array
    {
        return $request->validate([
            'type' => ['required', 'in:'.implode(',', ReservationChanges::TYPES)],
            'extra_pax' => ['required_if:type,pax', 'nullable', 'integer', 'min:1', 'max:40'],
            'product_code' => ['required_if:type,servicio', 'nullable', 'string'],
            'service_date' => ['required_if:type,servicio', 'nullable', 'date', 'after_or_equal:today'],
            'delta' => [$full ? 'nullable' : 'sometimes', 'nullable', 'numeric', 'between:-999999,999999'],
            'description' => [$full ? 'required' : 'nullable', 'nullable', 'string', 'min:3', 'max:500'],
        ], [
            'type.*' => 'Elige qué cambia.',
            'extra_pax.*' => 'Indica cuántos pasajeros se suman.',
            'product_code.required_if' => 'Elige el servicio.',
            'service_date.required_if' => 'Indica la fecha del servicio.',
            'service_date.after_or_equal' => 'La fecha no puede ser pasada.',
            'description.*' => 'Describe el cambio.',
            'delta.*' => 'Revisa el monto.',
        ]);
    }

    private function cancelData(Request $request): array
    {
        return $request->validate([
            'reason' => ['required', 'in:'.implode(',', ReservationWorkflow::CANCEL_REASONS)],
            'detail' => ['required', 'string', 'min:3', 'max:500'],
        ], ['reason.*' => 'Elige un motivo.', 'detail.*' => 'Cuenta el detalle.']);
    }

    private function user(Request $request): User
    {
        $user = $request->user();
        assert($user instanceof User);

        return $user;
    }
}
