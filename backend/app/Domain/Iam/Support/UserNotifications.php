<?php

declare(strict_types=1);

namespace App\Domain\Iam\Support;

use App\Domain\Admin\Support\NotificationCatalog;
use App\Domain\Iam\Models\User;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class UserNotifications
{
    public const LIMIT = 25;

    public function list(User $user): array
    {
        $rows = $this->query($user)
            ->leftJoin('notif_reads as r', fn ($join) => $join->on('r.notification_id', '=', 'm.id')->where('r.user_id', '=', $user->getKey()))
            ->orderByDesc('m.created_at')
            ->limit(self::LIMIT)
            ->get(['m.id', 'm.code', 'm.event_code', 'm.channel', 'm.subject', 'm.body_rendered', 'm.source_type', 'm.status', 'm.created_at', 'm.sent_at', 'm.read_at', 'r.read_at as read_by_user_at']);

        return [
            'items' => $rows->map(fn (object $row): array => [
                'id' => $row->id,
                'code' => $row->code,
                'event_code' => $row->event_code,
                'event_label' => NotificationCatalog::label($row->event_code),
                'channel' => $row->channel,
                'subject' => $row->subject,
                'body' => $row->body_rendered,
                'source_type' => $row->source_type,
                'status' => $row->status,
                'created_at' => $row->created_at,
                'read_at' => $row->read_by_user_at ?? $row->read_at,
                'read' => ($row->read_by_user_at ?? $row->read_at) !== null,
            ])->values()->all(),
            'unread_count' => $this->unread($user)->count(),
            'can_view_log' => $user->can('admin.settings.manage'),
        ];
    }

    public function readAll(User $user): array
    {
        return DB::transaction(function () use ($user): array {
            $ids = $this->unread($user)->pluck('m.id');

            if ($ids->isNotEmpty()) {
                DB::table('notif_reads')->insertOrIgnore($ids->map(fn (string $id): array => ['id' => (string) Str::uuid7(), 'notification_id' => $id, 'user_id' => $user->getKey(), 'read_at' => now()])->all());
                DB::table('notif_messages')->whereIn('id', $ids)->whereNull('read_at')->update(['read_at' => now()]);
            }

            return ['marked' => $ids->count(), 'unread_count' => 0];
        });
    }

    private function unread(User $user): Builder
    {
        return $this->query($user)
            ->whereNull('m.read_at')
            ->whereNotExists(fn (Builder $query) => $query->from('notif_reads as r')->whereColumn('r.notification_id', 'm.id')->where('r.user_id', $user->getKey()));
    }

    private function query(User $user): Builder
    {
        return DB::table('notif_messages as m')->where('m.recipient_user_id', $user->getKey());
    }
}
