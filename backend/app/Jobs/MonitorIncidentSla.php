<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Jobs\Concerns\NotifiesStaff;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

final class MonitorIncidentSla extends TenantJob
{
    use NotifiesStaff;

    public const QUEUE = 'critical';

    protected function run(): string
    {
        $incidents = DB::table('ops_incidents')->whereIn('status', ['abierta', 'en_proceso'])->whereNotNull('sla_due_at')->where('sla_due_at', '<', now())
            ->orderBy('sla_due_at')->get(['id', 'code', 'title', 'severity', 'assignee_id', 'sla_due_at']);

        if ($incidents->isEmpty()) {
            return 'Ninguna incidencia con SLA vencido';
        }

        $managers = $this->managers();
        $sent = 0;

        foreach ($incidents as $incident) {
            $due = Carbon::parse($incident->sla_due_at)->setTimezone($this->today()->getTimezone());

            foreach (array_unique(array_filter([$incident->assignee_id ? (string) $incident->assignee_id : null, ...$managers])) as $userId) {
                $sent += $this->notifyOnce('incidencia.sla_vencido', $userId, 'ops_incident', (string) $incident->id, "SLA vencido: {$incident->code}",
                    "{$incident->title} (gravedad {$incident->severity}) debía atenderse hasta el {$due->format('d/m/Y H:i')}.", false) ? 1 : 0;
            }
        }

        return $this->warn(self::plural($incidents->count(), 'incidencia con SLA vencido', 'incidencias con SLA vencido').' · '.self::plural($sent, 'aviso nuevo', 'avisos nuevos'));
    }
}
