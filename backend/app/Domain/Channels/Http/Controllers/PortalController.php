<?php

declare(strict_types=1);

namespace App\Domain\Channels\Http\Controllers;

use App\Domain\Channels\Actions\AnswerPaxFeedback;
use App\Domain\Channels\Support\CustomerPortalPreview;
use App\Domain\Channels\Support\PassengerPortalDirectory;
use App\Domain\Iam\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class PortalController
{
    public function customer(Request $request, CustomerPortalPreview $preview): JsonResponse
    {
        return response()->json(['data' => $preview->show($this->user($request), $request->string('client')->toString() ?: null)]);
    }

    public function passenger(Request $request, PassengerPortalDirectory $directory): JsonResponse
    {
        return response()->json(['data' => $directory->overview($this->user($request))]);
    }

    public function reply(Request $request, string $code, AnswerPaxFeedback $answer): JsonResponse
    {
        $data = $request->validate(['text' => ['required', 'string', 'min:5', 'max:1000']], ['text.*' => 'Escribe una respuesta de 5 a 1000 caracteres.']);
        $answer->reply($code, $data['text'], $this->user($request));

        return response()->json(['data' => ['code' => $code]]);
    }

    public function mark(Request $request, string $code, AnswerPaxFeedback $answer): JsonResponse
    {
        $data = $request->validate(['status' => ['required', 'in:leido,derivado']], ['status.*' => 'Elige el nuevo estado.']);
        $answer->mark($code, $data['status'], $this->user($request));

        return response()->json(['data' => ['code' => $code]]);
    }

    private function user(Request $request): User
    {
        $user = $request->user();
        assert($user instanceof User);

        return $user;
    }
}
