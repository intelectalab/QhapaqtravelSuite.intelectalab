<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Domain\Admin\Support\NotificationLog;
use Illuminate\Support\Facades\DB;

final class RemindCrmActivities extends TenantJob
{
    public const QUEUE = 'notifications';

    protected function run(): string
    {
        $overdue = DB::table('crm_activities')->where('status', 'pendiente')->where('due_at', '<', now())
            ->orderBy('id')->lockForUpdate()->get(['id', 'owner_id']);

        if ($overdue->isNotEmpty()) {
            DB::table('crm_activities')->whereIn('id', $overdue->pluck('id'))->update(['status' => 'vencida', 'updated_at' => now()]);
        }

        $endOfDay = $this->today()->endOfDay();
        $pending = DB::table('crm_activities')->whereIn('status', ['pendiente', 'vencida'])->where('due_at', '<=', $endOfDay)
            ->groupBy('owner_id')->selectRaw("owner_id, count(*) as total, count(*) filter (where status = 'vencida') as late")->get();
        $log = app(NotificationLog::class);
        $notified = 0;

        foreach ($pending as $row) {
            $alreadyToday = DB::table('notif_messages')->where('event_code', 'actividad.vencida')->where('recipient_user_id', $row->owner_id)
                ->where('created_at', '>=', $this->today())->exists();

            if ($alreadyToday) {
                continue;
            }

            $log->record([
                'event_code' => 'actividad.vencida',
                'channel' => 'portal',
                'recipient_user_id' => $row->owner_id,
                'subject' => self::plural((int) $row->total, 'actividad por atender hoy', 'actividades por atender hoy'),
                'body_rendered' => (int) $row->late > 0 ? self::plural((int) $row->late, 'ya está vencida', 'ya están vencidas').'. Revisa tu agenda.' : 'Revisa tu agenda.',
                'source_type' => 'crm_activity',
            ]);
            $notified++;
        }

        if ($overdue->isEmpty() && $notified === 0) {
            return 'Sin actividades por recordar';
        }

        return self::plural($overdue->count(), 'actividad vencida', 'actividades vencidas').' · '.self::plural($notified, 'asesor avisado', 'asesores avisados');
    }
}
