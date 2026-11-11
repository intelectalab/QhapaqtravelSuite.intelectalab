<?php

declare(strict_types=1);

namespace App\Domain\Marketing\Http\Controllers;

use App\Domain\Iam\Models\User;
use App\Domain\Marketing\Actions\AutomationWorkflow;
use App\Domain\Marketing\Support\AutomationDirectory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class AutomationController
{
    public function index(Request $request, AutomationDirectory $directory): JsonResponse
    {
        return response()->json(['data' => $directory->overview($this->user($request))]);
    }

    public function update(Request $request, string $code, AutomationWorkflow $workflow): JsonResponse
    {
        $data = $request->validate([
            'template' => ['required', 'string', 'max:20'],
            'delay' => ['required', 'string', 'min:3', 'max:80'],
        ], [
            'template.*' => 'Elige una plantilla.',
            'delay.*' => 'Describe la espera o la programación (de 3 a 80 caracteres).',
        ]);
        $workflow->configure($code, $data, $this->user($request));

        return response()->json(['data' => ['code' => $code]]);
    }

    public function activate(Request $request, string $code, AutomationWorkflow $workflow): JsonResponse
    {
        $workflow->activate($code, $this->user($request));

        return response()->json(['data' => ['code' => $code]]);
    }

    public function pause(Request $request, string $code, AutomationWorkflow $workflow): JsonResponse
    {
        $workflow->pause($code, $this->user($request));

        return response()->json(['data' => ['code' => $code]]);
    }

    public function run(Request $request, string $code, AutomationWorkflow $workflow): JsonResponse
    {
        return response()->json(['data' => ['code' => $code, ...$workflow->run($code, $this->user($request))]]);
    }

    private function user(Request $request): User
    {
        $user = $request->user();
        assert($user instanceof User);

        return $user;
    }
}
