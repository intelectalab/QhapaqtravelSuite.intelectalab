<?php

declare(strict_types=1);

namespace App\Domain\Admin\Http\Controllers;

use App\Domain\Admin\Actions\ManageIntegrations;
use App\Domain\Admin\Support\IntegrationDirectory;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class IntegrationController
{
    public function index(Request $request, IntegrationDirectory $directory): JsonResponse
    {
        return response()->json(['data' => $directory->overview($this->user($request))]);
    }

    public function configure(Request $request, string $code, ManageIntegrations $integrations): JsonResponse
    {
        $data = $request->validate([
            'environment' => ['required', 'in:sandbox,production'],
            'owner_user_id' => ['nullable', 'uuid', 'exists:iam_users,id'],
            'max_retries' => ['required', 'integer', 'between:0,10'],
            'backoff_base_s' => ['required', 'integer', 'between:5,3600'],
            'timeout_s' => ['required', 'integer', 'between:5,120'],
        ], [
            'environment.*' => 'Elige el entorno.',
            'owner_user_id.*' => 'Elige un responsable activo.',
            'max_retries.*' => 'Los reintentos van de 0 a 10.',
            'backoff_base_s.*' => 'La espera base va de 5 a 3 600 segundos.',
            'timeout_s.*' => 'El tiempo de espera va de 5 a 120 segundos.',
        ]);
        $integrations->configure($code, $data, $this->user($request));

        return response()->json(['data' => ['code' => $code]]);
    }

    public function test(Request $request, string $code, ManageIntegrations $integrations): JsonResponse
    {
        return response()->json(['data' => $integrations->test($code, $this->user($request))]);
    }

    public function job(string $code, string $mode, ManageIntegrations $integrations): JsonResponse
    {
        if (! in_array($mode, ['pause', 'resume'], true)) {
            throw ApiException::notFound('La acción no existe.');
        }

        $integrations->job($code, $mode);

        return response()->json(['data' => ['code' => $code]]);
    }

    public function retryError(string $code, ManageIntegrations $integrations): JsonResponse
    {
        $integrations->retryError($code);

        return response()->json(['data' => ['code' => $code]]);
    }

    public function resolveError(Request $request, string $code, ManageIntegrations $integrations): JsonResponse
    {
        $data = $request->validate(['resolution' => ['required', 'string', 'min:5', 'max:500']], ['resolution.*' => 'Describe cómo se resolvió (INT-BR-06).']);
        $integrations->resolveError($code, $data['resolution'], $this->user($request));

        return response()->json(['data' => ['code' => $code]]);
    }

    private function user(Request $request): User
    {
        $user = $request->user();
        assert($user instanceof User);

        return $user;
    }
}
