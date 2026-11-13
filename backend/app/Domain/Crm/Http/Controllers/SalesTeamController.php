<?php

declare(strict_types=1);

namespace App\Domain\Crm\Http\Controllers;

use App\Domain\Crm\Actions\SalesTeamWorkflow;
use App\Domain\Crm\Support\SalesTargetDirectory;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

final class SalesTeamController
{
    public function teams(Request $request, SalesTeamWorkflow $workflow): JsonResponse
    {
        return response()->json(['data' => $workflow->teams($this->user($request))]);
    }

    public function saveTeams(Request $request, SalesTeamWorkflow $workflow): JsonResponse
    {
        $data = $request->validate([
            'teams' => ['present', 'array', 'max:30'],
            'teams.*.code' => ['nullable', 'string', 'max:20'],
            'teams.*.name' => ['required', 'string', 'min:3', 'max:120'],
            'teams.*.leader_id' => ['nullable', 'uuid'],
            'teams.*.members' => ['present', 'array', 'max:60'],
            'teams.*.members.*' => ['uuid'],
        ], [
            'teams.*.name.*' => 'Cada equipo necesita un nombre de 3 a 120 caracteres.',
            'teams.*.leader_id.*' => 'Elige un líder de la lista.',
            'teams.*.members.*' => 'Elige integrantes de la lista.',
        ]);
        $user = $this->user($request);
        $workflow->saveTeams($data['teams'], $user);

        return response()->json(['data' => $workflow->teams($user)]);
    }

    public function policy(SalesTeamWorkflow $workflow): JsonResponse
    {
        return response()->json(['data' => [...$workflow->policy(), 'metrics' => collect(SalesTeamWorkflow::METRICS)->map(fn (string $label, string $value): array => ['value' => $value, 'label' => $label])->values()]]);
    }

    public function savePolicy(Request $request, SalesTeamWorkflow $workflow): JsonResponse
    {
        $data = $request->validate([
            'tiers' => ['required', 'array', 'min:1', 'max:5'],
            'tiers.*.min' => ['required', 'integer', 'between:1,200'],
            'tiers.*.pay' => ['required', 'integer', 'between:0,200'],
            'primary_metric' => ['nullable', Rule::in(array_keys(SalesTeamWorkflow::METRICS))],
            'lock_decrease_after_pct' => ['nullable', 'integer', 'between:0,100'],
            'attribution_window_days' => ['nullable', 'integer', 'between:1,90'],
        ], [
            'tiers.required' => 'Define al menos un tramo de bono.',
            'tiers.max' => 'La política admite hasta cinco tramos.',
            'tiers.*.min.*' => 'El cumplimiento de cada tramo va de 1 % a 200 %.',
            'tiers.*.pay.*' => 'El pago de cada tramo va de 0 % a 200 % del bono.',
            'primary_metric.*' => 'Elige la métrica principal de la lista.',
            'lock_decrease_after_pct.*' => 'El bloqueo para reducir metas va de 0 % a 100 % del período.',
            'attribution_window_days.*' => 'La ventana de atribución va de 1 a 90 días.',
        ]);

        return response()->json(['data' => $workflow->savePolicy($data, $this->user($request))]);
    }

    public function ranking(Request $request, SalesTargetDirectory $directory): JsonResponse
    {
        $period = $request->query('period');

        if ($period !== null && (! is_string($period) || preg_match('/^\d{4}-(\d{2}|Q[1-4])$/', $period) !== 1)) {
            throw ApiException::unprocessable('VALIDATION_ERROR', 'Indica el período como mes (2026-09) o trimestre (2026-Q3).');
        }

        return response()->json(['data' => $directory->rankingFor($this->user($request), $period)]);
    }

    private function user(Request $request): User
    {
        $user = $request->user();
        assert($user instanceof User);

        return $user;
    }
}
