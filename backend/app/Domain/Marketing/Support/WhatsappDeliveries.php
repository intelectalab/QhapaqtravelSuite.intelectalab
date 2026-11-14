<?php

declare(strict_types=1);

namespace App\Domain\Marketing\Support;

use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;

final class WhatsappDeliveries
{
    public const STATUSES = ['delivered' => 'delivered', 'read' => 'opened', 'failed' => 'failed'];

    public const EMPTY = ['actualizados' => 0, 'duplicados' => 0, 'ignorados' => 0, 'bajas' => 0];

    public function __construct(private readonly DeliveryReceipts $receipts, private readonly TemplateReviews $reviews) {}

    public function changes(iterable $values, bool $replies = true): array
    {
        $summary = self::EMPTY;

        foreach ($values as $value) {
            foreach ((array) ($value['statuses'] ?? []) as $status) {
                $summary = self::tally($summary, $this->status((array) $status));
            }

            if ($replies) {
                foreach ((array) ($value['messages'] ?? []) as $message) {
                    $summary = self::tally($summary, $this->reply((array) $message));
                }
            }
        }

        return $summary;
    }

    public function status(array $status): string
    {
        $event = self::STATUSES[$status['status'] ?? ''] ?? null;

        if ($event === null || blank($status['id'] ?? null)) {
            return 'ignorado';
        }

        if (! $this->receipts->claim('whatsapp', "estado:{$status['id']}:{$status['status']}", $status)) {
            return 'duplicado';
        }

        $error = $status['errors'][0]['title'] ?? $status['errors'][0]['message'] ?? null;

        return $this->receipts->apply($event, (string) $status['id'], self::moment($status['timestamp'] ?? null), is_string($error) ? $error : null)['result'] ?? 'ignorado';
    }

    public function reply(array $message): string
    {
        if (blank($message['id'] ?? null)) {
            return 'ignorado';
        }

        $text = $message['text']['body'] ?? $message['button']['text'] ?? $message['interactive']['button_reply']['title'] ?? null;

        if (! $this->receipts->claim('whatsapp', "respuesta:{$message['id']}", ['id' => $message['id'], 'from' => $message['from'] ?? null, 'context' => $message['context'] ?? null, 'timestamp' => $message['timestamp'] ?? null])) {
            return 'duplicado';
        }

        return $this->receipts->reply('whatsapp', $message['context']['id'] ?? null, $message['from'] ?? null, is_string($text) ? $text : null, self::moment($message['timestamp'] ?? null))['result'] ?? 'ignorado';
    }

    public function template(string $accountId, array $value): array
    {
        $key = implode(':', ['plantilla', $value['message_template_id'] ?? $value['message_template_name'] ?? '', $value['event'] ?? '', $value['time'] ?? '']);

        return $this->receipts->claim('whatsapp', $key, $value)
            ? $this->reviews->apply($accountId, $value)
            : ['result' => 'duplicado', 'template' => $value['message_template_name'] ?? null, 'status' => null];
    }

    public static function tally(array $summary, string $result): array
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

    public static function merge(array $left, array $right): array
    {
        return array_map(fn (string $key): int => (int) ($left[$key] ?? 0) + (int) ($right[$key] ?? 0), array_combine(array_keys(self::EMPTY), array_keys(self::EMPTY)));
    }

    public static function moment(mixed $value): CarbonInterface
    {
        return match (true) {
            is_numeric($value) => CarbonImmutable::createFromTimestampUTC((int) $value),
            is_string($value) && $value !== '' => CarbonImmutable::parse($value)->utc(),
            default => CarbonImmutable::now('UTC'),
        };
    }
}
