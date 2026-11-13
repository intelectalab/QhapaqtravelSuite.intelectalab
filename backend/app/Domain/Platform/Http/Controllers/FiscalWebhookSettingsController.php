<?php

declare(strict_types=1);

namespace App\Domain\Platform\Http\Controllers;

use App\Domain\Platform\Actions\UpdateFiscalWebhook;
use App\Domain\Platform\Models\PlatformUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class FiscalWebhookSettingsController
{
    public function __invoke(Request $request, UpdateFiscalWebhook $webhook): JsonResponse
    {
        $data = $request->validate([
            'webhook_secret' => [$request->boolean('clear') ? 'nullable' : 'required', 'string', 'min:16', 'max:200', 'regex:/^\S+$/'],
            'clear' => ['sometimes', 'boolean'],
        ], [
            'webhook_secret.*' => 'El secreto lleva de 16 a 200 caracteres, sin espacios.',
            'clear.*' => 'Indica si quieres quitar el secreto.',
        ]);
        $user = $request->user('sanctum');
        assert($user instanceof PlatformUser);

        return response()->json(['data' => $webhook->update($data['webhook_secret'] ?? null, (bool) ($data['clear'] ?? false), $user)]);
    }
}
