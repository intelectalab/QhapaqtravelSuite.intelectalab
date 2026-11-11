<?php

declare(strict_types=1);

namespace App\Domain\Operations\Actions;

use App\Domain\Crm\Support\CodeSequence;
use App\Domain\Iam\Models\User;
use App\Domain\Operations\Support\IncidentDirectory;
use App\Domain\Operations\Support\OpsCommon;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class IncidentWorkflow
{
    public function __construct(private readonly CodeSequence $sequence, private readonly AuditLogger $audit, private readonly OpsCommon $common) {}

    public function create(array $data, User $actor): string
    {
        $order = DB::table('ops_orders')->whereNull('deleted_at')->where('code', $data['order_code'])->first(['id', 'reservation_id', 'coordinator_id', 'status'])
            ?? throw ApiException::unprocessable('VALIDATION_ERROR', 'Elige la orden operativa afectada.');

        if ($order->status === 'cancelada') {
            throw ApiException::unprocessable('VALIDATION_ERROR', 'La orden está cancelada.');
        }

        $assignee = $data['assignee_id'] ?? $order->coordinator_id;
        $this->common->ensureCoordinator($assignee);

        return DB::transaction(function () use ($data, $actor, $order, $assignee): string {
            $code = $this->sequence->next('ops_incidents', 'INC-', 4);
            $hours = IncidentDirectory::SLA_HOURS[$data['severity']];
            $id = (string) Str::uuid7();
            DB::table('ops_incidents')->insert([
                'id' => $id,
                'code' => $code,
                'order_id' => $order->id,
                'reservation_id' => $order->reservation_id,
                'type' => $data['type'],
                'severity' => $data['severity'],
                'title' => $data['title'],
                'description' => $data['description'],
                'status' => 'abierta',
                'assignee_id' => $assignee,
                'reported_by' => $actor->getKey(),
                'source' => 'web',
                'sla_hours' => $hours,
                'sla_due_at' => CarbonImmutable::now()->addHours($hours),
                'created_by' => $actor->getKey(),
            ]);
            $this->log($id, $actor, 'registro', 'Incidencia registrada desde la web.');

            if ($data['severity'] === 'critica') {
                $this->log($id, null, 'alerta', 'Alerta crítica enviada a gerencia.');
            }

            $this->audit->log('Incidencia', $code, 'crear', null, "{$data['severity']} · {$data['title']}");

            return $code;
        });
    }

    public function fromFeedback(string $feedbackCode, array $data, User $actor): array
    {
        return DB::transaction(function () use ($feedbackCode, $data, $actor): array {
            $feedback = DB::table('channel_pax_feedback')->where('code', $feedbackCode)->lock('for no key update')->first() ?? throw ApiException::notFound('El comentario no existe.');

            if ($feedback->status === 'derivado' || $feedback->incident_id !== null) {
                $existing = DB::table('ops_incidents')->where('id', $feedback->incident_id)->value('code');

                throw ApiException::conflict('VALIDATION_ERROR', 'El comentario ya se derivó'.($existing ? " a la incidencia {$existing}" : '').'.');
            }

            $order = DB::table('ops_orders')->whereNull('deleted_at')->where('reservation_id', $feedback->reservation_id)->where('status', '<>', 'cancelada')->first(['id', 'coordinator_id']);
            $assignee = $order->coordinator_id ?? null;
            $code = $this->sequence->next('ops_incidents', 'INC-', 4);
            $hours = IncidentDirectory::SLA_HOURS[$data['severity']];
            $id = (string) Str::uuid7();
            DB::table('ops_incidents')->insert([
                'id' => $id,
                'code' => $code,
                'order_id' => $order?->id,
                'reservation_id' => $feedback->reservation_id,
                'reservation_service_id' => $feedback->reservation_service_id,
                'type' => $data['type'],
                'severity' => $data['severity'],
                'title' => $data['title'],
                'description' => $data['description'],
                'status' => 'abierta',
                'assignee_id' => $assignee,
                'reported_by' => $actor->getKey(),
                'source' => 'web',
                'sla_hours' => $hours,
                'sla_due_at' => CarbonImmutable::now()->addHours($hours),
                'created_by' => $actor->getKey(),
            ]);
            $this->log($id, $actor, 'registro', "Incidencia creada desde el comentario del pasajero {$feedback->code}.");

            if ($data['severity'] === 'critica') {
                $this->log($id, null, 'alerta', 'Alerta crítica enviada a gerencia.');
            }

            DB::table('channel_pax_feedback')->where('id', $feedback->id)->update(['status' => 'derivado', 'incident_id' => $id, 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
            $this->audit->log('Incidencia', $code, 'crear', "Comentario {$feedback->code}", "abierta / {$data['severity']}");
            $this->audit->log('Comentario pasajero', (string) $feedback->code, 'derivar', (string) $feedback->status, "derivado · {$code}");

            return ['code' => $code, 'feedback' => $feedback->code, 'order' => $order !== null];
        });
    }

    public function update(string $code, array $data, User $actor): void
    {
        $incident = $this->open($code);
        $changes = [];
        $values = ['updated_by' => $actor->getKey(), 'updated_at' => now()];

        if ($data['severity'] !== $incident->severity || $data['type'] !== $incident->type) {
            $hours = IncidentDirectory::SLA_HOURS[$data['severity']];
            $values += ['severity' => $data['severity'], 'type' => $data['type'], 'sla_hours' => $hours, 'sla_due_at' => CarbonImmutable::parse($incident->created_at)->addHours($hours)];
            $changes[] = ['reclasificacion', "Reclasificada: {$incident->type} · {$incident->severity} → {$data['type']} · {$data['severity']}."];

            if ($data['severity'] === 'critica' && $incident->severity !== 'critica') {
                $changes[] = ['alerta', 'Escalada a crítica: alerta enviada a gerencia.'];
            }
        }

        if (! empty($data['assignee_id']) && $data['assignee_id'] !== $incident->assignee_id) {
            $this->common->ensureCoordinator($data['assignee_id']);
            $values['assignee_id'] = $data['assignee_id'];
            $changes[] = ['asignacion', 'Responsable: '.DB::table('iam_users')->where('id', $data['assignee_id'])->value('name').'.'];
        }

        $values += ['title' => $data['title'], 'description' => $data['description']];
        DB::table('ops_incidents')->where('id', $incident->id)->update($values);

        foreach ($changes as [$kind, $message]) {
            $this->log($incident->id, $actor, $kind, $message);
        }

        $this->audit->log('Incidencia', $code, 'editar', $incident->severity, $data['severity']);
    }

    public function take(string $code, User $actor): void
    {
        $incident = $this->incident($code);

        if ($incident->status !== 'abierta') {
            throw ApiException::conflict('OPS-BR-05', 'Solo una incidencia abierta pasa a en proceso.');
        }

        DB::table('ops_incidents')->where('id', $incident->id)->update(['status' => 'en_proceso', 'assignee_id' => $incident->assignee_id ?? $actor->getKey(), 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
        $this->log($incident->id, $actor, 'estado', 'En proceso.');
        $this->audit->log('Incidencia', $code, 'cambio_estado', 'abierta', 'en_proceso');
    }

    public function resolve(string $code, string $resolution, User $actor): void
    {
        $incident = $this->open($code);
        DB::table('ops_incidents')->where('id', $incident->id)->update(['status' => 'resuelta', 'resolution' => $resolution, 'resolved_at' => now(), 'resolved_by' => $actor->getKey(), 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
        $this->log($incident->id, $actor, 'resolucion', $resolution);
        $this->audit->log('Incidencia', $code, 'resolver', $incident->status, 'resuelta');
    }

    public function close(string $code, ?string $comment, User $actor): void
    {
        $incident = $this->incident($code);

        if ($incident->status === 'cerrada') {
            throw ApiException::conflict('OPS-BR-05', 'La incidencia ya está cerrada.');
        }

        $resolution = $incident->resolution;

        if ($resolution === null && in_array($incident->severity, ['alta', 'critica'], true)) {
            throw ApiException::unprocessable('OPS-BR-62', 'Las incidencias altas o críticas se cierran después de registrar su resolución.');
        }

        if ($incident->severity === 'critica' && ! DB::table('ops_evidences')->where('incident_id', $incident->id)->whereNull('removed_at')->exists()) {
            throw ApiException::unprocessable('OPS-BR-62', 'Una incidencia crítica necesita al menos una evidencia para cerrarse.');
        }

        if ($resolution === null && blank($comment)) {
            throw ApiException::unprocessable('OPS-BR-62', 'Escribe un comentario de cierre.');
        }

        DB::table('ops_incidents')->where('id', $incident->id)->update([
            'status' => 'cerrada',
            'resolution' => $resolution ?? $comment,
            'resolved_at' => $incident->resolved_at ?? now(),
            'resolved_by' => $incident->resolved_by ?? $actor->getKey(),
            'closed_at' => now(),
            'closed_by' => $actor->getKey(),
            'updated_by' => $actor->getKey(),
            'updated_at' => now(),
        ]);
        $this->log($incident->id, $actor, 'estado', 'Cerrada'.($comment ? ": {$comment}" : '.'));
        $this->audit->log('Incidencia', $code, 'cerrar', $incident->status, 'cerrada');
    }

    public function reopen(string $code, string $reason, User $actor): void
    {
        $incident = $this->incident($code);

        if (! in_array($incident->status, ['cerrada', 'resuelta'], true)) {
            throw ApiException::conflict('OPS-BR-63', 'Solo se reabre una incidencia resuelta o cerrada.');
        }

        DB::table('ops_incidents')->where('id', $incident->id)->update(['status' => 'en_proceso', 'closed_at' => null, 'closed_by' => null, 'resolution' => null, 'resolved_at' => null, 'resolved_by' => null, 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
        $this->log($incident->id, $actor, 'estado', "Reabierta: {$reason}");
        $this->audit->log('Incidencia', $code, 'reabrir', $incident->status, $reason);
    }

    public function comment(string $code, string $message, User $actor): void
    {
        $incident = $this->incident($code);
        $this->log($incident->id, $actor, 'comentario', $message);
    }

    private function log(string $incidentId, ?User $actor, string $kind, string $message): void
    {
        DB::table('ops_incident_logs')->insert(['incident_id' => $incidentId, 'user_id' => $actor?->getKey(), 'kind' => $kind, 'message' => $message, 'visibility' => 'interna', 'created_by' => $actor?->getKey()]);
    }

    private function incident(string $code): object
    {
        return DB::table('ops_incidents')->where('code', $code)->first() ?? throw ApiException::notFound('La incidencia no existe.');
    }

    private function open(string $code): object
    {
        $incident = $this->incident($code);

        if (! in_array($incident->status, IncidentDirectory::OPEN, true)) {
            throw ApiException::conflict('OPS-BR-05', 'La incidencia ya está resuelta o cerrada.');
        }

        return $incident;
    }
}
