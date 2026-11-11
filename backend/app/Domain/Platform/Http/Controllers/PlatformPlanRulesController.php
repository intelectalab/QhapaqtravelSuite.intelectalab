<?php

declare(strict_types=1);

namespace App\Domain\Platform\Http\Controllers;

use App\Domain\Platform\Actions\ManagePlanRules;
use App\Domain\Platform\Models\PlatformUser;
use App\Domain\Platform\Support\PlanRuleMatrix;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class PlatformPlanRulesController
{
    public function index(PlanRuleMatrix $matrix): JsonResponse
    {
        return response()->json(['data' => $matrix->overview()]);
    }

    public function update(string $code, Request $request, ManagePlanRules $rules): JsonResponse
    {
        $data = $request->validate(['min_plan' => ['required', 'string', 'max:20']], ['min_plan.required' => 'Elige desde qué plan se incluye la regla.']);
        $dryRun = $request->boolean('dry_run');

        return response()->json(['data' => $rules->change($code, $data['min_plan'], $dryRun, $this->user($request))]);
    }

    public function reset(Request $request, ManagePlanRules $rules): JsonResponse
    {
        return response()->json(['data' => $rules->reset($this->user($request))]);
    }

    private function user(Request $request): PlatformUser
    {
        $user = call_user_func($request->getUserResolver());

        if (! $user instanceof PlatformUser) {
            throw ApiException::forbidden(null, 'Esta acción es exclusiva de la consola de plataforma.');
        }

        return $user;
    }
}
