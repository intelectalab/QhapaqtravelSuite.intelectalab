<?php

declare(strict_types=1);

namespace App\Domain\Mobile\Actions;

use App\Domain\Booking\Support\ReservationIncidents;
use App\Domain\Crm\Support\CodeSequence;
use App\Domain\Mobile\Support\OperatorDirectory;
use App\Domain\Mobile\Support\OperatorResource;
use App\Domain\Operations\Actions\EvidenceWorkflow;
use App\Domain\Operations\Support\IncidentDirectory;
use App\Domain\Operations\Support\OpsNotices;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class OperatorActions
{
    public const TYPES = ['confirm', 'start', 'checkin', 'checkin_all', 'evidence', 'incident', 'finish'];

    public const MAX_BATCH = 50;

    public const DEVICE_REVOKED = 'DEVICE_REVOKED';

    public const DEVICE_REVOKED_MESSAGE = 'Tu agencia desactivó este teléfono. Borramos los datos guardados; vuelve a iniciar sesión.';

    public function __construct(
        private readonly OperatorDirectory $directory,
        private readonly EvidenceWorkflow $evidence,
        private readonly CodeSequence $sequence,
        private readonly AuditLogger $audit,
        private readonly OpsNotices $notices,
        private readonly ReservationIncidents $reservations,
    ) {}

    public function sync(OperatorResource $resource, array $actions): array
    {
        $ordered = collect($actions)->sortBy(fn (array $action) => $action['occurred_at'])->values();

        return ['results' => $ordered->map(fn (array $action): array => $this->handle($resource, $action))->values()->all()];
    }

    public function handle(OperatorResource $resource, array $action): array
    {
        $stored = DB::table('ops_sync_actions')->where('id', $action['client_action_id'])->first();

        if ($stored !== null) {
            if ((string) $stored->user_id !== (string) $resource->user->getKey()) {
                throw ApiException::conflict('MOB-BR-01', 'Ese identificador de acción ya se usó en otro dispositivo.');
            }

            DB::table('ops_sync_actions')->where('id', $stored->id)->update(['attempts' => DB::raw('attempts + 1')]);

            return [...(array) json_decode((string) $stored->response, true), 'result' => 'duplicate'];
        }

        $this->device($resource, (string) $action['device_id']);

        try {
            $outcome = DB::transaction(fn (): array => $this->apply($resource, $action));
        } catch (ApiException $rejected) {
            $outcome = ['result' => 'rejected', 'conflict_rule' => $rejected->ruleCode, 'message' => $rejected->getMessage(), 'assignment_id' => (string) $action['assignment_id']];
        }

        $response = [
            'client_action_id' => $action['client_action_id'],
            'type' => $action['type'],
            'result' => $outcome['result'],
            'conflict_rule' => $outcome['conflict_rule'] ?? null,
            'message' => $outcome['message'] ?? null,
            'data' => $outcome['data'] ?? null,
            'assignment' => $this->safeDetail($resource, (string) $action['assignment_id']),
        ];

        DB::table('ops_sync_actions')->insert([
            'id' => $action['client_action_id'],
            'user_id' => $resource->user->getKey(),
            'device_id' => $action['device_id'],
            'resource_type' => $resource->type,
            'resource_id' => $resource->id(),
            'action_type' => $action['type'] === 'checkin' && ! empty($action['payload']['undo']) ? 'checkin_undo' : $action['type'],
            'assignment_id' => $action['assignment_id'],
            'coalesce_key' => mb_substr($this->coalesceKey($action), 0, 120),
            'payload' => json_encode($action['payload'] ?? (object) []),
            'occurred_at' => $action['occurred_at'],
            'captured_offline' => (bool) ($action['offline'] ?? false),
            'result' => $response['result'],
            'conflict_rule' => $response['conflict_rule'],
            'conflict_message' => $response['result'] === 'applied' ? null : $response['message'],
            'response' => json_encode($response),
        ]);
        DB::table('ops_mobile_devices')->where('id', $action['device_id'])->update(['last_seen_at' => now(), 'last_sync_at' => now(), 'updated_at' => now()]);

        return $response;
    }

    private function apply(OperatorResource $resource, array $action): array
    {
        $assignment = $this->lock($resource, (string) $action['assignment_id']);
        $at = CarbonImmutable::parse((string) $action['occurred_at']);
        $offline = (bool) ($action['offline'] ?? false);
        $payload = (array) ($action['payload'] ?? []);

        return match ($action['type']) {
            'confirm' => $this->confirm($resource, $assignment, $at, $offline),
            'start' => $this->start($resource, $assignment, $at, $offline),
            'checkin' => $this->checkin($resource, $assignment, $action, $at, [(string) ($payload['passenger_id'] ?? '')], (bool) ($payload['undo'] ?? false)),
            'checkin_all' => $this->checkin($resource, $assignment, $action, $at, DB::table('booking_passengers')->where('reservation_id', $assignment->reservation_id)->pluck('id')->map(fn (mixed $id): string => (string) $id)->all(), false),
            'evidence' => $this->evidence($resource, $assignment, $action, $at, $payload),
            'incident' => $this->incident($resource, $assignment, $action, $at, $payload),
            'finish' => $this->finish($resource, $assignment, $at, $offline),
            default => throw ApiException::unprocessable('MOB-BR-10', 'Acción no reconocida.'),
        };
    }

    private function confirm(OperatorResource $resource, object $assignment, CarbonImmutable $at, bool $offline): array
    {
        if (in_array($assignment->status, ['confirmada', 'en_curso', 'completada'], true)) {
            return ['result' => 'conflict_resolved', 'conflict_rule' => 'MOB-BR-05', 'message' => 'La asignación ya estaba confirmada.'];
        }

        if ($assignment->status !== 'asignada') {
            throw ApiException::conflict('MOB-BR-10', 'La asignación aún no tiene recursos: no hay nada que confirmar.');
        }

        DB::table('ops_assignments')->where('id', $assignment->id)->update(['status' => 'confirmada', 'confirmed_at' => $at, 'confirmed_via' => 'app', 'lock_version' => DB::raw('lock_version + 1'), 'updated_by' => $resource->user->getKey(), 'updated_at' => now()]);
        $this->recompute((string) $assignment->order_id);
        $this->log($assignment, 'confirmar_recurso', $assignment->status, 'confirmada', $at, $offline);
        $this->notify($assignment, 'asignacion.confirmada', "{$resource->row->full_name} confirmó {$assignment->service_label}", $at);

        return ['result' => 'applied'];
    }

    private function start(OperatorResource $resource, object $assignment, CarbonImmutable $at, bool $offline): array
    {
        if (in_array($assignment->status, ['en_curso', 'completada'], true)) {
            $earliest = $assignment->started_at !== null && CarbonImmutable::parse($assignment->started_at)->lessThan($at) ? $assignment->started_at : $at;
            DB::table('ops_assignments')->where('id', $assignment->id)->update(['started_at' => $earliest, 'updated_at' => now()]);

            return ['result' => 'conflict_resolved', 'conflict_rule' => 'MOB-BR-07', 'message' => 'El servicio ya estaba iniciado; se conserva la hora real de inicio más temprana.'];
        }

        if ($assignment->status !== 'confirmada') {
            throw ApiException::conflict('MOB-BR-10', 'Confirme la asignación antes de iniciar el servicio.');
        }

        DB::table('ops_assignments')->where('id', $assignment->id)->update(['status' => 'en_curso', 'started_at' => $at, 'lock_version' => DB::raw('lock_version + 1'), 'updated_by' => $resource->user->getKey(), 'updated_at' => now()]);
        DB::table('booking_reservation_services')->where('id', $assignment->reservation_service_id)->where('status', 'confirmado')->update(['status' => 'en_curso', 'lock_version' => DB::raw('lock_version + 1'), 'updated_at' => now()]);
        $movedOrder = DB::table('ops_orders')->where('id', $assignment->order_id)->where('status', 'confirmada')->update(['status' => 'en_ejecucion', 'lock_version' => DB::raw('lock_version + 1'), 'updated_at' => now()]);

        if ($movedOrder > 0) {
            $this->audit->log('Orden operativa', (string) $assignment->order_code, 'cambio_estado', 'confirmada', 'en_ejecucion', actor: $resource->user);
        }

        if ($movedOrder > 0 && DB::table('booking_reservations')->where('id', $assignment->reservation_id)->where('status', 'confirmada')->update(['status' => 'en_operacion', 'updated_at' => now()]) > 0) {
            $this->audit->log('Reserva', (string) $assignment->reservation_code, 'iniciar_operacion', 'confirmada', 'en_operacion', actor: $resource->user);
        }

        $this->log($assignment, 'iniciar', 'confirmada', 'en_curso', $at, $offline);
        $this->notify($assignment, 'asignacion.iniciada', "{$resource->row->full_name} inició {$assignment->service_label}", $at);

        return ['result' => 'applied'];
    }

    private function checkin(OperatorResource $resource, object $assignment, array $action, CarbonImmutable $at, array $passengers, bool $undo): array
    {
        if ($assignment->status !== 'en_curso') {
            throw ApiException::conflict('OPS-BR-50', 'El check-in se habilita cuando el servicio está en curso.');
        }

        $roster = DB::table('booking_passengers')->where('reservation_id', $assignment->reservation_id)->pluck('id')->map(fn (mixed $id): string => (string) $id);

        if ($passengers === [] || collect($passengers)->diff($roster)->isNotEmpty()) {
            throw ApiException::unprocessable('MOB-BR-10', 'El pasajero no pertenece a este servicio.');
        }

        $current = DB::table('ops_assignment_checkins')->where('assignment_id', $assignment->id)->whereNull('undone_at')->lockForUpdate()->get(['id', 'passenger_id', 'checked_at'])->keyBy('passenger_id');

        if ($undo) {
            $removed = DB::table('ops_assignment_checkins')->where('assignment_id', $assignment->id)->whereIn('passenger_id', $passengers)->whereNull('undone_at')->update(['undone_at' => $at, 'undone_by' => $resource->user->getKey(), 'updated_at' => now()]);
            $this->refreshFirstCheckin($assignment);

            return $removed > 0 ? ['result' => 'applied'] : ['result' => 'conflict_resolved', 'conflict_rule' => 'MOB-BR-06', 'message' => 'El pasajero no tenía check-in.'];
        }

        $added = 0;
        $kept = 0;
        foreach ($passengers as $passenger) {
            $existing = $current[$passenger] ?? null;

            if ($existing !== null) {
                $kept++;
                if (CarbonImmutable::parse($existing->checked_at)->greaterThan($at)) {
                    DB::table('ops_assignment_checkins')->where('id', $existing->id)->update(['checked_at' => $at, 'updated_at' => now()]);
                }

                continue;
            }

            DB::table('ops_assignment_checkins')->insert(['assignment_id' => $assignment->id, 'passenger_id' => $passenger, 'checked_at' => $at, 'source' => 'app', 'client_action_id' => $action['client_action_id'], 'device_id' => $action['device_id'], 'created_by' => $resource->user->getKey(), 'updated_by' => $resource->user->getKey()]);
            $added++;
        }

        $this->refreshFirstCheckin($assignment);

        if ($added > 0) {
            $this->log($assignment, 'check_in', null, "{$added} presentes (app)", $at, (bool) ($action['offline'] ?? false));
        }

        return $added === 0
            ? ['result' => 'conflict_resolved', 'conflict_rule' => 'MOB-BR-06', 'message' => 'El check-in ya estaba registrado; se conserva la hora más temprana.']
            : ['result' => 'applied', 'data' => ['added' => $added, 'kept' => $kept]];
    }

    private function evidence(OperatorResource $resource, object $assignment, array $action, CarbonImmutable $at, array $payload): array
    {
        if (! in_array($assignment->status, ['en_curso', 'completada'], true)) {
            throw ApiException::conflict('MOB-BR-10', 'Las evidencias se registran con el servicio iniciado.');
        }

        $sha = Str::lower((string) ($payload['sha256'] ?? ''));
        $existing = $sha === '' ? null : DB::table('ops_evidences')->where('order_id', $assignment->order_id)->where('sha256', $sha)->whereNull('removed_at')->first(['id']);

        if ($existing !== null) {
            return ['result' => 'conflict_resolved', 'conflict_rule' => 'MOB-BR-09', 'message' => 'Ese archivo ya estaba registrado; se asocia la evidencia existente.', 'data' => ['evidence_id' => $existing->id]];
        }

        if (empty($payload['upload_id'])) {
            throw ApiException::unprocessable('OPS-BR-70', 'Suba el archivo antes de registrar la evidencia.');
        }

        $files = $this->evidence->registerForOrder((string) $assignment->order_code, (string) $assignment->reservation_service_id, [['upload_id' => $payload['upload_id'], 'sha256' => $sha ?: null]], 'app_operador', $resource->user);
        $id = (string) $files[0]['id'];
        DB::table('ops_evidences')->where('id', $id)->update(['client_action_id' => $action['client_action_id'], 'captured_at' => $at, 'captured_offline' => (bool) ($action['offline'] ?? false), 'updated_at' => now()]);

        return ['result' => 'applied', 'data' => ['evidence_id' => $id]];
    }

    private function incident(OperatorResource $resource, object $assignment, array $action, CarbonImmutable $at, array $payload): array
    {
        $type = (string) ($payload['type'] ?? '');
        $severity = (string) ($payload['severity'] ?? '');
        $title = trim((string) ($payload['title'] ?? ''));

        if (! in_array($type, IncidentDirectory::TYPES, true) || ! in_array($severity, IncidentDirectory::SEVERITIES, true) || mb_strlen($title) < 3) {
            throw ApiException::unprocessable('OPS-BR-64', 'Indique el tipo, la severidad y un título para la incidencia.');
        }

        $related = DB::table('ops_incidents')->where('order_id', $assignment->order_id)->where('type', $type)->where('source', '<>', 'app_operador')
            ->where('created_at', '>=', $at->subMinutes(10))->orderByDesc('created_at')->value('id');
        $code = $this->sequence->next('ops_incidents', 'INC-', 4);
        $hours = IncidentDirectory::SLA_HOURS[$severity];
        $id = (string) Str::uuid7();
        DB::table('ops_incidents')->insert([
            'id' => $id,
            'code' => $code,
            'order_id' => $assignment->order_id,
            'reservation_id' => $assignment->reservation_id,
            'reservation_service_id' => $assignment->reservation_service_id,
            'type' => $type,
            'severity' => $severity,
            'title' => mb_substr($title, 0, 200),
            'description' => trim((string) ($payload['description'] ?? '')) ?: $title,
            'status' => 'abierta',
            'assignee_id' => $assignment->coordinator_id,
            'reported_by' => $resource->user->getKey(),
            'source' => 'app_operador',
            'sla_hours' => $hours,
            'sla_due_at' => $at->addHours($hours),
            'related_incident_id' => $related,
            'client_action_id' => $action['client_action_id'],
            'created_by' => $resource->user->getKey(),
        ]);
        DB::table('ops_incident_logs')->insert(['incident_id' => $id, 'user_id' => $resource->user->getKey(), 'kind' => 'registro', 'message' => 'Incidencia reportada desde la app del operador'.(($action['offline'] ?? false) ? " (sin conexión, {$at->format('d/m H:i')})" : '').'.', 'visibility' => 'interna', 'created_by' => $resource->user->getKey()]);

        if ($severity === 'critica') {
            DB::table('ops_incident_logs')->insert(['incident_id' => $id, 'user_id' => null, 'kind' => 'alerta', 'message' => 'Alerta crítica enviada a gerencia.', 'visibility' => 'interna']);
        }

        foreach ((array) ($payload['upload_ids'] ?? []) as $upload) {
            $this->evidence->registerForIncident($code, [['upload_id' => $upload]], 'app_operador', $resource->user);
        }

        $this->audit->log('Incidencia', $code, 'crear', null, "{$severity} · {$title}".(($action['offline'] ?? false) ? ' · offline' : ''), actor: $resource->user);
        $this->reservations->syncForIncident($id);
        $this->notices->toOperations($severity === 'critica' ? 'incidencia.critica' : 'incidencia.creada', "{$code} · {$title}", "Reportada por {$resource->row->full_name} en {$assignment->service_label}.", 'ops_incident', $id, (string) $assignment->reservation_id, $assignment->coordinator_id, $severity === 'critica');

        return $related !== null
            ? ['result' => 'conflict_resolved', 'conflict_rule' => 'MOB-BR-11', 'message' => 'Operaciones registró una incidencia parecida hace poco: la suya quedó vinculada para revisión.', 'data' => ['incident' => $code]]
            : ['result' => 'applied', 'data' => ['incident' => $code]];
    }

    private function finish(OperatorResource $resource, object $assignment, CarbonImmutable $at, bool $offline): array
    {
        if ($assignment->status === 'completada') {
            return ['result' => 'conflict_resolved', 'conflict_rule' => 'MOB-BR-08', 'message' => 'El servicio ya figuraba como finalizado.'];
        }

        if ($assignment->status !== 'en_curso') {
            throw ApiException::conflict('MOB-BR-10', 'Solo se finaliza un servicio en curso.');
        }

        $checkins = DB::table('ops_assignment_checkins')->where('assignment_id', $assignment->id)->whereNull('undone_at')->pluck('passenger_id')->map(fn (mixed $id): string => (string) $id);
        $evidences = DB::table('ops_evidences')->where('order_id', $assignment->order_id)->where('reservation_service_id', $assignment->reservation_service_id)->whereNull('removed_at')->count();

        if ($checkins->isEmpty() || $evidences === 0) {
            throw ApiException::unprocessable('OPS-BR-51', 'Para finalizar registre al menos un check-in y una evidencia del servicio.');
        }

        $noShow = DB::table('booking_passengers')->where('reservation_id', $assignment->reservation_id)->whereNotIn('id', $checkins->all())->orderBy('seq')->pluck('full_name');
        DB::table('ops_assignments')->where('id', $assignment->id)->update(['status' => 'completada', 'finished_at' => $at, 'lock_version' => DB::raw('lock_version + 1'), 'updated_by' => $resource->user->getKey(), 'updated_at' => now()]);
        DB::table('booking_reservation_services')->where('id', $assignment->reservation_service_id)->whereIn('status', ['confirmado', 'en_curso'])->update(['status' => 'completado', 'lock_version' => DB::raw('lock_version + 1'), 'updated_at' => now()]);
        $this->log($assignment, 'finalizar', 'en_curso', 'completada'.($noShow->isEmpty() ? '' : ' · no-show: '.$noShow->implode(', ')), $at, $offline);
        $this->notify($assignment, 'asignacion.finalizada', "{$resource->row->full_name} finalizó {$assignment->service_label}", $at, $noShow->isEmpty() ? null : 'No se presentaron: '.$noShow->implode(', ').'.');

        return ['result' => 'applied', 'data' => ['no_show' => $noShow->values()->all()]];
    }

    private function lock(OperatorResource $resource, string $id): object
    {
        if (! Str::isUuid($id)) {
            throw ApiException::notFound('La asignación no existe.');
        }

        $owned = (clone $resource->assignments())->where('a.id', $id)->exists();

        if (! $owned) {
            throw ApiException::conflict('MOB-BR-10', 'Esta asignación ya no es suya: fue liberada o reasignada a otro recurso.');
        }

        DB::table('ops_assignments')->where('id', $id)->lockForUpdate()->value('id');

        return (clone $resource->assignments())->where('a.id', $id)->first([
            'a.id', 'a.status', 'a.started_at', 'a.service_label', 'a.reservation_service_id', 'a.order_id',
            'o.code as order_code', 'o.status as order_status', 'o.coordinator_id', 'r.id as reservation_id', 'r.code as reservation_code',
        ]) ?? throw ApiException::notFound('La asignación no existe.');
    }

    private function device(OperatorResource $resource, string $id): void
    {
        $device = Str::isUuid($id) ? DB::table('ops_mobile_devices')->where('id', $id)->where('user_id', $resource->user->getKey())->where('app', 'operador')->first(['revoked_at', 'updated_by']) : null;

        if ($device !== null && $device->revoked_at !== null && (string) $device->updated_by !== (string) $resource->user->getKey()) {
            throw ApiException::forbidden(self::DEVICE_REVOKED, self::DEVICE_REVOKED_MESSAGE);
        }

        if ($device === null || $device->revoked_at !== null) {
            throw ApiException::forbidden('MOB-BR-01', 'Registre este dispositivo antes de sincronizar.');
        }
    }

    private function safeDetail(OperatorResource $resource, string $id): ?array
    {
        try {
            return $this->directory->detail($resource, $id);
        } catch (ApiException) {
            return null;
        }
    }

    private function coalesceKey(array $action): string
    {
        $payload = (array) ($action['payload'] ?? []);

        return implode(':', array_filter([$action['type'], $action['assignment_id'], $payload['passenger_id'] ?? null]));
    }

    private function refreshFirstCheckin(object $assignment): void
    {
        $first = DB::table('ops_assignment_checkins')->where('assignment_id', $assignment->id)->whereNull('undone_at')->min('checked_at');
        DB::table('ops_assignments')->where('id', $assignment->id)->update(['first_checkin_at' => $first, 'updated_at' => now()]);
    }

    private function recompute(string $orderId): void
    {
        $order = DB::table('ops_orders')->where('id', $orderId)->first(['status', 'reservation_id']);

        if ($order === null || in_array($order->status, ['en_ejecucion', 'completada', 'cancelada'], true)) {
            return;
        }

        $statuses = DB::table('ops_assignments')->where('order_id', $orderId)->pluck('status');
        $next = match (true) {
            $statuses->contains('pendiente') => 'pendiente_asignacion',
            $statuses->every(fn (string $status) => in_array($status, ['confirmada', 'en_curso', 'completada'], true))
                && ! DB::table('booking_reservation_services')->where('reservation_id', $order->reservation_id)->whereIn('status', ['pendiente', 'solicitado'])->exists() => 'confirmada',
            default => 'asignada',
        };

        if ($next !== $order->status) {
            DB::table('ops_orders')->where('id', $orderId)->update(['status' => $next, 'lock_version' => DB::raw('lock_version + 1'), 'updated_at' => now()]);
        }
    }

    private function log(object $assignment, string $action, ?string $before, string $after, CarbonImmutable $at, bool $offline): void
    {
        $this->audit->log('Asignación', "{$assignment->order_code} · {$assignment->service_label}", $action, $before, $after.($offline ? " · offline {$at->toIso8601String()}" : ''));
    }

    private function notify(object $assignment, string $event, string $subject, CarbonImmutable $at, ?string $body = null): void
    {
        if ($assignment->coordinator_id === null) {
            return;
        }

        $this->notices->toUsers(collect([$assignment->coordinator_id]), $event, $subject, $body ?? 'Registrado desde la app del operador el '.$at->format('d/m H:i').'.', 'ops_assignment', (string) $assignment->id, (string) $assignment->reservation_id);
    }
}
