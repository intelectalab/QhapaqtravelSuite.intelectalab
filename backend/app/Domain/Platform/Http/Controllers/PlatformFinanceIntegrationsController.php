<?php

declare(strict_types=1);

namespace App\Domain\Platform\Http\Controllers;

use App\Domain\Platform\Actions\ManageFxProviders;
use App\Domain\Platform\Actions\ManageOse;
use App\Domain\Platform\Models\PlatformUser;
use App\Domain\Platform\Support\FxProviderCatalog;
use App\Domain\Platform\Support\OseCatalog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

final class PlatformFinanceIntegrationsController
{
    public const CODE = ['required', 'string', 'regex:/^[A-Za-z0-9-]{3,20}$/'];

    private const MESSAGES = [
        'code.*' => 'El código lleva de 3 a 20 letras, números o guiones.',
        'name.*' => 'Escribe el nombre (3 a 120 caracteres).',
        'driver.*' => 'Elige el tipo de conexión.',
        'note.*' => 'La nota admite hasta 300 caracteres.',
        'status.*' => 'Elige el estado.',
        'credentials.*' => 'Revisa las credenciales (hasta 500 caracteres cada una).',
    ];

    public function fxProviders(ManageFxProviders $providers): JsonResponse
    {
        return response()->json(['data' => $providers->overview()]);
    }

    public function storeFxProvider(Request $request, ManageFxProviders $providers): JsonResponse
    {
        $data = $request->validate([
            'code' => self::CODE,
            'name' => ['required', 'string', 'min:3', 'max:120'],
            'driver' => ['required', Rule::in(array_keys(FxProviderCatalog::DRIVERS))],
            'note' => ['nullable', 'string', 'max:300'],
            'credentials' => ['sometimes', 'array'],
            'credentials.*' => ['nullable', 'string', 'max:500'],
        ], self::MESSAGES);

        return response()->json(['data' => $providers->create($data, $this->user($request))], 201);
    }

    public function updateFxProvider(Request $request, string $code, ManageFxProviders $providers): JsonResponse
    {
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'min:3', 'max:120'],
            'note' => ['sometimes', 'nullable', 'string', 'max:300'],
            'credentials' => ['sometimes', 'array'],
            'credentials.*' => ['nullable', 'string', 'max:500'],
        ], self::MESSAGES);

        return response()->json(['data' => $providers->update($code, $data, $this->user($request))]);
    }

    public function destroyFxProvider(Request $request, string $code, ManageFxProviders $providers): JsonResponse
    {
        $providers->delete($code, $this->user($request));

        return response()->json(['data' => ['deleted' => true]]);
    }

    public function testFxProvider(Request $request, string $code, ManageFxProviders $providers): JsonResponse
    {
        return response()->json(['data' => $providers->test($code, $this->user($request))]);
    }

    public function oseProviders(ManageOse $ose): JsonResponse
    {
        return response()->json(['data' => $ose->overview()]);
    }

    public function storeOseProvider(Request $request, ManageOse $ose): JsonResponse
    {
        $data = $request->validate([
            'code' => self::CODE,
            'name' => ['required', 'string', 'min:3', 'max:120'],
            'driver' => ['required', Rule::in(array_keys(OseCatalog::DRIVERS))],
            'status' => ['sometimes', Rule::in(array_keys(OseCatalog::STATUS))],
            'note' => ['nullable', 'string', 'max:300'],
        ], self::MESSAGES);

        return response()->json(['data' => $ose->create($data, $this->user($request))], 201);
    }

    public function updateOseProvider(Request $request, string $code, ManageOse $ose): JsonResponse
    {
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'min:3', 'max:120'],
            'status' => ['sometimes', Rule::in(array_keys(OseCatalog::STATUS))],
            'note' => ['sometimes', 'nullable', 'string', 'max:300'],
        ], self::MESSAGES);

        return response()->json(['data' => $ose->update($code, $data, $this->user($request))]);
    }

    public function destroyOseProvider(Request $request, string $code, ManageOse $ose): JsonResponse
    {
        $ose->delete($code, $this->user($request));

        return response()->json(['data' => ['deleted' => true]]);
    }

    public function generateOseWebhookSecret(Request $request, string $code, ManageOse $ose): JsonResponse
    {
        return response()->json(['data' => $ose->generateWebhookSecret($code, $this->user($request))]);
    }

    public function tenantOse(string $id, ManageOse $ose): JsonResponse
    {
        return response()->json(['data' => $ose->tenant($id)]);
    }

    public function saveTenantOseCredentials(Request $request, string $id, ManageOse $ose): JsonResponse
    {
        $data = $request->validate([
            'credentials' => ['required', 'array'],
            'credentials.*' => ['nullable', 'string', 'max:500'],
        ], self::MESSAGES);

        return response()->json(['data' => $ose->saveCredentials($id, $data['credentials'], $this->user($request))]);
    }

    public function clearTenantOseCredentials(Request $request, string $id, ManageOse $ose): JsonResponse
    {
        return response()->json(['data' => $ose->clearCredentials($id, $this->user($request))]);
    }

    public function testTenantOse(Request $request, string $id, ManageOse $ose): JsonResponse
    {
        return response()->json(['data' => $ose->test($id, $this->user($request))]);
    }

    private function user(Request $request): PlatformUser
    {
        $user = $request->user('sanctum');
        assert($user instanceof PlatformUser);

        return $user;
    }
}
