<?php

declare(strict_types=1);

namespace App\Domain\Channels\Http\Controllers;

use App\Domain\Channels\Actions\ModerateOwnReview;
use App\Domain\Channels\Actions\ReplyExternalReview;
use App\Domain\Channels\Support\ExternalReviewDirectory;
use App\Domain\Channels\Support\OwnReviewDirectory;
use App\Domain\Iam\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class ReviewController
{
    public function own(Request $request, OwnReviewDirectory $directory): JsonResponse
    {
        return response()->json(['data' => $directory->overview($this->user($request))]);
    }

    public function moderate(Request $request, string $code, ModerateOwnReview $moderate): JsonResponse
    {
        $data = $request->validate([
            'action' => ['required', 'in:publicar,ocultar,rechazar'],
            'reason' => ['nullable', 'required_unless:action,publicar', 'string', 'max:300'],
        ], ['action.*' => 'Elige qué hacer con la reseña.', 'reason.required_unless' => 'Indica el motivo.', 'reason.*' => 'El motivo admite hasta 300 caracteres.']);
        $moderate->moderate($code, $data['action'], $data['reason'] ?? null, $this->user($request));

        return response()->json(['data' => ['code' => $code]]);
    }

    public function reply(Request $request, string $code, ModerateOwnReview $moderate): JsonResponse
    {
        $data = $request->validate(['text' => ['required', 'string', 'min:5', 'max:1000']], ['text.*' => 'Escribe una respuesta de 5 a 1000 caracteres.']);
        $moderate->reply($code, $data['text'], $this->user($request));

        return response()->json(['data' => ['code' => $code]]);
    }

    public function requestAction(Request $request, string $code, ModerateOwnReview $moderate): JsonResponse
    {
        $data = $request->validate(['action' => ['required', 'in:enviar,cancelar']], ['action.*' => 'Elige qué hacer con la solicitud.']);
        if ($data['action'] === 'cancelar') {
            $moderate->cancelRequest($code, $this->user($request));
        } else {
            $moderate->sendRequest($code, $this->user($request));
        }

        return response()->json(['data' => ['code' => $code]]);
    }

    public function external(Request $request, ExternalReviewDirectory $directory): JsonResponse
    {
        return response()->json(['data' => $directory->overview($this->user($request))]);
    }

    public function replyExternal(Request $request, string $id, ReplyExternalReview $reply): JsonResponse
    {
        $data = $request->validate(['text' => ['required', 'string', 'min:5', 'max:1500']], ['text.*' => 'Escribe una respuesta de 5 a 1500 caracteres.']);
        $reply->reply($id, $data['text'], $this->user($request));

        return response()->json(['data' => ['id' => $id]]);
    }

    public function publishExternal(Request $request, string $id, ReplyExternalReview $reply): JsonResponse
    {
        $reply->markPublished($id, $this->user($request));

        return response()->json(['data' => ['id' => $id]]);
    }

    private function user(Request $request): User
    {
        $user = $request->user();
        assert($user instanceof User);

        return $user;
    }
}
