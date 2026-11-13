<?php

declare(strict_types=1);

namespace App\Domain\Operations\Http\Controllers;

use App\Domain\Iam\Models\User;
use App\Domain\Operations\Actions\Checkin;
use App\Domain\Operations\Actions\WaiverTemplates;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class CheckinController
{
    public function scan(Request $request, Checkin $checkin): JsonResponse
    {
        $data = $request->validate([
            'token' => ['required', 'string', 'min:20', 'max:120'],
            'device_id' => ['nullable', 'string', 'max:80'],
        ], ['token.*' => 'Escanea el código QR del pase.', 'device_id.*' => 'El identificador del equipo admite hasta 80 caracteres.']);

        return response()->json(['data' => $checkin->scan($data['token'], $data['device_id'] ?? null, $this->user($request))]);
    }

    public function manifest(Request $request, string $serviceId, Checkin $checkin): JsonResponse
    {
        return response()->json(['data' => $checkin->manifest($serviceId, $this->user($request))]);
    }

    public function templates(WaiverTemplates $templates): JsonResponse
    {
        return response()->json(['data' => $templates->list()]);
    }

    public function storeTemplate(Request $request, WaiverTemplates $templates): JsonResponse
    {
        $data = $request->validate(WaiverTemplates::rules(), WaiverTemplates::messages());

        return response()->json(['data' => $templates->create($data, $this->user($request))]);
    }

    private function user(Request $request): User
    {
        $user = $request->user();
        assert($user instanceof User);

        return $user;
    }
}
