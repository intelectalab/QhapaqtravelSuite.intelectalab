<?php

declare(strict_types=1);

namespace App\Domain\Platform\Http\Controllers;

use App\Domain\Platform\Actions\UpdateWhatsappWebhook;
use App\Domain\Platform\Models\PlatformUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class WhatsappWebhookSettingsController
{
    public function __invoke(Request $request, UpdateWhatsappWebhook $webhook): JsonResponse
    {
        $data = $request->validate([
            'verify_token' => [$request->boolean('clear') ? 'nullable' : 'required', 'string', 'min:12', 'max:120', 'regex:/^[A-Za-z0-9._~-]+$/'],
            'clear' => ['sometimes', 'boolean'],
        ], [
            'verify_token.*' => 'El token lleva de 12 a 120 caracteres: letras, números, punto, guion, guion bajo o virgulilla.',
            'clear.*' => 'Indica si quieres quitar el token.',
        ]);
        $user = $request->user('sanctum');
        assert($user instanceof PlatformUser);

        return response()->json(['data' => $webhook->update($data['verify_token'] ?? null, (bool) ($data['clear'] ?? false), $user)]);
    }
}
