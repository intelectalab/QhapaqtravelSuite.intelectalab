<?php

declare(strict_types=1);

namespace App\Jobs\Concerns;

use App\Domain\Admin\Support\NotificationLog;
use App\Domain\Crm\Support\Advisors;
use Illuminate\Support\Facades\DB;

trait NotifiesStaff
{
    protected function managers(): array
    {
        return app(Advisors::class)->all(['tenant_admin', 'manager'])->pluck('id')->map(fn (mixed $id): string => (string) $id)->all();
    }

    protected function notifyOnce(string $event, string $userId, string $sourceType, string $sourceId, string $subject, string $body, bool $daily): bool
    {
        $sent = DB::table('notif_messages')->where('event_code', $event)->where('recipient_user_id', $userId)
            ->where('source_type', $sourceType)->where('source_id', $sourceId)
            ->when($daily, fn ($query) => $query->where('created_at', '>=', $this->today()))
            ->exists();

        if ($sent) {
            return false;
        }

        app(NotificationLog::class)->record([
            'event_code' => $event,
            'channel' => 'portal',
            'recipient_user_id' => $userId,
            'subject' => mb_substr($subject, 0, 200),
            'body_rendered' => $body,
            'source_type' => $sourceType,
            'source_id' => $sourceId,
        ]);

        return true;
    }
}
