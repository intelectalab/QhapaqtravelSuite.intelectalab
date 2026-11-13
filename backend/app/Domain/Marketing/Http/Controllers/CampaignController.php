<?php

declare(strict_types=1);

namespace App\Domain\Marketing\Http\Controllers;

use App\Domain\Iam\Models\User;
use App\Domain\Marketing\Actions\CampaignWorkflow;
use App\Domain\Marketing\Support\CampaignDirectory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class CampaignController
{
    public function index(Request $request, CampaignDirectory $directory): JsonResponse
    {
        return response()->json(['data' => $directory->overview($this->user($request))]);
    }

    public function store(Request $request, CampaignWorkflow $workflow): JsonResponse
    {
        return response()->json(['data' => ['code' => $workflow->create($this->validated($request), $this->user($request))]], 201);
    }

    public function update(Request $request, string $code, CampaignWorkflow $workflow): JsonResponse
    {
        $workflow->update($code, $this->validated($request), $this->user($request));

        return response()->json(['data' => ['code' => $code]]);
    }

    public function test(Request $request, string $code, CampaignWorkflow $workflow): JsonResponse
    {
        $data = $request->validate([
            'to_user_id' => ['nullable', 'uuid'],
            'sample' => ['nullable', 'string', 'max:40'],
        ], ['to_user_id.*' => 'Elige un destinatario interno de la lista.', 'sample.*' => 'Elige un cliente o lead de la lista.']);
        $sentTo = $workflow->test($code, $this->user($request), $data['to_user_id'] ?? null, $data['sample'] ?? null);

        return response()->json(['data' => ['code' => $code, 'sent_to' => $sentTo]], 201);
    }

    public function schedule(Request $request, string $code, CampaignWorkflow $workflow): JsonResponse
    {
        $data = $request->validate(['scheduled_at' => ['required', 'date']], ['scheduled_at.*' => 'Elige la fecha y hora de envío.']);
        $workflow->schedule($code, $data['scheduled_at'], $this->user($request));

        return response()->json(['data' => ['code' => $code]]);
    }

    public function unschedule(Request $request, string $code, CampaignWorkflow $workflow): JsonResponse
    {
        $workflow->unschedule($code, $this->user($request));

        return response()->json(['data' => ['code' => $code]]);
    }

    public function cancel(Request $request, string $code, CampaignWorkflow $workflow): JsonResponse
    {
        $data = $request->validate(['reason' => ['required', 'string', 'min:5', 'max:500']], ['reason.*' => 'Explica por qué se cancela.']);
        $workflow->cancel($code, $data['reason'], $this->user($request));

        return response()->json(['data' => ['code' => $code]]);
    }

    public function send(Request $request, string $code, CampaignWorkflow $workflow): JsonResponse
    {
        return response()->json(['data' => ['code' => $code, 'audience' => $workflow->send($code, $this->user($request))]], 202);
    }

    public function duplicate(Request $request, string $code, CampaignWorkflow $workflow): JsonResponse
    {
        return response()->json(['data' => ['code' => $workflow->duplicate($code, $this->user($request))]], 201);
    }

    private function validated(Request $request): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'min:4', 'max:160'],
            'channel' => ['required', 'in:email,whatsapp'],
            'segment' => ['required', 'string', 'max:20'],
            'template' => ['required', 'string', 'max:20'],
            'subject' => ['nullable', 'required_if:channel,email', 'string', 'max:200'],
            'body' => ['nullable', 'string', 'max:5000'],
            'promo_code' => ['nullable', 'regex:/^[A-Za-z0-9]{4,20}$/'],
        ], [
            'name.*' => 'Escribe el nombre de la campaña.',
            'channel.*' => 'Elige el canal.',
            'segment.*' => 'Elige un segmento.',
            'template.*' => 'Elige una plantilla.',
            'subject.*' => 'El correo necesita un asunto.',
            'promo_code.*' => 'El código va de 4 a 20 letras o números (MKT-BR-09).',
        ]);
    }

    private function user(Request $request): User
    {
        $user = $request->user();
        assert($user instanceof User);

        return $user;
    }
}
