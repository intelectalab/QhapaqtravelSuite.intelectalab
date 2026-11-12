<?php

declare(strict_types=1);

namespace App\Domain\Operations\Support;

use App\Domain\Admin\Support\StaffNotices;
use Illuminate\Support\Collection;

final class OpsNotices
{
    public const CHANNELS = ['push', 'whatsapp'];

    public function __construct(private readonly StaffNotices $notices) {}

    public function toOperations(string $event, string $subject, ?string $body, string $sourceType, string $sourceId, ?string $reservationId = null, ?string $coordinatorId = null, bool $managers = false): int
    {
        $roles = $managers ? ['operations', ...StaffNotices::MANAGERS] : ['operations'];

        return $this->notices->toRoles($roles, $event, $subject, $body, $sourceType, $sourceId, $reservationId, [$coordinatorId]);
    }

    public function toUsers(Collection $userIds, string $event, string $subject, ?string $body, string $sourceType, string $sourceId, ?string $reservationId = null): int
    {
        return $this->notices->toUsers($userIds, $event, $subject, $body, $sourceType, $sourceId, $reservationId);
    }
}
