<?php

declare(strict_types=1);

namespace App\Domain\Admin\Support;

use App\Domain\Iam\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

final class NotificationDirectory
{
    public function __construct(private readonly AuditDirectory $audit) {}

    public function overview(User $viewer): array
    {
        $rules = DB::table('notif_event_rules as r')
            ->leftJoin('iam_users as u', 'u.id', '=', 'r.updated_by')
            ->get(['r.event_code', 'r.label', 'r.ch_email', 'r.ch_whatsapp', 'r.ch_push', 'r.ch_portal', 'r.recipients', 'r.timing', 'r.condition', 'r.updated_at', 'u.name as user_name'])
            ->keyBy('event_code');
        $messages = DB::table('notif_messages as m')
            ->leftJoin('iam_users as u', 'u.id', '=', 'm.recipient_user_id')
            ->orderByDesc('m.created_at')
            ->limit(500)
            ->get(['m.code', 'm.event_code', 'm.channel', 'm.recipient_address', 'm.subject', 'm.status', 'm.retries', 'm.last_error', 'm.is_fallback', 'm.audience', 'm.created_at', 'm.sent_at', 'u.name as user_name']);
        $week = Carbon::today()->subDays(6);

        return [
            'rules' => collect(NotificationCatalog::EVENTS)->map(function (array $event, string $code) use ($rules): array {
                $row = $rules[$code] ?? null;

                return [
                    'event' => $code,
                    'label' => $event['label'],
                    'group' => $event['group'],
                    'channels' => [
                        'email' => (bool) ($row->ch_email ?? false),
                        'whatsapp' => (bool) ($row->ch_whatsapp ?? false),
                        'push' => (bool) ($row->ch_push ?? false),
                        'portal' => (bool) ($row->ch_portal ?? false),
                    ],
                    'recipients' => $row->recipients ?? $event['recipients'],
                    'timing' => $row->timing ?? 'immediate',
                    'condition' => $row->condition ?? 'always',
                    'critical' => $code === 'incidencia.critica',
                    'updated_at' => $row->updated_at ?? null,
                    'updated_by' => $row->user_name ?? null,
                ];
            })->values(),
            'messages' => $messages->map(fn (object $row): array => [
                'code' => $row->code,
                'event' => $row->event_code,
                'event_label' => NotificationCatalog::label($row->event_code),
                'channel' => $row->channel,
                'to' => $row->user_name ?? $row->recipient_address ?? '—',
                'subject' => $row->subject,
                'status' => $row->status,
                'retries' => (int) $row->retries,
                'error' => $row->last_error,
                'permanent' => $row->last_error !== null && str_contains($row->last_error, '131026'),
                'fallback' => (bool) $row->is_fallback,
                'audience' => $row->audience,
                'at' => $row->created_at,
                'sent_at' => $row->sent_at,
            ])->values(),
            'kpis' => [
                'sent_7d' => $messages->where('status', 'enviado')->filter(fn (object $row): bool => Carbon::parse($row->created_at)->gte($week))->count(),
                'failed' => $messages->where('status', 'fallido')->count(),
                'pending' => $messages->where('status', 'pendiente')->count(),
                'routes' => $rules->sum(fn (object $row): int => (int) $row->ch_email + (int) $row->ch_whatsapp + (int) $row->ch_push + (int) $row->ch_portal),
            ],
            'options' => [
                'channels' => collect(NotificationCatalog::CHANNELS)->map(fn (string $label, string $value): array => ['value' => $value, 'label' => $label])->values(),
                'timings' => collect(NotificationCatalog::TIMINGS)->map(fn (string $label, string $value): array => ['value' => $value, 'label' => $label])->values(),
                'conditions' => collect(NotificationCatalog::CONDITIONS)->map(fn (string $label, string $value): array => ['value' => $value, 'label' => $label])->values(),
            ],
            'history' => $this->audit->recent(['Notificación'], 8),
            'can_manage' => $viewer->can('admin.settings.manage'),
        ];
    }
}
