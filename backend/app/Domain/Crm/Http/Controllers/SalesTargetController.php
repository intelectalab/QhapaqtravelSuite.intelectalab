<?php

declare(strict_types=1);

namespace App\Domain\Crm\Http\Controllers;

use App\Domain\Crm\Actions\SalesTargetWorkflow;
use App\Domain\Crm\Support\SalesTargetDirectory;
use App\Domain\Iam\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class SalesTargetController
{
    public function index(Request $request, SalesTargetDirectory $directory): JsonResponse
    {
        return response()->json(['data' => $directory->overview($this->user($request))]);
    }

    public function show(Request $request, string $code, SalesTargetDirectory $directory): JsonResponse
    {
        return response()->json(['data' => $directory->detail($code, $this->user($request))]);
    }

    public function store(Request $request, SalesTargetWorkflow $workflow): JsonResponse
    {
        $data = $request->validate([
            'scope_type' => ['required', 'in:'.implode(',', array_keys(SalesTargetDirectory::SCOPES))],
            'scope_id' => ['required', 'uuid'],
            'period' => ['required', 'regex:/^\d{4}-(\d{2}|Q[1-4])$/'],
            'activate' => ['nullable', 'boolean'],
            ...$this->goalRules(),
        ], ['scope_type.*' => 'Elige el alcance de la meta.', 'scope_id.*' => 'Elige a quién corresponde la meta.', 'period.*' => 'Elige el período.', ...$this->goalMessages()]);

        return response()->json(['data' => ['code' => $workflow->create($data, $this->user($request))]], 201);
    }

    public function update(Request $request, string $code, SalesTargetWorkflow $workflow): JsonResponse
    {
        $data = $request->validate([...$this->goalRules(), 'reason' => ['required', 'string', 'min:5', 'max:500']], [...$this->goalMessages(), 'reason.*' => 'Explica el motivo del ajuste (MET-BR-04).']);
        $workflow->adjust($code, $data, $this->user($request));

        return response()->json(['data' => ['code' => $code]]);
    }

    public function activate(Request $request, string $code, SalesTargetWorkflow $workflow): JsonResponse
    {
        $workflow->activate($code, $this->user($request));

        return response()->json(['data' => ['code' => $code]]);
    }

    public function void(Request $request, string $code, SalesTargetWorkflow $workflow): JsonResponse
    {
        $data = $request->validate(['reason' => ['required', 'string', 'min:5', 'max:500']], ['reason.*' => 'Explica por qué se anula.']);
        $workflow->void($code, $data['reason'], $this->user($request));

        return response()->json(['data' => ['code' => $code]]);
    }

    public function close(Request $request, string $code, SalesTargetWorkflow $workflow): JsonResponse
    {
        $workflow->close($code, $this->user($request));

        return response()->json(['data' => ['code' => $code]]);
    }

    private function goalRules(): array
    {
        return [
            'goal_sales' => ['required', 'numeric', 'gt:0', 'max:99999999'],
            'goal_bookings' => ['nullable', 'integer', 'min:0', 'max:100000'],
            'goal_margin' => ['nullable', 'numeric', 'min:0', 'max:99999999'],
            'goal_conversion' => ['nullable', 'numeric', 'between:0,100'],
            'bonus_amount' => ['nullable', 'numeric', 'min:0', 'max:1000000'],
        ];
    }

    private function goalMessages(): array
    {
        return [
            'goal_sales.*' => 'La meta de ventas debe ser mayor que cero (MET-BR-02).',
            'goal_bookings.*' => 'Las reservas deben ser un número entero.',
            'goal_margin.*' => 'Revisa la meta de margen.',
            'goal_conversion.*' => 'La conversión va de 0 a 100 %.',
            'bonus_amount.*' => 'Revisa el bono.',
        ];
    }

    private function user(Request $request): User
    {
        $user = $request->user();
        assert($user instanceof User);

        return $user;
    }
}
