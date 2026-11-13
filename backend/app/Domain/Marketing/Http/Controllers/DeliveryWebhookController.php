<?php

declare(strict_types=1);

namespace App\Domain\Marketing\Http\Controllers;

use App\Domain\Integrations\Support\ChannelWebhooks;
use App\Domain\Integrations\Support\ProviderSignature;
use App\Domain\Marketing\Support\DeliveryReceipts;
use App\Domain\Marketing\Support\TemplateReviews;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Tenancy\TenantDatabase;
use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

final class DeliveryWebhookController
{
    private const WHATSAPP_STATUSES = ['delivered' => 'delivered', 'read' => 'opened', 'failed' => 'failed'];

    public function __construct(private readonly TenantDatabase $database, private readonly DeliveryReceipts $receipts) {}

    public function email(Request $request, ProviderSignature $signature): JsonResponse
    {
        $raw = $request->getContent();
        $signature->verify('ses', $raw, (string) $request->header(ProviderSignature::HEADER, ''));
        $event = Validator::make((array) json_decode($raw, true), [
            'event_id' => ['required', 'string', 'max:120'],
            'type' => ['required', 'in:'.implode(',', DeliveryReceipts::CAMPAIGN_EVENTS)],
            'message_id' => ['required', 'string', 'max:120'],
            'occurred_at' => ['nullable', 'date'],
            'reply' => ['nullable', 'string', 'max:4000'],
            'reason' => ['nullable', 'string', 'max:500'],
        ], ['*' => 'El evento del correo no tiene el formato esperado.'])->validate();

        $tenant = DeliveryReceipts::tenantOf((string) $event['message_id'], ['mkt_campaign_recipients']);
        $base = ['event_id' => $event['event_id'], 'type' => $event['type'], 'message_id' => $event['message_id']];

        if ($tenant === null) {
            return response()->json(['data' => [...$base, 'result' => 'ignorado', 'message' => 'El correo no pertenece a ningún envío de campaña registrado.']], 201);
        }

        $result = $this->database->run($tenant, function () use ($event, $raw): array {
            if (! $this->receipts->claim('email', 'estado:'.$event['event_id'], (array) json_decode($raw, true))) {
                return ['result' => 'duplicado'];
            }

            $at = $this->moment($event['occurred_at'] ?? null);

            return ($event['type'] === 'replied'
                ? $this->receipts->reply('email', (string) $event['message_id'], null, $event['reply'] ?? null, $at)
                : $this->receipts->apply((string) $event['type'], (string) $event['message_id'], $at, $event['reason'] ?? null)) ?? ['result' => 'ignorado'];
        });

        return response()->json(['data' => [...$base, ...$result]], 201);
    }

    public function whatsappMessages(Request $request, ChannelWebhooks $channels): JsonResponse
    {
        [$raw, $account, $changes] = $this->whatsapp($request, $channels, 'messages');

        $summary = $this->database->run((string) $account->tenant_id, function () use ($channels, $account, $raw, $request, $changes): array {
            $channels->verify((string) $account->account_id, $raw, (string) $request->header(ChannelWebhooks::SIGNATURE_HEADER, ''));
            $summary = ['actualizados' => 0, 'duplicados' => 0, 'ignorados' => 0, 'bajas' => 0];

            foreach ($changes as $value) {
                foreach ((array) ($value['statuses'] ?? []) as $status) {
                    $summary = $this->tally($summary, $this->status((array) $status));
                }

                foreach ((array) ($value['messages'] ?? []) as $message) {
                    $summary = $this->tally($summary, $this->reply((array) $message));
                }
            }

            return $summary;
        });

        return response()->json(['data' => $summary]);
    }

    public function whatsappTemplates(Request $request, ChannelWebhooks $channels, TemplateReviews $reviews): JsonResponse
    {
        [$raw, $account, $changes] = $this->whatsapp($request, $channels, 'message_template_status_update');

        $templates = $this->database->run((string) $account->tenant_id, function () use ($channels, $account, $raw, $request, $changes, $reviews): array {
            $channels->verify((string) $account->account_id, $raw, (string) $request->header(ChannelWebhooks::SIGNATURE_HEADER, ''));

            return $changes->map(function (array $value) use ($account, $reviews): array {
                $key = implode(':', ['plantilla', $value['message_template_id'] ?? $value['message_template_name'] ?? '', $value['event'] ?? '', $value['time'] ?? '']);

                return $this->receipts->claim('whatsapp', $key, $value)
                    ? $reviews->apply((string) $account->account_id, $value)
                    : ['result' => 'duplicado', 'template' => $value['message_template_name'] ?? null, 'status' => null];
            })->values()->all();
        });

        return response()->json(['data' => ['templates' => $templates]]);
    }

