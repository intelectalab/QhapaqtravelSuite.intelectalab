<?php

declare(strict_types=1);

namespace App\Domain\Landing\Http\Controllers;

use App\Domain\Landing\Actions\LandingEngagement;
use App\Domain\Landing\Actions\LandingNewsletter;
use App\Domain\Landing\Actions\SubmitBlogComment;
use App\Domain\Landing\Support\LandingBlog;
use App\Domain\Landing\Support\LandingPopups;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

final class PublicLandingContentController
{
    public function posts(Request $request, LandingBlog $blog): JsonResponse
    {
        $filters = $request->validate([
            'site' => ['nullable', 'string', 'max:20'],
            'category' => ['nullable', 'string', 'max:40'],
            'q' => ['nullable', 'string', 'max:80'],
            'order' => ['nullable', 'string', 'max:20'],
        ]);

        return response()->json(['data' => $blog->list($filters)]);
    }

    public function post(string $slug, LandingBlog $blog): JsonResponse
    {
        return response()->json(['data' => $blog->show($slug)]);
    }

    public function read(Request $request, string $slug, LandingEngagement $engagement): JsonResponse
    {
        return response()->json(['data' => $engagement->read($slug, $request)]);
    }

    public function rate(Request $request, string $slug, LandingEngagement $engagement): JsonResponse
    {
        $data = $request->validate(['useful' => ['required', 'boolean']], ['useful.*' => 'Indica si el artículo te sirvió.']);

        return response()->json(['data' => $engagement->ratePost($slug, (bool) $data['useful'], $request)]);
    }

    public function comment(Request $request, string $slug, SubmitBlogComment $submit): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'min:2', 'max:80'],
            'email' => ['required', 'email:rfc', 'max:160'],
            'body' => ['required', 'string', 'min:10', 'max:1500'],
            'parent_id' => ['nullable', 'string', 'max:40'],
            'consent' => ['accepted'],
            'website' => ['nullable', 'string', 'max:200'],
        ], [
            'name.*' => 'Escribe tu nombre.',
            'email.*' => 'Escribe un correo válido.',
            'body.min' => 'El comentario necesita al menos 10 caracteres.',
            'body.max' => 'El comentario admite hasta 1500 caracteres.',
            'body.required' => 'Escribe tu comentario.',
            'consent.accepted' => 'Acepta la publicación de tu nombre y el tratamiento de tus datos para continuar.',
        ]);

        return response()->json(['data' => $submit($slug, $data, $request)], 202);
    }

    public function useful(Request $request, string $id, LandingEngagement $engagement): JsonResponse
    {
        return response()->json(['data' => $engagement->markUseful($id, $request)]);
    }

    public function subscribe(Request $request, LandingNewsletter $newsletter): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'email:rfc', 'max:160'],
            'source' => ['required', Rule::in(array_keys(LandingNewsletter::SOURCES))],
            'website' => ['nullable', 'string', 'max:200'],
        ], ['email.*' => 'Escribe un correo válido.', 'source.*' => 'Origen de la suscripción no válido.']);

        if (trim((string) ($data['website'] ?? '')) !== '') {
            return response()->json(['data' => ['status' => 'pendiente', 'message' => 'Listo, revisa tu correo para confirmar la suscripción.']], 202);
        }

        return response()->json(['data' => $newsletter->subscribe($data['email'], $data['source'], $request)], 202);
    }

    public function confirm(string $token, LandingNewsletter $newsletter): JsonResponse
    {
        return response()->json(['data' => $newsletter->confirm($token)]);
    }

    public function unsubscribe(Request $request, LandingNewsletter $newsletter): JsonResponse
    {
        $data = $request->validate(['token' => ['required', 'string', 'min:32', 'max:64']], ['token.*' => 'El enlace de baja no es válido.']);

        return response()->json(['data' => $newsletter->unsubscribe($data['token'])]);
    }

    public function popups(Request $request, LandingPopups $popups): JsonResponse
    {
        $data = $request->validate(['page' => ['required', Rule::in(array_keys(LandingPopups::PAGES))]], ['page.*' => 'Página no válida.']);

        return response()->json(['data' => $popups->active($data['page'])]);
    }

    public function popupEvent(Request $request, string $code, LandingPopups $popups): JsonResponse
    {
        $data = $request->validate(['event' => ['required', Rule::in(['view', 'conversion'])]], ['event.*' => 'Evento no válido.']);

        return response()->json(['data' => $popups->record($code, $data['event'])]);
    }
}
