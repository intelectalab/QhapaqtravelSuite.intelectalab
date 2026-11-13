<?php

declare(strict_types=1);

namespace App\Domain\Inbox\Support;

use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

final class InboundPayloads
{
    private const MEDIA = [
        'image' => 'Envió una imagen.',
        'video' => 'Envió un video.',
        'audio' => 'Envió un audio.',
        'voice' => 'Envió una nota de voz.',
        'document' => 'Envió un documento.',
        'sticker' => 'Envió un sticker.',
    ];

    public function whatsapp(array $payload): array
    {
        $groups = [];

        foreach ((array) $payload['entry'] as $entry) {
            foreach ((array) ($entry['changes'] ?? []) as $change) {
                $value = (array) ($change['value'] ?? []);
                $phoneNumberId = trim((string) ($value['metadata']['phone_number_id'] ?? ''));

                if ($phoneNumberId === '') {
                    continue;
                }

                $names = collect((array) ($value['contacts'] ?? []))->mapWithKeys(fn ($contact) => [(string) ($contact['wa_id'] ?? '') => (string) ($contact['profile']['name'] ?? '')]);
                $groups[$phoneNumberId] ??= [];

                foreach ((array) ($value['messages'] ?? []) as $message) {
                    if (! is_array($message) || blank($message['id'] ?? null) || blank($message['from'] ?? null)) {
                        continue;
                    }

                    $from = (string) $message['from'];
                    $groups[$phoneNumberId][] = [
                        'external_id' => (string) $message['id'],
                        'thread_id' => $from,
                        'contact_name' => $names->get($from) ?: null,
                        'contact_phone' => $from,
                        'body' => $this->whatsappBody($message),
                        'sent_at' => is_numeric($message['timestamp'] ?? null) ? Carbon::createFromTimestampUTC((int) $message['timestamp'])->toIso8601String() : null,
                    ];
                }
            }
        }

        return $groups;
    }

    public function email(array $payload): array
    {
        [$name, $email] = $this->address((string) $payload['from']);
        $own = $this->messageId((string) $payload['message_id']);
        $references = array_values(array_unique(array_filter([
            ...$this->ids($payload['references'] ?? null),
            ...$this->ids($payload['in_reply_to'] ?? null),
        ], fn (string $id): bool => $id !== $own)));
        $text = trim((string) ($payload['text'] ?? ''));

        if ($text === '' && filled($payload['html'] ?? null)) {
            $text = trim((string) preg_replace('/[ \t]+/', ' ', html_entity_decode(strip_tags((string) preg_replace('/<(br|\/p|\/div)[^>]*>/i', "\n", (string) $payload['html'])), ENT_QUOTES | ENT_HTML5)));
        }

        return [
            'external_id' => $own,
            'thread_id' => $references[0] ?? $own,
            'references' => $references,
            'contact_name' => $name,
            'contact_email' => $email,
            'subject' => Str::limit(trim((string) ($payload['subject'] ?? '')), 200, ''),
            'body' => $text === '' ? 'El correo llegó sin texto.' : Str::limit($text, 60000, ''),
            'sent_at' => filled($payload['date'] ?? null) ? Carbon::parse((string) $payload['date'])->toIso8601String() : null,
            'attachments' => array_values((array) ($payload['attachments'] ?? [])),
        ];
    }

    public function recipients(mixed $to): array
    {
        $list = is_array($to) ? $to : explode(',', (string) $to);

        return array_values(array_filter(array_map(fn ($item): ?string => $this->address((string) $item)[1], $list)));
    }

    private function whatsappBody(array $message): string
    {
        $type = (string) ($message['type'] ?? 'text');
        $media = (array) ($message[$type] ?? []);

        $body = match (true) {
            $type === 'text' => (string) ($message['text']['body'] ?? ''),
            $type === 'button' => (string) ($message['button']['text'] ?? ''),
            $type === 'interactive' => (string) ($message['interactive']['button_reply']['title'] ?? $message['interactive']['list_reply']['title'] ?? ''),
            $type === 'location' => trim('Compartió una ubicación: '.($message['location']['name'] ?? '').' ('.($message['location']['latitude'] ?? '?').', '.($message['location']['longitude'] ?? '?').')'),
            isset(self::MEDIA[$type]) => trim(self::MEDIA[$type].' '.($media['caption'] ?? $media['filename'] ?? '')),
            default => 'Envió un tipo de mensaje que la bandeja aún no muestra.',
        };

        return trim($body) === '' ? 'Mensaje sin texto.' : Str::limit(trim($body), 4096, '');
    }

    private function address(string $value): array
    {
        $value = trim($value);

        if (preg_match('/^(.*)<([^>]+)>\s*$/', $value, $match) === 1) {
            $name = trim($match[1], " \"'");
            $email = Str::lower(trim($match[2]));
        } else {
            $name = '';
            $email = Str::lower($value);
        }

        return [$name === '' ? null : $name, filter_var($email, FILTER_VALIDATE_EMAIL) ? $email : null];
    }

    private function ids(mixed $value): array
    {
        $items = is_array($value) ? $value : preg_split('/\s+/', trim((string) $value));

        return array_values(array_filter(array_map(fn ($id): string => $this->messageId((string) $id), (array) $items)));
    }

    private function messageId(string $id): string
    {
        return Str::limit(trim($id, " \t\n\r<>"), 190, '');
    }
}
