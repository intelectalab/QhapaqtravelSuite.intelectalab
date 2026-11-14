<?php

declare(strict_types=1);

namespace App\Domain\Platform\Http\Controllers;

use App\Domain\Platform\Actions\UpdateWhatsappApp;
use App\Domain\Platform\Models\PlatformUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class WhatsappAppSettingsController
{
    public function __construct(private readonly UpdateWhatsappApp $app) {}

    public function show(): JsonResponse
    {
        return response()->json(['data' => $this->app->overview()]);
    }

    public function update(Request $request): JsonResponse
    {
        $data = $request->validate([
            'app_id' => ['sometimes', 'required', 'string', 'regex:/^[0-9]{6,20}$/'],
            'app_secret' => ['nullable', 'string', 'min:16', 'max:200', 'regex:/^\S+$/'],
            'verify_token' => ['nullable', 'string', 'min:12', 'max:120', 'regex:/^[A-Za-z0-9._~-]+$/'],
            'config_id' => ['nullable', 'string', 'max:40', 'regex:/^[0-9]*$/'],
            'api_version' => ['sometimes', 'required', 'string', 'regex:/^v[0-9]{2}\.[0-9]$/'],
        ], [
            'app_id.*' => 'El ID de la app son solo dígitos (de 6 a 20), tal como aparece en Meta for Developers.',
            'app_secret.*' => 'El secreto de la app lleva de 16 a 200 caracteres, sin espacios.',
            'verify_token.*' => 'El token lleva de 12 a 120 caracteres: letras, números, punto, guion, guion bajo o virgulilla.',
            'config_id.*' => 'El ID de configuración del registro guiado son solo dígitos.',
            'api_version.*' => 'Escribe la versión como v21.0.',
        ]);

        return response()->json(['data' => $this->app->update($data, $this->actor($request))]);
    }

    public function test(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->app->test($this->actor($request))]);
    }

    private function actor(Request $request): PlatformUser
    {
        $user = $request->user('sanctum');
        assert($user instanceof PlatformUser);

        return $user;
    }
}
