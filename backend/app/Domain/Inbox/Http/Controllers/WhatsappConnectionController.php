<?php

declare(strict_types=1);

namespace App\Domain\Inbox\Http\Controllers;

use App\Domain\Iam\Models\User;
use App\Domain\Inbox\Actions\WhatsappConnection;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class WhatsappConnectionController
{
    public function __construct(private readonly WhatsappConnection $connection) {}

    public function show(): JsonResponse
    {
        return response()->json(['data' => $this->connection->overview()]);
    }

    public function connect(Request $request): JsonResponse
    {
        $data = $request->validate([
            'code' => ['required', 'string', 'max:200'],
            'phone_number_id' => ['nullable', 'string', 'regex:/^[0-9]{5,30}$/'],
            'waba_id' => ['nullable', 'string', 'regex:/^[0-9]{5,30}$/'],
        ], [
            'code.*' => 'Falta el código que devuelve Meta al terminar el registro.',
            'phone_number_id.*' => 'El ID del número son solo dígitos.',
            'waba_id.*' => 'El ID de la cuenta de WhatsApp Business son solo dígitos.',
        ]);

        return response()->json(['data' => $this->connection->connect($data, $this->actor($request))]);
    }

    public function ownApp(Request $request): JsonResponse
    {
        $data = $request->validate([
            'app_id' => ['required', 'string', 'regex:/^[0-9]{6,20}$/'],
            'app_secret' => ['nullable', 'string', 'min:16', 'max:200', 'regex:/^\S+$/'],
            'access_token' => ['nullable', 'string', 'min:20', 'max:600', 'regex:/^\S+$/'],
            'phone_number_id' => ['required', 'string', 'regex:/^[0-9]{5,30}$/'],
            'waba_id' => ['nullable', 'string', 'regex:/^[0-9]{5,30}$/'],
        ], [
            'app_id.*' => 'El ID de la app son solo dígitos, tal como aparece en Meta for Developers.',
            'app_secret.*' => 'El secreto de la app lleva de 16 a 200 caracteres, sin espacios.',
            'access_token.*' => 'Pega el token permanente completo, sin espacios.',
            'phone_number_id.*' => 'El ID del número son solo dígitos: Meta → WhatsApp → Configuración de la API.',
            'waba_id.*' => 'El ID de la cuenta de WhatsApp Business son solo dígitos.',
        ]);

        return response()->json(['data' => $this->connection->saveOwnApp($data, $this->actor($request))]);
    }

    public function disconnect(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->connection->disconnect($this->actor($request))]);
    }

    private function actor(Request $request): User
    {
        $user = $request->user();
        assert($user instanceof User);

        return $user;
    }
}
