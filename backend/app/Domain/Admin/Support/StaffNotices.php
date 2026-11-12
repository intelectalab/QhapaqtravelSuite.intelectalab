<?php

declare(strict_types=1);

namespace App\Domain\Admin\Support;

use App\Domain\Crm\Support\Advisors;
use App\Domain\Shared\Tenancy\TenantContext;
use App\Jobs\SendNotificationEmail;
use App\Jobs\SendPushNotification;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

final class StaffNotices
{
    public const MANAGERS = ['manager', 'tenant_admin'];

    public function __construct(private readonly NotificationLog $log, private readonly Advisors $advisors, private readonly TenantContext $context, private readonly NotificationRules $rules) {}

    public function toRoles(array $roles, string $event, string $subject, ?string $body, string $sourceType, ?string $sourceId, ?string $reservationId = null, iterable $alsoUsers = [], ?string $exceptUser = null): int
    {
        $users = $this->advisors->all($roles)->pluck('id')->merge(collect($alsoUsers))->filter()->map(fn (mixed $id): string => (string) $id)
            ->reject(fn (string $id): bool => $id === $exceptUser)->unique()->values();

        return $this->toUsers($users, $event, $subject, $body, $sourceType, $sourceId, $reservationId);
    }

    public function toManagers(string $event, string $subject, ?string $body, string $sourceType, ?string $sourceId, ?string $reservationId = null, ?string $exceptUser = null): int
    {
        return $this->toRoles(self::MANAGERS, $event, $subject, $body, $sourceType, $sourceId, $reservationId, [], $exceptUser);
    }

    public function toUser(?string $userId, string $event, string $subject, ?string $body, string $sourceType, ?string $sourceId, ?string $reservationId = null, ?string $exceptUser = null): int
    {
        if ($userId === null || $userId === '' || $userId === $exceptUser) {
            return 0;
        }

        return $this->toUsers(collect([$userId]), $event, $subject, $body, $sourceType, $sourceId, $reservationId);
    }

    public function toUsers(iterable $userIds, string $event, string $subject, ?string $body, string $sourceType, ?string $sourceId, ?string $reservationId = null): int
    {
        $recipients = collect($userIds)->filter()->map(fn (mixed $id): string => (string) $id)->unique()->values();

        if ($recipients->isEmpty()) {
            return 0;
        }

        $push = $this->pushEnabled($event);

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

        if ($push) {
            $this->push($recipients, $event, $subject, $body, $sourceType, $sourceId);
        }

        return $recipients->count();
    }

    public function email(?string $address, string $event, string $subject, string $body, string $sourceType, ?string $sourceId, string $audience = 'internal', array $link = []): ?string
    {
        if (! is_string($address) || ! filter_var($address, FILTER_VALIDATE_EMAIL) || ! $this->rules->allows($event, $link)) {
            return null;
        }

        $link = NotificationRules::withoutFacts($link);

        $message = $this->log->record([
            'event_code' => $event,
            'channel' => 'email',
            'recipient_address' => mb_substr($address, 0, 190),
            'subject' => mb_substr($subject, 0, 200),
            'body_rendered' => $body,
            'source_type' => $sourceType,
            'source_id' => $sourceId,
            'audience' => $audience,
            'status' => 'pendiente',
            ...$link,
        ]);

        dispatch((new SendNotificationEmail((string) $message->id))->forTenant($this->context->idOrFail())->delay($this->rules->releaseAt($event)))->afterCommit();

        return (string) $message->id;
    }

    public function emailUser(?string $userId, string $event, string $subject, string $body, string $sourceType, ?string $sourceId): ?string
    {
        return $userId ? $this->email((string) DB::table('iam_users')->where('id', $userId)->value('email'), $event, $subject, $body, $sourceType, $sourceId) : null;
    }

    public function agency(): string
    {
        return (string) ($this->context->tenant()->commercial_name ?? 'La agencia');
    }

    public function pushEnabled(string $event): bool
    {
        $rule = DB::table('notif_event_rules')->where('event_code', $event)->value('ch_push');

        return $rule === null || (bool) $rule;
    }

    private function push(Collection $recipients, string $event, string $subject, ?string $body, string $sourceType, ?string $sourceId): void
    {
        $withDevice = DB::table('ops_mobile_devices')->whereIn('user_id', $recipients->all())->whereNull('revoked_at')->whereNotNull('expo_push_token')->distinct()->pluck('user_id');

        if ($withDevice->isEmpty()) {
            return;
        }

        $data = ['event' => $event, 'source_type' => $sourceType, 'source_id' => $sourceId, ...($sourceType === 'ops_assignment' ? ['assignment_id' => $sourceId] : [])];
        dispatch((new SendPushNotification($withDevice->map(fn (mixed $id): string => (string) $id)->all(), mb_substr($subject, 0, 120), (string) ($body ?? ''), $data))->forTenant($this->context->idOrFail())->delay($this->rules->releaseAt($event)))->afterCommit();
    }
}
