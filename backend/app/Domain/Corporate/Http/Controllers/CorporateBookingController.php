<?php

declare(strict_types=1);

namespace App\Domain\Corporate\Http\Controllers;

use App\Domain\Corporate\Actions\CorporateApprovals;
use App\Domain\Corporate\Actions\CostAllocations;
use App\Domain\Iam\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class CorporateBookingController
{
    public function allocations(string $code, CostAllocations $allocations): JsonResponse
    {
        return response()->json(['data' => $allocations->show($code)]);
    }

    public function replaceAllocations(Request $request, string $code, CostAllocations $allocations): JsonResponse
    {
        $data = $request->validate([
            'allocations' => ['required', 'array', 'min:1', 'max:50'],
            'allocations.*.cost_center_id' => ['required_without:allocations.*.cost_center', 'nullable', 'string', 'max:40'],
            'allocations.*.cost_center' => ['required_without:allocations.*.cost_center_id', 'nullable', 'string', 'max:40'],
            'allocations.*.traveler_id' => ['nullable', 'uuid'],
            'allocations.*.pct' => ['required', 'numeric', 'gt:0', 'max:100'],
        ], [
            'allocations.required' => 'Agrega al menos una línea al reparto.',
            'allocations.*.cost_center_id.*' => 'Elige el centro de costo de cada línea.',
            'allocations.*.cost_center.*' => 'Elige el centro de costo de cada línea.',
            'allocations.*.traveler_id.*' => 'Elige un viajero de la cuenta.',
            'allocations.*.pct.*' => 'Cada porcentaje va de 0,01 a 100.',
        ]);

        return response()->json(['data' => $allocations->replace($code, $data['allocations'], (int) $request->input('lock_version'), $this->user($request))]);
    }

    public function requestApproval(Request $request, string $code, CorporateApprovals $approvals): JsonResponse
    {
        $data = $request->validate(['cost_center' => ['nullable', 'string', 'max:40']], ['cost_center.*' => 'Elige un centro de costo de la empresa.']);

        return response()->json(['data' => $approvals->request($code, $data, $this->user($request))]);
    }

    private function user(Request $request): User
    {
        $user = $request->user();
        assert($user instanceof User);

        return $user;
    }
}
