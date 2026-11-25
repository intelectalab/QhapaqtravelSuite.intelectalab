<?php

declare(strict_types=1);

namespace App\Domain\Landing\Http\Controllers;

use App\Domain\Landing\Actions\LandingNewsletter;
use App\Domain\Landing\Actions\ManageLandingPosts;
use App\Domain\Landing\Actions\ModerateBlogComments;
use App\Domain\Landing\Support\LandingBlog;
use App\Domain\Landing\Support\LandingPopups;
use App\Domain\Showcase\Http\Controllers\PlatformShowcaseController;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

final class PlatformLandingController
{
    public function comments(Request $request, ModerateBlogComments $moderation): JsonResponse
    {
        $data = $request->validate(['status' => ['nullable', Rule::in(array_keys(ModerateBlogComments::STATUSES))], 'q' => ['nullable', 'string', 'max:80']]);

        return response()->json(['data' => $moderation->list($data['status'] ?? null, $data['q'] ?? null)]);
    }

    public function moderate(Request $request, string $id, ModerateBlogComments $moderation): JsonResponse
    {
        $data = $request->validate(['status' => ['required', Rule::in(array_keys(ModerateBlogComments::STATUSES))]], ['status.*' => 'Elige el nuevo estado del comentario.']);

        return response()->json(['data' => $moderation->moderate($id, $data['status'], PlatformShowcaseController::user($request))]);
    }

    public function reply(Request $request, string $id, ModerateBlogComments $moderation): JsonResponse
    {
        $data = $request->validate(['body' => ['required', 'string', 'min:10', 'max:1500']], ['body.min' => 'La respuesta necesita al menos 10 caracteres.', 'body.max' => 'La respuesta admite hasta 1500 caracteres.', 'body.required' => 'Escribe la respuesta.']);

        return response()->json(['data' => $moderation->reply($id, $data['body'], PlatformShowcaseController::user($request))], 201);
    }

    public function destroyComment(Request $request, string $id, ModerateBlogComments $moderation): JsonResponse
    {
        $moderation->delete($id, PlatformShowcaseController::user($request));

        return response()->json(['data' => ['deleted' => true]]);
    }

    public function popups(LandingPopups $popups): JsonResponse
    {
        return response()->json(['data' => $popups->list()]);
    }

    public function storePopup(Request $request, LandingPopups $popups): JsonResponse
    {
        return response()->json(['data' => $popups->create($this->popup($request, true), PlatformShowcaseController::user($request))], 201);
    }

    public function updatePopup(Request $request, string $code, LandingPopups $popups): JsonResponse
    {
        return response()->json(['data' => $popups->update($code, $this->popup($request, false), PlatformShowcaseController::user($request))]);
    }

    public function popupStatus(Request $request, string $code, LandingPopups $popups): JsonResponse
    {
        $data = $request->validate(['status' => ['required', Rule::in(['activo', 'pausado'])]], ['status.*' => 'Elige activar o pausar.']);

        return response()->json(['data' => $popups->transition($code, $data['status'], PlatformShowcaseController::user($request))]);
    }

    public function destroyPopup(Request $request, string $code, LandingPopups $popups): JsonResponse
    {
        $popups->delete($code, PlatformShowcaseController::user($request));

        return response()->json(['data' => ['deleted' => true]]);
    }

    public function subscribers(Request $request, LandingNewsletter $newsletter): JsonResponse
    {
        $data = $request->validate(['status' => ['nullable', Rule::in(array_keys(LandingNewsletter::STATUSES))]]);

        return response()->json(['data' => $newsletter->list($data['status'] ?? null)]);
    }

    public function posts(ManageLandingPosts $posts): JsonResponse
    {
        return response()->json(['data' => $posts->list()]);
    }

    public function storePost(Request $request, ManageLandingPosts $posts): JsonResponse
    {
        return response()->json(['data' => $posts->create($this->post($request, true), PlatformShowcaseController::user($request))], 201);
    }

    public function updatePost(Request $request, string $id, ManageLandingPosts $posts): JsonResponse
    {
        return response()->json(['data' => $posts->update($id, $this->post($request, false), PlatformShowcaseController::user($request))]);
    }

