<?php

declare(strict_types=1);

namespace App\Domain\Admin\Http\Controllers;

use App\Domain\Admin\Actions\ManageApiAccess;
use App\Domain\Admin\Support\ApiDirectory;
use App\Domain\Iam\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class ApiAccessController
{
    public function index(Request $request, ApiDirectory $directory): JsonResponse
    {
        return response()->json(['data' => $directory->overview($this->user($request))]);
    }

    public function storeKey(Request $request, ManageApiAccess $access): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'min:3', 'max:120'],
            'environment' => ['required', 'in:live,test'],
            'scopes' => ['required', 'array', 'min:1'],
            'scopes.*' => ['in:'.implode(',', array_keys(ApiDirectory::SCOPES))],
            'expires_at' => ['nullable', 'date', 'after:today'],
            'ips' => ['nullable', 'array', 'max:10'],
            'ips.*' => ['ip'],
        ], [
            'name.*' => 'Ponle un nombre que diga para qué se usa.',
            'environment.*' => 'Elige el entorno.',
            'scopes.required' => 'Elige al menos un permiso.',
            'scopes.*' => 'Elige permisos de la lista.',
            'expires_at.*' => 'La fecha de vencimiento debe ser futura.',
            'ips.*' => 'Escribe direcciones IP válidas, separadas por comas.',
        ]);

        return response()->json(['data' => $access->createKey($data, $this->user($request))], 201);
    }

    public function revokeKey(Request $request, string $code, ManageApiAccess $access): JsonResponse
    {
        $data = $request->validate(['reason' => ['required', 'string', 'min:3', 'max:300']], ['reason.*' => 'Cuéntanos por qué la revocas.']);
        $access->revokeKey($code, $data['reason'], $this->user($request));

        return response()->json(['data' => ['code' => $code]]);
    }

    public function storeWebhook(Request $request, ManageApiAccess $access): JsonResponse
    {
        return response()->json(['data' => $access->createWebhook($this->webhook($request), $this->user($request))], 201);
    }

    public function updateWebhook(Request $request, string $code, ManageApiAccess $access): JsonResponse
    {
        $access->updateWebhook($code, $this->webhook($request), $this->user($request));

        return response()->json(['data' => ['code' => $code]]);
    }

    public function webhookStatus(Request $request, string $code, string $mode, ManageApiAccess $access): JsonResponse
    {
        $access->status($code, $mode, $this->user($request));

        return response()->json(['data' => ['code' => $code]]);
    }

    public function destroyWebhook(Request $request, string $code, ManageApiAccess $access): JsonResponse
    {
        $access->deleteWebhook($code, $this->user($request));

        return response()->json(['data' => ['code' => $code]]);
    }

    private function webhook(Request $request): array
    {
        return $request->validate([
            'url' => ['required', 'string', 'max:500', 'url:https'],
            'description' => ['nullable', 'string', 'max:200'],
            'events' => ['required', 'array', 'min:1'],
            'events.*' => ['in:'.implode(',', array_keys(ApiDirectory::EVENTS))],
        ], [
            'url.*' => 'Escribe una URL válida que empiece con https:// (API-BR-05).',
            'description.*' => 'La descripción admite hasta 200 caracteres.',
            'events.required' => 'Elige al menos un evento.',
            'events.*' => 'Elige eventos de la lista.',
        ]);
    }

    private function user(Request $request): User
    {
        $user = $request->user();
        assert($user instanceof User);

        return $user;
    }
}
