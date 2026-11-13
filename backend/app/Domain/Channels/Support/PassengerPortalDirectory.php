<?php

declare(strict_types=1);

namespace App\Domain\Channels\Support;

use App\Domain\Iam\Models\User;
use Illuminate\Support\Facades\DB;

final class PassengerPortalDirectory
{
    public function overview(User $viewer): array
    {
        $messages = DB::table('notif_pax_messages as m')
            ->leftJoin('booking_reservations as r', 'r.id', '=', 'm.reservation_id')
            ->leftJoin('notif_pax_message_templates as t', 't.id', '=', 'm.template_id')
            ->orderByRaw('coalesce(m.sent_at, m.scheduled_at) desc nulls last')
            ->get(['m.code', 'm.channel', 'm.recipient', 'm.subject', 'm.body', 'm.status', 'm.direction', 'm.origin', 'm.scheduled_at', 'm.sent_at', 'm.delivered_at', 'm.read_at', 'm.attempts', 'm.error', 'm.lang', 'r.code as reservation', 'r.title as reservation_title', 't.name as template']);
        $feedback = DB::table('channel_pax_feedback as f')
            ->join('booking_reservations as r', 'r.id', '=', 'f.reservation_id')
            ->leftJoin('booking_reservation_services as s', 's.id', '=', 'f.reservation_service_id')
            ->leftJoin('iam_users as u', 'u.id', '=', 'f.replied_by')
            ->orderByDesc('f.created_at')
            ->get(['f.code', 'f.passenger_name', 'f.type', 'f.rating', 'f.text', 'f.status', 'f.reply', 'f.replied_at', 'f.channel', 'f.contact_email', 'f.contact_phone', 'f.created_at', 'r.code as reservation', 'r.title as reservation_title', 's.name as service', 'u.name as replied_by']);
        $sent = $messages->whereIn('status', ['enviado', 'entregado', 'leido']);
        $rated = $feedback->whereNotNull('rating');

        return [
            'kpis' => [
                'sent' => $sent->count(),
                'read' => $messages->where('status', 'leido')->count(),
                'read_pct' => $sent->count() ? round($messages->where('status', 'leido')->count() / $sent->count() * 100) : null,
                'scheduled' => $messages->where('status', 'programado')->count(),
                'failed' => $messages->where('status', 'fallido')->count(),
                'feedback_new' => $feedback->where('status', 'nuevo')->count(),
                'feedback_total' => $feedback->count(),
                'rating' => $rated->count() ? round($rated->avg('rating'), 1) : null,
            ],
            'messages' => $messages->map(fn (object $row): array => [
                'code' => $row->code,
                'channel' => $row->channel,
                'recipient' => $row->recipient,
                'subject' => $row->subject,
                'body' => $row->body,
                'status' => $row->status,
                'direction' => $row->direction,
                'origin' => $row->origin,
                'template' => $row->template,
                'scheduled_at' => $row->scheduled_at,
                'sent_at' => $row->sent_at,
                'read_at' => $row->read_at,
                'attempts' => (int) $row->attempts,
                'error' => $row->error,
                'lang' => $row->lang,
                'reservation' => $row->reservation,
                'reservation_title' => $row->reservation_title,
            ])->values(),
            'feedback' => $feedback->map(fn (object $row): array => [
                'code' => $row->code,
                'passenger' => $row->passenger_name,
                'type' => $row->type,
                'rating' => $row->rating !== null ? (int) $row->rating : null,
                'text' => $row->text,
                'status' => $row->status,
                'reply' => $row->reply,
                'replied_at' => $row->replied_at,
                'replied_by' => $row->replied_by,
                'channel' => $row->channel,
                'email' => $row->contact_email,
                'phone' => $row->contact_phone,
                'created_at' => $row->created_at,
                'reservation' => $row->reservation,
                'reservation_title' => $row->reservation_title,
                'service' => $row->service,
            ])->values(),
            'can_reply' => $viewer->can('operations.assign') || $viewer->can('channels.b2b.manage') || $viewer->can('channels.cms.publish'),
            'previewable' => DB::table('iam_users as u')->join('booking_reservations as r', 'r.id', '=', 'u.reservation_id')
                ->whereNull('u.deleted_at')->where('u.status', 'activo')->whereNull('r.deleted_at')->whereNotIn('r.status', ['cancelada', 'borrador'])
                ->orderByDesc('r.travel_from')->limit(50)->get(['r.code', 'r.title', 'r.travel_from', 'u.name'])
                ->unique('code')->map(fn (object $row): array => ['code' => $row->code, 'title' => $row->title, 'from' => $row->travel_from, 'passenger' => $row->name])->values(),
        ];
    }
}
