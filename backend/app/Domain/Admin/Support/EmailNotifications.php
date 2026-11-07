<?php

declare(strict_types=1);

namespace App\Domain\Admin\Support;

use App\Domain\Shared\Tenancy\TenantContext;
use App\Jobs\SendNotificationEmail;
use Illuminate\Support\Facades\DB;

final class EmailNotifications
{
    public function __construct(
        private readonly NotificationTemplates $templates,
        private readonly NotificationLog $log,
        private readonly TenantContext $context,
    ) {}

    public function enabled(string $event): bool
    {
        $rules = DB::table('notif_event_rules')->where('event_code', $event)->pluck('ch_email');

        return $rules->isEmpty() || $rules->contains(true);
    }

    public function queue(string $event, string $address, array $values, array $link = [], string $audience = 'client'): ?string
    {
        if (! str_contains($address, '@') || ! $this->enabled($event)) {
            return null;
        }

        $template = $this->templates->current($event, 'email');
        $values = array_filter($values, fn (mixed $value): bool => $value !== null && $value !== '');
        $values += ['agencia' => (string) $this->context->tenant()->commercial_name, 'vendedor' => 'El equipo'];
        $values += array_fill_keys(NotificationCatalog::VARIABLES, '');

        $message = $this->log->record([
            'event_code' => $event,
            'channel' => 'email',
            'recipient_address' => mb_substr($address, 0, 190),
            'subject' => mb_substr(NotificationCatalog::render((string) ($template['subject'] ?: NotificationCatalog::label($event)), $values), 0, 200),
            'body_rendered' => NotificationCatalog::render((string) $template['body'], $values),
            'template_id' => $template['id'],
            'audience' => $audience,
            'status' => 'pendiente',
            ...$link,
        ]);

        dispatch((new SendNotificationEmail((string) $message->id))->forTenant($this->context->idOrFail()))->afterCommit();

        return (string) $message->id;
    }
}
