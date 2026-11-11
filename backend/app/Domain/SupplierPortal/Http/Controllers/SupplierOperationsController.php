<?php

declare(strict_types=1);

namespace App\Domain\SupplierPortal\Http\Controllers;

use App\Domain\Iam\Models\User;
use App\Domain\Operations\Support\IncidentDirectory;
use App\Domain\SupplierPortal\Actions\SupplierIncidents;
use App\Domain\SupplierPortal\Actions\SupplierRooming;
use App\Domain\SupplierPortal\Actions\SupplierVouchers;
use App\Domain\SupplierPortal\Support\SupplierAccount;
use App\Domain\SupplierPortal\Support\SupplierOperations;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

final class SupplierOperationsController
{
    public function __construct(private readonly SupplierOperations $directory) {}

    public function rooming(Request $request): JsonResponse
    {
        return $this->json($this->directory->rooming($this->account($request)));
    }

    public function acknowledgeRooming(Request $request, string $id, SupplierRooming $rooming): JsonResponse
    {
        $rooming->acknowledge($this->account($request), $id, $this->version($request));

        return $this->json(['id' => $id]);
    }

    public function confirmRooming(Request $request, string $id, SupplierRooming $rooming): JsonResponse
    {
        return $this->json(['id' => $id, 'confirmed' => $rooming->confirm($this->account($request), $id, $this->version($request))]);
    }

    public function observeRoom(Request $request, string $id, SupplierRooming $rooming): JsonResponse
    {
        $account = $this->account($request);
        $data = $request->validate([
            'reason' => ['required', Rule::in(SupplierOperations::OBSERVATION_REASONS)],
            'impact' => ['required', Rule::in(SupplierOperations::OBSERVATION_IMPACTS)],
            'proposal' => ['required', 'string', 'min:5', 'max:1000'],
        ], [
            'reason.*' => 'Elija el motivo de la observación.',
            'impact.*' => 'Elija el impacto.',
            'proposal.*' => 'Describa la propuesta del hotel (mínimo 5 caracteres).',
        ]);

        return $this->json(['incident' => $rooming->observe($account, $id, $data)], 201);
    }

    public function vouchers(Request $request): JsonResponse
    {
        return $this->json($this->directory->vouchers($this->account($request)));
    }

    public function redeemVoucher(Request $request, SupplierVouchers $vouchers): JsonResponse
    {
        $account = $this->account($request);
        $data = $request->validate([
            'code' => ['required', 'string', 'min:4', 'max:40'],
            'confirm_future' => ['nullable', 'boolean'],
        ], ['code.*' => 'Escriba el código del voucher.']);

        return $this->json($vouchers->redeem($account, (string) $data['code'], (bool) ($data['confirm_future'] ?? false), $this->version($request)));
    }

    public function incidents(Request $request): JsonResponse
    {
        return $this->json($this->directory->incidents($this->account($request)));
    }

    public function incident(Request $request, string $code): JsonResponse
    {
        return $this->json($this->directory->incident($this->account($request), $code));
    }

    public function reportIncident(Request $request, SupplierIncidents $incidents): JsonResponse
    {
        $account = $this->account($request);
        $data = $request->validate([
            'service' => ['required', 'string', 'max:30'],
            'type' => ['required', Rule::in(SupplierOperations::INCIDENT_TYPES)],
            'severity' => ['required', Rule::in(IncidentDirectory::SEVERITIES)],
            'title' => ['required', 'string', 'min:5', 'max:150'],
            'description' => ['required', 'string', 'min:10', 'max:2000'],
        ], [
            'service.*' => 'Elija el servicio relacionado.',
            'type.*' => 'Elija el tipo de incidencia.',
            'severity.*' => 'Elija el impacto.',
            'title.*' => 'Escriba el asunto (mínimo 5 caracteres).',
            'description.*' => 'Describa lo ocurrido y su propuesta (mínimo 10 caracteres).',
        ]);

        return $this->json(['code' => $incidents->report($account, $data)], 201);
    }

    public function commentIncident(Request $request, string $code, SupplierIncidents $incidents): JsonResponse
    {
        $account = $this->account($request);
        $data = $request->validate(['message' => ['required', 'string', 'min:2', 'max:1000']], ['message.*' => 'Escriba el comentario.']);
        $incidents->comment($account, $code, trim((string) $data['message']));

        return $this->json(['code' => $code]);
    }

    private function version(Request $request): ?int
    {
        $value = $request->input('lock_version');

        return is_numeric($value) ? (int) $value : null;
    }

    private function account(Request $request): SupplierAccount
    {
        $user = $request->user();
        assert($user instanceof User);

        return SupplierAccount::of($user);
    }

    private function json(array $data, int $status = 200): JsonResponse
    {
        return response()->json(['data' => $data], $status);
    }
}
