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

    public function publish(Request $request, string $code, ModerateOwnReview $moderate): JsonResponse
    {
        $moderate->moderate($code, 'publicar', null, $this->user($request));

        return response()->json(['data' => ['code' => $code]]);
    }

    public function reject(Request $request, string $code, ModerateOwnReview $moderate): JsonResponse
    {
        return $this->withReason($request, $code, 'rechazar', $moderate);
    }

    public function hide(Request $request, string $code, ModerateOwnReview $moderate): JsonResponse
    {
        return $this->withReason($request, $code, 'ocultar', $moderate);
    }

    public function reply(Request $request, string $code, ModerateOwnReview $moderate): JsonResponse
    {
        $data = $request->validate(['text' => ['required', 'string', 'min:5', 'max:1000']], ['text.*' => 'Escribe una respuesta de 5 a 1000 caracteres.']);
        $moderate->reply($code, $data['text'], $this->user($request));

        return response()->json(['data' => ['code' => $code]]);
    }

    public function sendRequest(Request $request, string $code, ModerateOwnReview $moderate): JsonResponse
    {
        $moderate->sendRequest($code, $this->user($request));

        return response()->json(['data' => ['code' => $code]]);
    }

    public function cancelRequest(Request $request, string $code, ModerateOwnReview $moderate): JsonResponse
    {
        $moderate->cancelRequest($code, $this->user($request));

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

    private function withReason(Request $request, string $code, string $action, ModerateOwnReview $moderate): JsonResponse
    {
        $data = $request->validate(['reason' => ['required', 'string', 'max:300']], ['reason.required' => 'Indica el motivo.', 'reason.*' => 'El motivo admite hasta 300 caracteres.']);
        $moderate->moderate($code, $action, $data['reason'], $this->user($request));

        return response()->json(['data' => ['code' => $code]]);
    }

    private function user(Request $request): User
    {
        $user = $request->user();
        assert($user instanceof User);

        return $user;
    }
}
