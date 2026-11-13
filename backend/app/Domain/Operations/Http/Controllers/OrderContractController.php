<?php

declare(strict_types=1);

namespace App\Domain\Operations\Http\Controllers;

use App\Domain\Booking\Actions\ProviderServiceResponse;
use App\Domain\Iam\Models\User;
use App\Domain\Operations\Actions\AssignmentWorkflow;
use App\Domain\Operations\Actions\OrderWorkflow;
use App\Domain\Operations\Actions\ResourceCatalog;
use App\Domain\Operations\Actions\ServiceSupplierRequests;
use App\Domain\Operations\Support\OrderDirectory;
use App\Domain\Operations\Support\ResourceDirectory;
use App\Domain\Operations\Support\SupplierResponseDirectory;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Http\CursorPage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

final class OrderContractController
{
    public function __construct(private readonly OrderDirectory $orders) {}

    public function kpis(): JsonResponse
    {
        return $this->json($this->orders->kpis());
    }

    public function candidates(): JsonResponse
    {
        return $this->json($this->orders->candidates()->all());
    }

    public function closeChecks(Request $request, string $id): JsonResponse
    {
        return $this->json($this->orders->closeChecks($this->user($request), $id) ?? throw ApiException::notFound('La orden operativa no existe.'));
    }

    public function costSummary(Request $request, string $id): JsonResponse
    {
        return $this->json($this->orders->costSummary($this->user($request), $id) ?? throw ApiException::notFound('La orden operativa no existe.'));
    }

    public function coordinator(Request $request, string $id, OrderWorkflow $workflow): JsonResponse
    {
        $data = $request->validate(['coordinator_id' => ['required', 'uuid']], ['coordinator_id.*' => 'Elige un coordinador.']);
        $code = $this->orderCode($id);
        $workflow->update($code, $data['coordinator_id'], $this->user($request));

        return $this->json($this->orders->find($this->user($request), $code) ?? []);
    }

    public function assignments(Request $request, ResourceDirectory $resources): JsonResponse
    {
        $filters = CursorPage::filters($request);

        if (isset($filters['from']) && $filters['from'] !== 'today' && preg_match('/^\d{4}-\d{2}-\d{2}$/', $filters['from']) !== 1) {
            throw ApiException::unprocessable('VALIDATION_ERROR', 'filter[from] debe ser una fecha (AAAA-MM-DD) o «today».');
        }

        return response()->json(CursorPage::respondItems($request, $resources->assignmentList($filters)));
    }

    public function createAssignment(Request $request, string $id, AssignmentWorkflow $workflow): JsonResponse
    {
        $data = $request->validate(['reservation_service_id' => ['required', 'string', 'max:40']], ['reservation_service_id.*' => 'Elige el servicio que necesita asignación.']);

        return $this->json($workflow->ensure($id, $data['reservation_service_id'], $this->user($request)), 201);
    }

    public function documentAlerts(ResourceDirectory $resources): JsonResponse
    {
        return $this->json($resources->documentAlerts());
    }

    public function agenda(string $type, string $id, ResourceDirectory $resources): JsonResponse
    {
        return $this->json($resources->agenda($this->resourceType($type), $id) ?? throw ApiException::notFound('El recurso no existe.'));
    }

    public function resourceStatus(Request $request, string $type, string $id, ResourceCatalog $catalog): JsonResponse
    {
        $data = $request->validate(['status' => ['required', 'string', 'max:20']], ['status.*' => 'Elige el estado.']);

        return $this->json($catalog->changeStatus($this->resourceType($type), $id, $data['status'], $this->user($request)));
    }

    public function supplierRequests(Request $request, SupplierResponseDirectory $directory): JsonResponse
    {
        return response()->json($directory->requests($request));
    }

    public function supplierRequest(Request $request, string $id, ServiceSupplierRequests $requests): JsonResponse
    {
        $data = $request->validate(['note' => ['nullable', 'string', 'max:500']], ['note.*' => 'La nota admite hasta 500 caracteres.']);

        return $this->json((array) $requests->request($id, $data['note'] ?? null, $this->user($request)));
    }

    public function supplierConfirmation(Request $request, string $id, ServiceSupplierRequests $requests): JsonResponse
    {
        $data = $request->validate([
            'confirmation_code' => ['required', 'string', 'min:4', 'max:40'],
            'time' => ['nullable', 'date_format:H:i'],
            'confirmed_by' => ['nullable', 'string', 'max:120'],
            'note' => ['nullable', 'string', 'max:500'],
        ], ['confirmation_code.*' => 'Escribe el código de confirmación del proveedor (al menos 4 caracteres).', 'time.*' => 'Escribe la hora en formato 24 h, por ejemplo 14:00.', 'confirmed_by.*' => 'El nombre de quien confirma es muy largo.', 'note.*' => 'La nota admite hasta 500 caracteres.']);

        return $this->json((array) $requests->confirm($id, $data, $this->user($request)));
    }

    public function supplierRejection(Request $request, string $id, ServiceSupplierRequests $requests): JsonResponse
    {
        $data = $request->validate([
            'reason' => ['required', Rule::in(ProviderServiceResponse::REJECT_REASONS)],
            'detail' => ['required', 'string', 'min:3', 'max:500'],
            'alternative_date' => ['nullable', 'date', 'after_or_equal:today'],
            'alternative_provider_id' => ['nullable', 'uuid'],
        ], ['reason.*' => 'Elige el motivo del rechazo.', 'detail.*' => 'Cuenta el detalle del rechazo.', 'alternative_date.*' => 'La fecha alternativa no puede ser pasada.', 'alternative_provider_id.*' => 'Elige un proveedor de la lista.']);

        return $this->json((array) $requests->reject($id, $data, $this->user($request)));
    }

    private function orderCode(string $reference): string
    {
        $order = $this->orders->order($reference) ?? throw ApiException::notFound('La orden operativa no existe.');

        return (string) $order->code;
    }

    private function resourceType(string $type): string
    {
        return match ($type) {
            'guias', 'guide', 'guides' => 'guide',
            'conductores', 'driver', 'drivers' => 'driver',
            'vehiculos', 'vehicle', 'vehicles' => 'vehicle',
            default => throw ApiException::notFound('El tipo de recurso no existe.'),
        };
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
