<?php

declare(strict_types=1);

namespace App\Domain\Platform\Http\Controllers;

use App\Domain\Platform\Actions\RunPlatformJob;
use App\Domain\Platform\Models\PlatformUser;
use App\Domain\Platform\Support\PlatformAudit;
use App\Domain\Platform\Support\PlatformHome;
use App\Domain\Platform\Support\PlatformOperations;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class PlatformOperationsController
{
    public function home(PlatformHome $home): JsonResponse
    {
        return response()->json(['data' => $home->overview()]);
    }

    public function operations(PlatformOperations $operations): JsonResponse
    {
        return response()->json(['data' => $operations->overview()]);
    }

    public function runJob(string $code, Request $request, RunPlatformJob $jobs): JsonResponse
    {
        return response()->json(['data' => ['result' => $jobs->run($code, $this->user($request))]]);
    }

    public function pauseJob(string $code, Request $request, RunPlatformJob $jobs): JsonResponse
    {
        $data = $request->validate(['paused' => ['required', 'boolean']]);
        $jobs->setPaused($code, (bool) $data['paused'], $this->user($request));

        return response()->json(['data' => ['paused' => (bool) $data['paused']]]);
    }

    public function audit(Request $request, PlatformAudit $audit): JsonResponse
    {
        return response()->json($audit->page($request));
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
