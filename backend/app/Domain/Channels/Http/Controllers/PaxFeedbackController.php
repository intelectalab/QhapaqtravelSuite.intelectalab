<?php

declare(strict_types=1);

namespace App\Domain\Channels\Http\Controllers;

use App\Domain\Channels\Actions\AnswerPaxFeedback;
use App\Domain\Iam\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class PaxFeedbackController
{
    public function read(Request $request, string $code, AnswerPaxFeedback $answer): JsonResponse
    {
        $answer->markRead($code, $this->user($request));

        return response()->json(['data' => ['code' => $code, 'status' => 'leido']]);
    }

    public function reply(Request $request, string $code, AnswerPaxFeedback $answer): JsonResponse
    {
        $data = $request->validate([
            'channel' => ['required', 'in:portal,email,whatsapp'],
            'text' => ['required', 'string', 'min:5', 'max:1000'],
            'status' => ['nullable', 'in:respondido,leido'],
        ], [
            'channel.*' => 'Elige el canal de la respuesta: portal, correo o WhatsApp.',
            'text.*' => 'Escribe una respuesta de 5 a 1000 caracteres.',
            'status.*' => 'El estado queda como respondido o en seguimiento.',
        ]);

        return response()->json(['data' => $answer->respond($code, $data['channel'], trim($data['text']), $data['status'] ?? 'respondido', $this->user($request))]);
    }

    private function user(Request $request): User
    {
        $user = $request->user();
        assert($user instanceof User);

        return $user;
    }
}
