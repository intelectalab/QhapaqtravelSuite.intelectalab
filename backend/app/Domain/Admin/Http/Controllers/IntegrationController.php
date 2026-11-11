<?php

declare(strict_types=1);

namespace App\Domain\Admin\Http\Controllers;

use App\Domain\Admin\Actions\ManageIntegrations;
use App\Domain\Admin\Support\IntegrationDirectory;
use App\Domain\Iam\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

final class IntegrationController
{
    public function __construct(private readonly IntegrationDirectory $directory, private readonly ManageIntegrations $integrations) {}

    public function index(Request $request): JsonResponse
    {
        return response()->json($this->directory->adaptersPage($request, $this->user($request)));
    }

    public function configure(Request $request, string $id): JsonResponse
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
        $this->integrations->configure($id, $data, $this->user($request));

        return response()->json(['data' => $this->directory->adapterById($id)]);
    }

    public function test(Request $request, string $id): JsonResponse
    {
        $result = $this->integrations->test($id, $this->user($request));

        return response()->json(['data' => $this->directory->adapterById($id), 'meta' => $result]);
    }

    public function jobs(Request $request): JsonResponse
    {
        return response()->json($this->directory->jobsPage($request, $this->user($request)));
    }

    public function pause(string $id): JsonResponse
    {
        $this->integrations->job($id, 'pause');

        return response()->json(['data' => $this->directory->jobById($id)]);
    }

    public function resume(string $id): JsonResponse
    {
        $this->integrations->job($id, 'resume');

        return response()->json(['data' => $this->directory->jobById($id)]);
    }

    public function run(Request $request, string $id): JsonResponse
    {
        return response()->json(['data' => $this->integrations->run($id, $this->user($request))], 202);
    }

    public function pauseSchedule(Request $request, string $id): JsonResponse
    {
        $this->integrations->reportSchedule($id, 'pause', $this->user($request));

        return response()->json(['data' => ['code' => $id, 'paused' => true]]);
    }

    public function resumeSchedule(Request $request, string $id): JsonResponse
    {
        $this->integrations->reportSchedule($id, 'resume', $this->user($request));

        return response()->json(['data' => ['code' => $id, 'paused' => false]]);
    }

    public function destroyJob(Request $request, string $id): Response
    {
        $this->integrations->delete($id, $this->user($request));

        return response()->noContent();
    }

    public function errors(Request $request): JsonResponse
    {
        return response()->json($this->directory->errorsPage($request, $this->user($request)));
    }

    public function retryError(Request $request, string $id): JsonResponse
    {
        $this->integrations->retryError($id, $this->user($request));

        return response()->json(['data' => $this->directory->errorById($id)]);
    }

    public function resolveError(Request $request, string $id): JsonResponse
    {
        $data = $request->validate(['resolution' => ['required', 'string', 'min:5', 'max:500']], ['resolution.*' => 'Describe cómo se resolvió (INT-BR-06).']);
        $this->integrations->resolveError($id, $data['resolution'], $this->user($request));

        return response()->json(['data' => $this->directory->errorById($id)]);
    }

    private function user(Request $request): User
    {
        $user = $request->user();
        assert($user instanceof User);

        return $user;
    }
}
