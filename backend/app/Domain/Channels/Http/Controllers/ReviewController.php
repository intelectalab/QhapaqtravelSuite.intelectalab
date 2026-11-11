<?php

declare(strict_types=1);

namespace App\Domain\Channels\Http\Controllers;

use App\Domain\Channels\Actions\ModerateOwnReview;
use App\Domain\Channels\Actions\OwnReviewInvitations;
use App\Domain\Channels\Actions\ReplyExternalReview;
use App\Domain\Channels\Support\ExternalReviewDirectory;
use App\Domain\Channels\Support\OwnReviewDirectory;
use App\Domain\Channels\Support\OwnReviewSettings;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class ReviewController
{
    public function own(Request $request, OwnReviewDirectory $directory): JsonResponse
    {
        return response()->json(['data' => $directory->overview($this->user($request))]);
    }

    public function stats(Request $request, OwnReviewDirectory $directory): JsonResponse
    {
        $overview = $directory->overview($this->user($request));

        return response()->json(['data' => ['kpis' => $overview['kpis'], 'distribution' => $overview['distribution'], 'by_product' => $overview['by_product'], 'subratings' => $overview['subratings']]]);
    }

    public function show(Request $request, string $code, OwnReviewDirectory $directory): JsonResponse
    {
        $review = collect($directory->overview($this->user($request))['items'])->firstWhere('code', $code) ?? throw ApiException::notFound('La reseña no existe o no es de tu cartera.');

        return response()->json(['data' => $review]);
    }

    public function requests(Request $request, OwnReviewDirectory $directory): JsonResponse
    {
        $status = $request->query('status');
        $rows = collect($directory->overview($this->user($request))['requests'])->when(is_string($status) && $status !== '', fn ($items) => $items->where('status', $status))->values();

        return response()->json(['data' => $rows]);
    }

    public function schedulePending(Request $request, OwnReviewInvitations $invitations): JsonResponse
    {
        return response()->json(['data' => $invitations->schedulePending($this->user($request))]);
    }

    public function exportFeed(Request $request, OwnReviewInvitations $invitations): JsonResponse
    {
        return response()->json(['data' => $invitations->exportFeed($this->user($request))]);
    }

    public function settings(OwnReviewSettings $settings): JsonResponse
    {
        return response()->json(['data' => $settings->detail()]);
    }

    public function updateSettings(Request $request, OwnReviewSettings $settings): JsonResponse
    {
        $version = $request->header('If-Match');

        return response()->json(['data' => $settings->update($request->only(['auto_publish', 'banned_words', 'personal_data', 'active_subratings', 'show_on_site', 'show_on_widget', 'invite']), $this->user($request), is_numeric($version) ? (int) $version : null)]);
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
