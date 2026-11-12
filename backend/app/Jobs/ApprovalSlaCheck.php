<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Jobs\Concerns\NotifiesStaff;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

final class ApprovalSlaCheck extends TenantJob
{
    use NotifiesStaff;

    public const QUEUE = 'notifications';

    protected function run(): string
    {
        $now = Carbon::now();
        $open = DB::table('collab_approval_requests')->where('status', 'pendiente')->whereNotNull('due_at')->whereNull('paused_at')->get(['id', 'code', 'title', 'created_at', 'due_at', 'delegated_to']);
        $managers = $this->managers();
        $warned = 0;
        $late = 0;

        foreach ($open as $request) {
            $created = Carbon::parse($request->created_at);
            $due = Carbon::parse($request->due_at);
            $span = max(1, $created->diffInMinutes($due));
            $elapsed = $created->diffInMinutes($now, false);
            $event = $now->gte($due) ? 'sla_vencido' : ($elapsed >= $span * 0.75 ? 'sla_advertencia' : null);

            if ($event === null || DB::table('collab_approval_events')->where('request_id', $request->id)->where('event', $event)->exists()) {
                continue;
            }

            DB::table('collab_approval_events')->insert(['request_id' => $request->id, 'event' => $event, 'note' => $event === 'sla_vencido' ? 'Venció el plazo de respuesta' : 'Se consumió el 75 % del plazo', 'occurred_at' => $now]);
            $event === 'sla_vencido' ? $late++ : $warned++;
            $subject = $event === 'sla_vencido' ? "Aprobación {$request->code} vencida" : "Aprobación {$request->code} por vencer";

            foreach (array_unique(array_filter([...$managers, $request->delegated_to ? (string) $request->delegated_to : null])) as $userId) {
                $this->notifyOnce("aprobacion.{$event}", $userId, 'collab_approval_request', (string) $request->id, $subject, "{$request->title} · plazo ".$due->format('d/m/Y H:i'), false);
            }
        }

        return $warned + $late === 0 ? 'Aprobaciones dentro de plazo' : self::plural($warned, 'aprobación por vencer', 'aprobaciones por vencer').' · '.self::plural($late, 'vencida', 'vencidas');
    }
}
