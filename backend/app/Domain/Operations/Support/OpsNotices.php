<?php

declare(strict_types=1);

namespace App\Domain\Operations\Support;

use App\Domain\Admin\Support\NotificationLog;
use App\Domain\Crm\Support\Advisors;
use Illuminate\Support\Collection;

final class OpsNotices
{
    public const CHANNELS = ['push', 'whatsapp'];

    public function __construct(private readonly NotificationLog $log, private readonly Advisors $advisors) {}

    public function toOperations(string $event, string $subject, ?string $body, string $sourceType, string $sourceId, ?string $reservationId = null, ?string $coordinatorId = null, bool $managers = false): int
    {
        $roles = $managers ? ['operations', 'manager', 'tenant_admin'] : ['operations'];
        $recipients = $this->advisors->all($roles)->pluck('id')->push($coordinatorId)->filter()->map(fn (mixed $id): string => (string) $id)->unique();

        return $this->send($recipients, $event, $subject, $body, $sourceType, $sourceId, $reservationId);
    }

    public function toUsers(Collection $userIds, string $event, string $subject, ?string $body, string $sourceType, string $sourceId, ?string $reservationId = null): int
    {
        return $this->send($userIds->filter()->map(fn (mixed $id): string => (string) $id)->unique(), $event, $subject, $body, $sourceType, $sourceId, $reservationId);
    }

    private function send(Collection $recipients, string $event, string $subject, ?string $body, string $sourceType, string $sourceId, ?string $reservationId): int
    {
        foreach ($recipients as $userId) {
            $this->log->record([
                'event_code' => $event,
                'channel' => 'portal',
                'recipient_user_id' => $userId,
                'subject' => mb_substr($subject, 0, 200),
                'body_rendered' => $body,
                'source_type' => $sourceType,
                'source_id' => $sourceId,
                'reservation_id' => $reservationId,
            ]);
        }

        return $recipients->count();
    }
}
