<?php

declare(strict_types=1);

namespace App\Domain\Platform\Http\Controllers;

use App\Domain\Platform\Actions\UpdateMobileAppVersions;
use App\Domain\Platform\Models\PlatformUser;
use App\Domain\Platform\Support\MobileAppVersions;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class MobileAppVersionController
{
    public function show(MobileAppVersions $versions): JsonResponse
    {
        return response()->json(['data' => $versions->summary()]);
    }

    public function update(Request $request, UpdateMobileAppVersions $update): JsonResponse
    {
        $rules = [];
        $messages = [];

        foreach (MobileAppVersions::PLATFORMS as $platform => $label) {
            $rules["{$platform}.min_version"] = ['nullable', 'string', 'max:20', 'regex:'.MobileAppVersions::VERSION_PATTERN];
            $rules["{$platform}.store_url"] = ['nullable', 'url:https', 'max:300'];
            $messages["{$platform}.min_version.*"] = "La versión mínima de {$label} se escribe como 1.4.0.";
            $messages["{$platform}.store_url.*"] = "El enlace a la tienda de {$label} debe ser una dirección https.";
        }

        $data = $request->validate([...$rules, 'ios' => ['present', 'array'], 'android' => ['present', 'array']], [...$messages, 'ios.*' => 'Envía los datos de iOS.', 'android.*' => 'Envía los datos de Android.']);
        $user = $request->user('sanctum');
        assert($user instanceof PlatformUser);

        return response()->json(['data' => $update->update($data, $user)]);
    }
}
