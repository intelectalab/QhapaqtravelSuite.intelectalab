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
        $managers = $this->managers();
        $escalateMinutes = $this->setting('operations', 'incident_escalate_min', 30);
        $unattended = DB::table('ops_incidents')->where('status', 'abierta')->where('created_at', '<', now()->subMinutes(max(1, $escalateMinutes)))->get(['id', 'code', 'title', 'severity']);
        $escalated = 0;

        foreach ($unattended as $incident) {
            foreach ($managers as $userId) {
                $escalated += $this->notifyOnce('incidencia.escalada', $userId, 'ops_incident', (string) $incident->id, "Sin atender: {$incident->code}", "{$incident->title} (gravedad {$incident->severity}) lleva más de {$escalateMinutes} min abierta sin que nadie la tome.", false) ? 1 : 0;
            }
        }

        $incidents = DB::table('ops_incidents')->whereIn('status', ['abierta', 'en_proceso'])->whereNotNull('sla_due_at')->where('sla_due_at', '<', now())
            ->orderBy('sla_due_at')->get(['id', 'code', 'title', 'severity', 'assignee_id', 'sla_due_at']);

        if ($incidents->isEmpty()) {
            return $escalated > 0 ? $this->warn(self::plural($escalated, 'escalada a gerencia', 'escaladas a gerencia')) : 'Ninguna incidencia con SLA vencido';
        }

        $sent = $escalated;

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
