<?php

declare(strict_types=1);

namespace App\Domain\Platform\Http\Controllers;

use App\Domain\Platform\Actions\ManagePayloadWebhook;
use App\Domain\Platform\Models\PlatformUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class PayloadWebhookSettingsController
{
    public function __construct(private readonly ManagePayloadWebhook $payload) {}

    public function show(): JsonResponse
    {
        return response()->json(['data' => $this->payload->overview()]);
    }

    public function update(Request $request): JsonResponse
    {
        $data = $request->validate([
            'admin_url' => ['required', 'string', 'max:300', 'url:https'],
        ], [
            'admin_url.*' => 'Escribe la dirección completa del admin de Payload, con https://.',
        ]);

        return response()->json(['data' => $this->payload->updateAdminUrl((string) $data['admin_url'], $this->actor($request))]);
    }

    public function generate(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->payload->generate($this->actor($request))]);
    }

    private function actor(Request $request): PlatformUser
    {
        $user = $request->user('sanctum');
        assert($user instanceof PlatformUser);

        return $user;
    }
}
