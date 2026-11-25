<?php

declare(strict_types=1);

namespace App\Domain\Admin\Support;

use App\Domain\Crm\Support\Advisors;
use App\Domain\Inbox\Support\WhatsappAccounts;
use App\Domain\Shared\Tenancy\TenantContext;
use App\Jobs\SendNotificationEmail;
use App\Jobs\SendNotificationWhatsapp;
use App\Jobs\SendPushNotification;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

final class StaffNotices
{
    public const MANAGERS = ['manager', 'tenant_admin'];

    public const WHATSAPP_MISSING = 'Conecta tu WhatsApp en Administración › WhatsApp para que este aviso también salga por ese canal: por ahora llegó por el portal y la app.';

    public const WHATSAPP_NO_PHONE = 'Sin celular registrado: no se pudo avisar por WhatsApp.';

    public const WHATSAPP_OFF = 'La regla de este aviso tiene WhatsApp apagado en Administración › Notificaciones.';

    public function __construct(private readonly NotificationLog $log, private readonly Advisors $advisors, private readonly TenantContext $context, private readonly NotificationRules $rules, private readonly WhatsappAccounts $accounts) {}

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

    public function whatsapp(iterable $recipients, string $event, string $subject, string $body, string $sourceType, ?string $sourceId, ?string $reservationId = null): array
    {
        $targets = collect($recipients)->map(fn (array $recipient): array => ['user_id' => $recipient['user_id'] ?? null, 'phone' => self::phone($recipient['phone'] ?? null)])
            ->unique(fn (array $recipient): string => $recipient['phone'] ?? 'user:'.$recipient['user_id'])->values();

        if ($targets->isEmpty()) {
            return ['queued' => 0, 'skipped' => null];
        }

        if (! $this->whatsappEnabled($event)) {
            return ['queued' => 0, 'skipped' => self::WHATSAPP_OFF];
        }

        $connected = $this->accounts->sender() !== null;
        $queued = 0;

        foreach ($targets as $target) {
            $reason = match (true) {
                ! $connected => self::WHATSAPP_MISSING,
                $target['phone'] === null => self::WHATSAPP_NO_PHONE,
                default => null,
            };
            $message = $this->log->record([
                'event_code' => $event,
                'channel' => 'whatsapp',
                'recipient_user_id' => $target['user_id'],
                'recipient_address' => $target['phone'],
                'subject' => mb_substr($subject, 0, 200),
                'body_rendered' => $body,
                'source_type' => $sourceType,
                'source_id' => $sourceId,
                'reservation_id' => $reservationId,
                'status' => $reason === null ? 'pendiente' : 'fallido',
                'last_error' => $reason,
            ]);

            if ($reason === null) {
                $queued++;
                dispatch((new SendNotificationWhatsapp((string) $message->id))->forTenant($this->context->idOrFail())->delay($this->rules->releaseAt($event)))->afterCommit();
            }
        }

        return ['queued' => $queued, 'skipped' => $connected ? null : self::WHATSAPP_MISSING];
    }

    public function whatsappEnabled(string $event): bool
    {
        $rule = DB::table('notif_event_rules')->where('event_code', $event)->value('ch_whatsapp');

        return $rule === null || (bool) $rule;
    }

    public static function phone(?string $phone): ?string
    {
        $digits = (string) preg_replace('/\D+/', '', (string) $phone);

        return match (true) {
            strlen($digits) < 9 => null,
            strlen($digits) === 9 => '+51'.$digits,
            default => '+'.$digits,
        };
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
