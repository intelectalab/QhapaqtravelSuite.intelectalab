<?php

declare(strict_types=1);

namespace App\Domain\Portal\Http\Controllers;

use App\Domain\Iam\Models\User;
use App\Domain\Portal\Actions\PassengerPasses;
use App\Domain\Portal\Support\PortalAccount;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;

final class PassengerPassController
{
    public function index(Request $request, PassengerPasses $passes): JsonResponse
    {
        $trip = $request->query('trip');

        return response()->json(['data' => $passes->overview($this->account($request), is_string($trip) && $trip !== '' ? $trip : null)]);
    }

    public function sign(Request $request, PassengerPasses $passes): JsonResponse
    {
        $data = $request->validate([
            'passenger_id' => ['required', 'uuid'],
            'template_code' => ['required', 'string', 'max:30'],
            'signed_name' => ['required', 'string', 'min:3', 'max:160'],
            'guardian_name' => ['nullable', 'string', 'min:3', 'max:160'],
            'file' => ['required', 'file', 'mimes:png,jpg,jpeg,webp', 'max:1024'],
        ], [
            'passenger_id.*' => 'Elige el pasajero que firma.',
            'template_code.*' => 'Falta el deslinde que se firma.',
            'signed_name.*' => 'Escribe tu nombre completo tal como firmas.',
            'guardian_name.*' => 'Escribe el nombre completo del tutor.',
            'file.required' => 'Dibuja tu firma antes de enviar.',
            'file.mimes' => 'La firma debe ser una imagen PNG o JPG.',
            'file.max' => 'La imagen de la firma supera 1 MB.',
            'file.*' => 'Dibuja tu firma antes de enviar.',
        ]);

        $file = $request->file('file');
        assert($file instanceof UploadedFile);

        return response()->json(['data' => $passes->sign($this->account($request), $data, $file)]);
    }

    private function account(Request $request): PortalAccount
    {
        $user = $request->user();
        assert($user instanceof User);

        return PortalAccount::of($user);
    }
}
