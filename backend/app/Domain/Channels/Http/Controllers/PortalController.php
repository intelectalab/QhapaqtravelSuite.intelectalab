<?php

declare(strict_types=1);

namespace App\Domain\Channels\Http\Controllers;

use App\Domain\Channels\Actions\AnswerPaxFeedback;
use App\Domain\Channels\Support\CustomerPortalPreview;
use App\Domain\Channels\Support\PassengerPortalDirectory;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class PortalController
{
    public function customer(Request $request, CustomerPortalPreview $preview): JsonResponse
    {
        return response()->json(['data' => $preview->show($this->user($request), $request->string('client')->toString() ?: null)]);
    }

    public function previewClients(Request $request, CustomerPortalPreview $preview): JsonResponse
    {
        return response()->json(['data' => $preview->show($this->user($request), null)['clients']]);
    }

    public function previewSection(Request $request, string $code, string $section, CustomerPortalPreview $preview): JsonResponse
    {
        $sections = ['home' => 'kpis', 'reservations' => 'reservations', 'quotes' => 'quotes', 'receivables' => 'payments', 'documents' => 'documents', 'wishlist' => 'wishlist'];

        if (! isset($sections[$section])) {
            throw ApiException::notFound('Esa sección del portal no existe.');
        }

        $data = $preview->show($this->user($request), $code);

        if (($data['client']['code'] ?? null) !== $code) {
            throw ApiException::forbidden('PCL-BR-10', 'Registro fuera de su cartera.');
        }

        $client = $data['client'];

        return response()->json(['data' => [
            'client' => ['code' => $client['code'], 'name' => $client['name'], 'email' => $client['email'], 'country' => $client['country'], 'advisor' => $client['advisor']],
            'section' => $section,
            'read_only' => true,
            'items' => $client[$sections[$section]],
        ]]);
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
        $request->validate(['status' => ['required', 'in:leido']], ['status.*' => 'Para derivarlo, crea la incidencia desde el comentario.']);
        $answer->markRead($code, $this->user($request));

        return response()->json(['data' => ['code' => $code]]);
    }

    private function user(Request $request): User
    {
        $user = $request->user();
        assert($user instanceof User);

        return $user;
    }
}
