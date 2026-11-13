<?php

declare(strict_types=1);

namespace App\Domain\Inbox\Http\Controllers;

use App\Domain\Iam\Models\User;
use App\Domain\Inbox\Actions\ChannelAccounts;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

final class ChannelAccountController
{
    public function __construct(private readonly ChannelAccounts $accounts) {}

    public function index(): JsonResponse
    {
        return response()->json(['data' => $this->accounts->overview()]);
    }

    public function update(Request $request, string $channel): JsonResponse
    {
        $data = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'min:2', 'max:120'],
            'phone_number_id' => $channel === 'whatsapp' ? ['sometimes', 'required', 'string', 'max:60', 'regex:/^[0-9]{5,30}$/'] : ['prohibited'],
            'mailbox' => $channel === 'email' ? ['sometimes', 'required', 'email', 'max:190'] : ['prohibited'],
            'webhook_secret' => ['nullable', 'string', 'min:16', 'max:255'],
            'first_response_sla_minutes' => ['sometimes', 'required', 'integer', 'min:5', 'max:2880'],
            'status' => ['sometimes', 'required', Rule::in(array_keys(ChannelAccounts::STATUSES))],
        ], [
            'name.*' => 'El nombre lleva de 2 a 120 caracteres.',
            'phone_number_id.prohibited' => 'El ID del número solo aplica a WhatsApp.',
            'phone_number_id.*' => 'Pega el ID del número tal como aparece en Meta: solo dígitos.',
            'mailbox.prohibited' => 'El buzón solo aplica al correo.',
            'mailbox.*' => 'Escribe el buzón como una dirección de correo válida.',
            'webhook_secret.*' => 'El secreto lleva de 16 a 255 caracteres.',
            'first_response_sla_minutes.*' => 'El plazo de primera respuesta va de 5 minutos a 48 horas.',
            'status.*' => 'Elige un estado válido.',
        ]);
        $user = $request->user();
        assert($user instanceof User);

        return response()->json(['data' => $this->accounts->save($channel, $data, $user)]);
    }
}
