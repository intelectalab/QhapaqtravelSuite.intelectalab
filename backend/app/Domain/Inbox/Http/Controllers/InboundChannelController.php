<?php

declare(strict_types=1);

namespace App\Domain\Inbox\Http\Controllers;

use App\Domain\Inbox\Actions\InboundEvents;
use App\Domain\Inbox\Support\InboundPayloads;
use App\Domain\Integrations\Support\ChannelWebhooks;
use App\Domain\Platform\Support\WhatsappWebhook;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Validator;

final class InboundChannelController
{
    public function __construct(private readonly ChannelWebhooks $webhooks, private readonly InboundEvents $events, private readonly InboundPayloads $payloads) {}

    public function verifyWhatsapp(Request $request, WhatsappWebhook $settings): Response
    {
        $mode = (string) ($request->query('hub_mode') ?? $request->query('hub.mode', ''));
        $token = (string) ($request->query('hub_verify_token') ?? $request->query('hub.verify_token', ''));
        $challenge = (string) ($request->query('hub_challenge') ?? $request->query('hub.challenge', ''));

        if ($mode !== 'subscribe' || ! preg_match('/^[A-Za-z0-9_-]{1,200}$/', $challenge) || ! $settings->matches($token)) {
            throw ApiException::forbidden('WEBHOOK_VERIFY_TOKEN_INVALID', 'El token de verificación no coincide con el configurado en la consola.', ['verify_token']);
        }

        return response($challenge, 200, ['Content-Type' => 'text/plain; charset=UTF-8']);
    }

    public function whatsapp(Request $request): JsonResponse
    {
        $raw = $request->getContent();
        $payload = Validator::make((array) json_decode($raw, true), [
            'object' => ['required', 'in:whatsapp_business_account'],
            'entry' => ['required', 'array', 'min:1'],
            'entry.*.changes' => ['required', 'array'],
        ], ['*' => 'El evento de WhatsApp no tiene el formato de Meta Cloud API.'])->validate();

        $groups = $this->payloads->whatsapp($payload);
        $results = [];

        foreach ($groups as $phoneNumberId => $messages) {
            $account = $this->webhooks->account('whatsapp', (string) $phoneNumberId, null);
            $results = [...$results, ...$this->events->accept('whatsapp', $account, $raw, $this->signature($request), $messages)];
        }

        return $this->accepted($results);
    }

    public function email(Request $request): JsonResponse
    {
        $raw = $request->getContent();
        $payload = Validator::make((array) json_decode($raw, true), [
            'message_id' => ['required', 'string', 'max:190'],
            'from' => ['required', 'string', 'max:320'],
            'to' => ['required'],
            'to.*' => ['string', 'max:320'],
            'subject' => ['nullable', 'string', 'max:500'],
            'text' => ['nullable', 'string', 'max:200000'],
            'html' => ['nullable', 'string', 'max:500000'],
            'in_reply_to' => ['nullable', 'string', 'max:190'],
            'references' => ['nullable'],
            'date' => ['nullable', 'date'],
            'attachments' => ['nullable', 'array', 'max:5'],
            'attachments.*.file_name' => ['required', 'string', 'max:200'],
            'attachments.*.mime' => ['required', 'string', 'max:100'],
            'attachments.*.content' => ['required', 'string'],
        ], [
            'message_id.*' => 'Falta el identificador del correo (message_id).',
            'from.*' => 'Falta el remitente del correo.',
            'to.*' => 'Falta el buzón que recibió el correo.',
            'attachments.*' => 'Cada adjunto lleva nombre, tipo y contenido en base64 (hasta 5).',
            '*' => 'El correo entrante no tiene el formato esperado.',
        ])->validate();

        $message = $this->payloads->email($payload);
        $account = null;

        foreach ($this->payloads->recipients($payload['to']) as $mailbox) {
            try {
                $account = $this->webhooks->account('email', null, $mailbox);
                break;
            } catch (ApiException) {
                continue;
            }
        }

        if ($account === null) {
            throw ApiException::notFound('Ningún buzón de destino está conectado a una agencia.');
        }

        return $this->accepted($this->events->accept('email', $account, $raw, $this->signature($request), [$message]));
    }

    private function signature(Request $request): string
    {
        return (string) $request->header(ChannelWebhooks::SIGNATURE_HEADER, '');
    }

    private function accepted(array $results): JsonResponse
    {
        $statuses = array_count_values(array_column($results, 'status'));

        return response()->json(['data' => [
            'received' => $statuses['recibido'] ?? 0,
            'duplicates' => $statuses['duplicado'] ?? 0,
            'events' => $results,
        ]], 202);
    }
}