    public function postStatus(Request $request, string $id, ManageLandingPosts $posts): JsonResponse
    {
        $data = $request->validate(['status' => ['required', Rule::in(array_keys(ManageLandingPosts::STATUSES))]], ['status.*' => 'Elige el nuevo estado del artículo.']);

        return response()->json(['data' => $posts->transition($id, $data['status'], PlatformShowcaseController::user($request))]);
    }

    public function destroyPost(Request $request, string $id, ManageLandingPosts $posts): JsonResponse
    {
        $posts->delete($id, PlatformShowcaseController::user($request));

        return response()->json(['data' => ['deleted' => true]]);
    }

    private function popup(Request $request, bool $creating): array
    {
        $required = $creating ? 'required' : 'sometimes';

        return $request->validate([
            'name' => [$required, 'string', 'min:3', 'max:80'],
            'trigger' => [$required, Rule::in(array_keys(LandingPopups::TRIGGERS))],
            'kind' => [$required, Rule::in(array_keys(LandingPopups::KINDS))],
            'pages' => [$required, 'array', 'min:1'],
            'pages.*' => [Rule::in(array_keys(LandingPopups::PAGES))],
            'freq_days' => [$required, 'integer', 'between:1,90'],
            'eyebrow' => ['nullable', 'string', 'max:40'],
            'title' => [$required, 'string', 'min:5', 'max:90'],
            'body' => [$required, 'string', 'min:10', 'max:280'],
            'cta_label' => [$required, 'string', 'min:2', 'max:40'],
            'cta_href' => ['nullable', 'string', 'max:200'],
        ], [
            'name.*' => 'Escribe un nombre de 3 a 80 caracteres.',
            'trigger.*' => 'Elige cuándo aparece.',
            'kind.*' => 'Elige qué ofrece el popup.',
            'pages.*' => 'Elige al menos una página.',
            'freq_days.*' => 'La frecuencia va de 1 a 90 días.',
            'title.*' => 'El título va de 5 a 90 caracteres.',
            'body.*' => 'El texto va de 10 a 280 caracteres.',
            'cta_label.*' => 'El botón va de 2 a 40 caracteres.',
            'eyebrow.max' => 'La etiqueta admite hasta 40 caracteres.',
            'cta_href.max' => 'La ruta admite hasta 200 caracteres.',
        ]);
    }

    private function post(Request $request, bool $creating): array
    {
        $required = $creating ? 'required' : 'sometimes';

        return $request->validate([
            'title' => [$required, 'string', 'min:10', 'max:200'],
            'title_accent' => ['nullable', 'string', 'max:120'],
            'slug' => ['nullable', 'string', 'max:150'],
            'excerpt' => [$required, 'string', 'min:30', 'max:320'],
            'body' => ['nullable', 'string', 'max:60000'],
            'category' => ['nullable', Rule::in(array_keys(LandingBlog::CATEGORIES[LandingBlog::SITE]))],
            'focus_keyword' => [$required, 'string', 'min:3', 'max:120'],
            'author_name' => ['nullable', 'string', 'max:80'],
            'author_role' => ['nullable', 'string', 'max:120'],
            'featured' => ['sometimes', 'boolean'],
            'allow_comments' => ['sometimes', 'boolean'],
            'faq' => ['sometimes', 'array', 'max:10'],
            'faq.*.q' => ['required_with:faq', 'string', 'max:200'],
            'faq.*.a' => ['required_with:faq', 'string', 'max:800'],
        ], [
            'title.*' => 'El título va de 10 a 200 caracteres.',
            'excerpt.*' => 'El resumen va de 30 a 320 caracteres.',
            'focus_keyword.*' => 'Escribe la palabra clave del artículo.',
            'category.*' => 'Elige una categoría del blog.',
            'faq.max' => 'Hasta 10 preguntas frecuentes por artículo.',
            'faq.*.q.*' => 'Cada pregunta necesita su texto.',
            'faq.*.a.*' => 'Cada pregunta necesita su respuesta.',
        ]);
    }
}