    public function providers(Request $request, string $provider, ProviderSignature $signature, ChannelWebhooks $channels): JsonResponse
    {
        $raw = $request->getContent();

        if ($provider !== 'whatsapp') {
            $signature->verify($provider, $raw, (string) $request->header(ProviderSignature::HEADER, ''));
        }

        $event = Validator::make((array) json_decode($raw, true), [
            'provider_message_id' => ['required', 'string', 'max:120'],
            'status' => ['required', 'in:'.implode(',', array_keys(DeliveryReceipts::ACKS))],
            'occurred_at' => ['nullable', 'date'],
            'error' => ['nullable', 'string', 'max:500'],
            'phone_number_id' => [$provider === 'whatsapp' ? 'required' : 'nullable', 'string', 'max:60'],
        ], ['*' => 'El acuse del proveedor no tiene el formato esperado.'])->validate();

        $messageId = (string) $event['provider_message_id'];
        $account = $provider === 'whatsapp' ? $channels->account('whatsapp', (string) $event['phone_number_id'], null) : null;
        $tenant = $account !== null ? (string) $account->tenant_id : DeliveryReceipts::tenantOf($messageId);

        if ($tenant === null) {
            throw ApiException::notFound('No encontramos el mensaje de este acuse.');
        }

        $result = $this->database->run($tenant, function () use ($account, $channels, $raw, $request, $event, $messageId): array {
            if ($account !== null) {
                $channels->verify((string) $account->account_id, $raw, (string) $request->header(ChannelWebhooks::SIGNATURE_HEADER, ''));
            }

            return $this->receipts->apply(DeliveryReceipts::ACKS[$event['status']], $messageId, $this->moment($event['occurred_at'] ?? null), $event['error'] ?? null)
                ?? throw ApiException::notFound('No encontramos el mensaje de este acuse.');
        });

        return response()->json(['data' => ['provider' => $provider, 'provider_message_id' => $messageId, ...$result]]);
    }

    private function whatsapp(Request $request, ChannelWebhooks $channels, string $field): array
    {
        $raw = $request->getContent();
        $payload = Validator::make((array) json_decode($raw, true), [
            'entry' => ['required', 'array', 'min:1'],
            'entry.*.changes' => ['required', 'array'],
            'entry.*.changes.*.field' => ['required', 'string'],
            'entry.*.changes.*.value' => ['required', 'array'],
        ], ['*' => 'El evento de WhatsApp no tiene el formato esperado.'])->validate();

        $values = collect($payload['entry'])->flatMap(fn (array $entry): array => array_map(fn (array $change): array => [...$change, 'time' => $entry['time'] ?? null], $entry['changes']))
            ->filter(fn (array $change): bool => $change['field'] === $field)
            ->map(fn (array $change): array => [...$change['value'], 'time' => $change['time']]);
        $phone = (string) ($values->map(fn (array $value): ?string => $value['metadata']['phone_number_id'] ?? null)->filter()->first() ?? '');
        $account = $channels->account('whatsapp', $phone, null);

        return [$raw, $account, $values->filter(fn (array $value): bool => ($value['metadata']['phone_number_id'] ?? $phone) === $phone)->values()];
    }

    private function status(array $status): string
    {
        $event = self::WHATSAPP_STATUSES[$status['status'] ?? ''] ?? null;

        if ($event === null || blank($status['id'] ?? null)) {
            return 'ignorado';
        }

        if (! $this->receipts->claim('whatsapp', "estado:{$status['id']}:{$status['status']}", $status)) {
            return 'duplicado';
        }

        $error = $status['errors'][0]['title'] ?? $status['errors'][0]['message'] ?? null;

        return $this->receipts->apply($event, (string) $status['id'], $this->moment($status['timestamp'] ?? null), is_string($error) ? $error : null)['result'] ?? 'ignorado';
    }

    private function reply(array $message): string
    {
        if (blank($message['id'] ?? null) || ! $this->receipts->claim('whatsapp', "respuesta:{$message['id']}", $message)) {
            return blank($message['id'] ?? null) ? 'ignorado' : 'duplicado';
        }

        $text = $message['text']['body'] ?? $message['button']['text'] ?? $message['interactive']['button_reply']['title'] ?? null;

        return $this->receipts->reply('whatsapp', $message['context']['id'] ?? null, $message['from'] ?? null, is_string($text) ? $text : null, $this->moment($message['timestamp'] ?? null))['result'] ?? 'ignorado';
    }

    private function tally(array $summary, string $result): array
    {
        $key = match ($result) {
            'actualizado' => 'actualizados',
            'baja' => 'bajas',
            'duplicado' => 'duplicados',
            default => 'ignorados',
        };
        $summary[$key]++;

        return $summary;
    }

    private function moment(mixed $value): CarbonInterface
    {
        return match (true) {
            is_numeric($value) => CarbonImmutable::createFromTimestampUTC((int) $value),
            is_string($value) && $value !== '' => CarbonImmutable::parse($value)->utc(),
            default => CarbonImmutable::now('UTC'),
        };
    }
}
