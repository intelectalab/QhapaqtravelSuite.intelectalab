<?php

declare(strict_types=1);

namespace App\Domain\Site\Http\Controllers;

use App\Domain\Site\Actions\NewsletterLifecycle;
use App\Domain\Site\Actions\RecordWebEvents;
use App\Domain\Site\Actions\WebChat;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class SiteEngagementController
{
    public function openChat(Request $request, WebChat $chat): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'min:2', 'max:150'],
            'email' => ['required_without:whatsapp', 'nullable', 'email:rfc', 'max:190'],
            'whatsapp' => ['required_without:email', 'nullable', 'string', 'max:30', 'regex:/^[0-9+()\s-]{6,30}$/'],
            'message' => ['required', 'string', 'min:2', 'max:1000'],
            'consent' => ['accepted'],
        ], [
            'name.*' => 'Escribe tu nombre.',
            'email.*' => 'Escribe tu correo o tu WhatsApp.',
            'whatsapp.*' => 'Escribe tu correo o tu WhatsApp.',
            'message.*' => 'Escribe tu consulta.',
            'consent.accepted' => 'Acepta el tratamiento de tus datos para chatear con nosotros.',
        ]);

        return response()->json(['data' => $chat->open($data)], 201);
    }

    public function chatMessage(Request $request, string $session, WebChat $chat): JsonResponse
    {
        $data = $request->validate(['body' => ['required', 'string', 'min:1', 'max:1000']], ['body.*' => 'Escribe tu mensaje.']);

        return response()->json(['data' => $chat->send($session, $request->header('X-Chat-Token'), $data['body'])]);
    }

    public function chatSession(Request $request, string $session, WebChat $chat): JsonResponse
    {
        return response()->json(['data' => $chat->show($session, $request->header('X-Chat-Token'))]);
    }

    public function events(Request $request, RecordWebEvents $events): JsonResponse
    {
        return response()->json(['data' => $events->record($request->all(), (string) $request->header('X-Site-Locale', 'es'))], 202);
    }

    public function confirmNewsletter(string $token, NewsletterLifecycle $newsletter): JsonResponse
    {
        return response()->json(['data' => $newsletter->confirm($token)]);
    }

    public function unsubscribeNewsletter(Request $request, NewsletterLifecycle $newsletter): JsonResponse
    {
        $data = $request->validate(['token' => ['required', 'string', 'max:120']], ['token.*' => 'El enlace no es válido.']);

        return response()->json(['data' => $newsletter->unsubscribe($data['token'])]);
    }
}
