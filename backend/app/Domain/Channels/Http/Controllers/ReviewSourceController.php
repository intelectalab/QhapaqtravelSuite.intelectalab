<?php

declare(strict_types=1);

namespace App\Domain\Channels\Http\Controllers;

use App\Domain\Channels\Actions\ExternalReviewDesk;
use App\Domain\Channels\Actions\ManageReviewSources;
use App\Domain\Channels\Actions\ReservationReviewInvitation;
use App\Domain\Channels\Support\ExternalReviewDirectory;
use App\Domain\Iam\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Validation\Rule;

final class ReviewSourceController
{
    public function index(ManageReviewSources $sources): JsonResponse
    {
        return response()->json(['data' => $sources->list()]);
    }

    public function store(Request $request, ManageReviewSources $sources): JsonResponse
    {
        $data = $request->validate([
            'provider' => ['required', Rule::in(array_keys(ExternalReviewDirectory::PROVIDERS))],
            'account' => ['required', 'string', 'min:3', 'max:120'],
            'credential' => ['required', 'string', 'min:8', 'max:500'],
            'scopes' => ['nullable', 'array'],
            'scopes.*' => ['string', 'max:60'],
            'contract_ack' => ['accepted'],
        ], [
            'provider.*' => 'Elige una plataforma de la lista.',
            'account.*' => 'Escribe la cuenta o el identificador del negocio en la plataforma.',
            'credential.*' => 'Pega la clave o el token que entregó la plataforma (mínimo 8 caracteres).',
            'contract_ack.*' => 'Confirma que la agencia tiene contrato o aprobación de la plataforma para usar su API (RV-01).',
        ]);

        return response()->json(['data' => $sources->connect($data, $this->user($request))], 201);
    }

    public function destroy(Request $request, string $provider, ManageReviewSources $sources): Response
    {
        $sources->disconnect($provider, $this->user($request));

        return response()->noContent();
    }

    public function sync(Request $request, string $provider, ManageReviewSources $sources): JsonResponse
    {
        return response()->json(['data' => $sources->sync($provider, $this->user($request))]);
    }

    public function reply(Request $request, string $id, ExternalReviewDesk $desk): JsonResponse
    {
        $data = $request->validate(['text' => ['required', 'string', 'min:20', 'max:1500']], ['text.*' => 'Escribe una respuesta de 20 a 1500 caracteres.']);

        return response()->json(['data' => $desk->reply($id, $data['text'], $this->user($request))]);
    }

    public function escalate(Request $request, string $id, ExternalReviewDesk $desk): JsonResponse
    {
        $data = $request->validate(['note' => ['nullable', 'string', 'max:1000']], ['note.*' => 'La nota interna admite hasta 1000 caracteres.']);

        return response()->json(['data' => $desk->escalate($id, $data['note'] ?? null, $this->user($request))], 201);
    }

    public function invite(Request $request, string $id, ReservationReviewInvitation $invitations): JsonResponse
    {
        $data = $request->validate(['channel' => ['nullable', Rule::in(['email', 'whatsapp'])]], ['channel.*' => 'El canal es correo o WhatsApp.']);

        return response()->json(['data' => $invitations->invite($id, $data['channel'] ?? null, $this->user($request))], 201);
    }

    private function user(Request $request): User
    {
        $user = $request->user();
        assert($user instanceof User);

        return $user;
    }
}
