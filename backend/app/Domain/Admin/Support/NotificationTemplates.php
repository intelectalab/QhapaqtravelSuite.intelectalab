<?php

declare(strict_types=1);

namespace App\Domain\Admin\Support;

use App\Domain\Shared\Errors\ApiException;
use Illuminate\Support\Facades\DB;

final class NotificationTemplates
{
    public function current(string $event, string $channel): array
    {
        $this->assertTarget($event, $channel);
        $rows = DB::table('notif_templates as t')
            ->leftJoin('iam_users as u', 'u.id', '=', 't.created_by')
            ->where('t.event_code', $event)
            ->where('t.channel', $channel)
            ->orderByRaw('t.tenant_id is null')
            ->orderByDesc('t.version')
            ->get(['t.id', 't.tenant_id', 't.version', 't.subject', 't.body', 't.is_current', 't.provider_template_id', 't.created_at', 'u.name as author']);
        $current = $rows->first(fn (object $row): bool => (bool) $row->is_current);
        $system = $rows->first(fn (object $row): bool => $row->tenant_id === null && (bool) $row->is_current);
        $default = $system === null ? $this->builtIn($event, $channel) : ['subject' => $system->subject, 'body' => $system->body];

        return [
            'id' => $current->id ?? null,
            'event_code' => $event,
            'event_label' => NotificationCatalog::label($event),
            'channel' => $channel,
            'source' => $current !== null && $current->tenant_id !== null ? 'agencia' : 'sistema',
            'version' => $current !== null ? (int) $current->version : 1,
            'subject' => $current->subject ?? $default['subject'],
            'body' => $current->body ?? $default['body'],
            'provider_template_id' => $current->provider_template_id ?? null,
            'updated_at' => $current->created_at ?? null,
            'updated_by' => $current?->tenant_id !== null ? ($current->author ?? null) : null,
            'default' => $default,
            'preview' => [
                'subject' => NotificationCatalog::render((string) ($current->subject ?? $default['subject'])),
                'body' => NotificationCatalog::render((string) ($current->body ?? $default['body'])),
            ],
            'variables' => NotificationCatalog::VARIABLES,
            'max_length' => $channel === 'push' ? 140 : null,
            'versions' => $rows->filter(fn (object $row): bool => $row->tenant_id !== null)->map(fn (object $row): array => [
                'id' => $row->id,
                'version' => (int) $row->version,
                'current' => (bool) $row->is_current,
                'created_at' => $row->created_at,
                'created_by' => $row->author,
            ])->values()->all(),
        ];
    }

    public function assertTarget(string $event, string $channel): void
    {
        if (! NotificationCatalog::exists($event)) {
            throw ApiException::notFound('El evento no existe.');
        }

        if (! isset(NotificationCatalog::TEMPLATE_CHANNELS[$channel])) {
            throw ApiException::notFound('Ese canal no usa plantilla propia: el portal usa la del correo.');
        }
    }

    private function builtIn(string $event, string $channel): array
    {
        $label = NotificationCatalog::label($event);
        $message = NotificationCatalog::MESSAGES[$event] ?? "{$label}. Más detalles en {{enlace}}";

        return match ($channel) {
            'email' => ['subject' => "{$label} · {{agencia}}", 'body' => "Hola {{cliente}}:\n\n{$message}\n\nSaludos,\n{{vendedor}} · {{agencia}}"],
            'push' => ['subject' => $label, 'body' => mb_substr($message, 0, 140)],
            default => ['subject' => $label, 'body' => "Hola {{cliente}}, {$message}"],
        };
    }
}
