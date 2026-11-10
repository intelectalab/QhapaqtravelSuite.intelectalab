<?php

declare(strict_types=1);

namespace App\Domain\Operations\Support;

use App\Domain\Iam\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

final class OrderDirectory
{
    public const ACTIVE = ['planificada', 'pendiente_asignacion', 'asignada', 'confirmada', 'en_ejecucion'];

    public const OPEN_INCIDENT = ['abierta', 'en_proceso'];

    public function __construct(private readonly OpsCommon $common, private readonly ResourceDirectory $resources, private readonly EvidenceStore $evidences) {}

    public function list(User $viewer): array
    {
        $today = $this->common->today();
        $tomorrow = $this->common->now()->addDay()->toDateString();
        $orders = DB::table('ops_orders as o')
            ->join('booking_reservations as r', 'r.id', '=', 'o.reservation_id')
            ->join('crm_clients as c', 'c.id', '=', 'r.client_id')
            ->leftJoin('iam_users as u', 'u.id', '=', 'o.coordinator_id')
            ->whereNull('o.deleted_at')
            ->orderBy('o.date_from')
            ->get(['o.id', 'o.code', 'o.lock_version', 'o.title', 'o.status', 'o.date_from', 'o.date_to', 'o.created_at', 'o.cancel_reason', 'r.id as reservation_id', 'r.code as reservation_code', 'r.status as reservation_status', 'c.name as client_name', 'u.id as coordinator_id', 'u.name as coordinator_name', 'u.avatar_color as coordinator_color']);
        $ids = $orders->pluck('id');
        $assignments = DB::table('ops_assignments')->whereIn('order_id', $ids)->get(['order_id', 'status', 'service_date']);
        $tasks = DB::table('ops_order_tasks')->whereIn('order_id', $ids)->whereNull('deleted_at')->get(['order_id', 'done']);
        $incidents = DB::table('ops_incidents')->whereIn('order_id', $ids)->whereIn('status', self::OPEN_INCIDENT)->get(['order_id', 'severity']);
        $passengers = DB::table('booking_passengers')->whereIn('reservation_id', $orders->pluck('reservation_id'))->selectRaw('reservation_id, count(*) as total')->groupBy('reservation_id')->pluck('total', 'reservation_id');
        $active = $orders->whereIn('status', self::ACTIVE)->pluck('id')->all();
        $activeAssignments = $assignments->whereIn('order_id', $active);
        $openIncidents = DB::table('ops_incidents')->whereIn('status', self::OPEN_INCIDENT)->get(['severity']);

        return [
            'today' => $today,
            'can' => ['assign' => $viewer->can('operations.assign'), 'close' => $viewer->can('operations.close')],
            'kpis' => [
                'running' => $orders->where('status', 'en_ejecucion')->count(),
                'pending_assignment' => $activeAssignments->where('status', 'pendiente')->count(),
                'services_today' => $activeAssignments->where('service_date', $today)->count(),
                'services_tomorrow' => $activeAssignments->where('service_date', $tomorrow)->count(),
                'open_incidents' => $openIncidents->count(),
                'critical_incidents' => $openIncidents->where('severity', 'critica')->count(),
            ],
            'items' => $orders->map(function (object $order) use ($assignments, $tasks, $incidents, $passengers): array {
                $own = $assignments->where('order_id', $order->id);
                $ownTasks = $tasks->where('order_id', $order->id);
                $ownIncidents = $incidents->where('order_id', $order->id);

                return [
                    'code' => $order->code,
                    'lock_version' => (int) $order->lock_version,
                    'title' => $order->title,
                    'status' => $order->status,
                    'date_from' => $order->date_from,
                    'date_to' => $order->date_to,
                    'created_at' => $order->created_at,
                    'reservation' => ['code' => $order->reservation_code, 'status' => $order->reservation_status, 'client' => $order->client_name],
                    'coordinator' => ['id' => $order->coordinator_id, 'name' => $order->coordinator_name, 'color' => $order->coordinator_color],
                    'passengers' => (int) ($passengers[$order->reservation_id] ?? 0),
                    'assignments' => ['total' => $own->count(), 'pending' => $own->where('status', 'pendiente')->count(), 'confirmed' => $own->whereIn('status', ['confirmada', 'en_curso', 'completada'])->count()],
                    'tasks' => ['total' => $ownTasks->count(), 'done' => $ownTasks->where('done', true)->count()],
                    'open_incidents' => $ownIncidents->count(),
                    'critical' => $ownIncidents->where('severity', 'critica')->count() > 0,
                ];
            })->values(),
            'candidates' => $viewer->can('operations.assign') ? $this->candidates() : [],
            'coordinators' => $viewer->can('operations.assign') ? $this->common->coordinators() : [],
            'viewer_id' => $viewer->getKey(),
        ];
    }

    public function candidates(): Collection
    {
        return DB::table('booking_reservations as r')
            ->join('crm_clients as c', 'c.id', '=', 'r.client_id')
            ->whereNull('r.deleted_at')
            ->whereIn('r.status', ['confirmada', 'en_operacion'])
            ->whereNotExists(fn ($query) => $query->from('ops_orders as o')->whereColumn('o.reservation_id', 'r.id')->whereNull('o.deleted_at'))
            ->orderBy('r.travel_from')
            ->get(['r.code', 'r.title', 'r.status', 'r.travel_from', 'r.travel_to', 'c.name as client_name'])
            ->map(fn (object $row): array => ['code' => $row->code, 'title' => $row->title, 'status' => $row->status, 'travel_from' => $row->travel_from, 'travel_to' => $row->travel_to, 'client' => $row->client_name])
            ->values();
    }

    public function find(User $viewer, string $code): ?array
    {
        $order = DB::table('ops_orders as o')
            ->join('booking_reservations as r', 'r.id', '=', 'o.reservation_id')
            ->join('crm_clients as c', 'c.id', '=', 'r.client_id')
            ->leftJoin('iam_users as u', 'u.id', '=', 'o.coordinator_id')
            ->whereNull('o.deleted_at')->where('o.code', $code)
            ->first(['o.*', 'r.code as reservation_code', 'r.status as reservation_status', 'r.title as reservation_title', 'r.notes as reservation_notes', 'c.name as client_name', 'u.name as coordinator_name', 'u.avatar_color as coordinator_color']);

        if ($order === null) {
            return null;
        }

        $names = $this->common->userNames();
        $assignments = $this->resources->assignments(['a.order_id' => $order->id]);
        $assigned = $assignments->pluck('service_code')->all();
        $services = DB::table('booking_reservation_services')->where('reservation_id', $order->reservation_id)->orderBy('service_date')->orderBy('service_time')
            ->get(['id', 'code', 'lock_version', 'name', 'service_date', 'service_time', 'service_kind', 'status', 'confirmation_code', 'cost_amount', 'currency']);
        $incidents = DB::table('ops_incidents')->where('order_id', $order->id)->orderByDesc('created_at')->get(['code', 'title', 'type', 'severity', 'status', 'sla_due_at', 'created_at']);
        $evidences = DB::table('ops_evidences')->where('order_id', $order->id)->whereNull('removed_at')->count();
        $passengers = DB::table('booking_passengers')->where('reservation_id', $order->reservation_id)->orderBy('seq')->get(['id', 'full_name', 'pax_type', 'nationality', 'diet_notes', 'is_lead']);
        $canAssign = $viewer->can('operations.assign');

        return [
            'code' => $order->code,
            'lock_version' => (int) $order->lock_version,
            'title' => $order->title,
            'status' => $order->status,
            'date_from' => $order->date_from,
            'date_to' => $order->date_to,
            'created_at' => $order->created_at,
            'closed_at' => $order->closed_at,
            'cancelled_at' => $order->cancelled_at,
            'cancel_reason' => $order->cancel_reason,
            'today' => $this->common->today(),
            'reservation' => ['code' => $order->reservation_code, 'title' => $order->reservation_title, 'status' => $order->reservation_status, 'client' => $order->client_name, 'notes' => $order->reservation_notes],
            'coordinator' => ['id' => $order->coordinator_id, 'name' => $order->coordinator_name, 'color' => $order->coordinator_color],
            'tasks' => DB::table('ops_order_tasks')->where('order_id', $order->id)->whereNull('deleted_at')->orderBy('position')->get(['id', 'title', 'done', 'done_by', 'done_at'])
                ->map(fn (object $task): array => ['id' => $task->id, 'title' => $task->title, 'done' => (bool) $task->done, 'done_at' => $task->done_at, 'done_by' => $task->done_by ? ($names[$task->done_by] ?? null) : null])->values(),
            'assignments' => $assignments,
            'services' => $services->map(fn (object $service): array => [
                'id' => $service->id,
                'code' => $service->code,
                'lock_version' => (int) $service->lock_version,
                'name' => $service->name,
                'date' => $service->service_date,
                'time' => OpsCommon::time($service->service_time),
                'kind' => $service->service_kind,
                'status' => $service->status,
                'confirmation' => $service->confirmation_code,
                'cost' => $service->cost_amount,
                'currency' => $service->currency,
                'assigned' => in_array($service->code, $assigned, true),
            ])->values(),
            'passengers' => $passengers,
            'incidents' => $incidents,
            'evidences' => $evidences,
            'evidence_files' => $this->evidences->forOrder($order->id),
            'evidence_rules' => ['max_bytes' => EvidenceStore::MAX_BYTES, 'mimes' => array_keys(EvidenceStore::MIME)],
            'checks' => $this->checks($order->id, $order->reservation_id),
            'transitions' => $canAssign ? OrderFlow::targets($order->status) : [],
            'can' => ['assign' => $canAssign, 'close' => $viewer->can('operations.close'), 'incidents' => $viewer->can('operations.incidents')],
            'coordinators' => $canAssign ? $this->common->coordinators() : [],
            'options' => $canAssign ? $this->resources->options() : null,
        ];
    }

    public function checks(string $orderId, string $reservationId): array
    {
        $services = DB::table('booking_reservation_services')->where('reservation_id', $reservationId)->where('status', '<>', 'cancelado')->where('service_kind', '<>', 'libre')->get(['status', 'cost_amount']);
        $incidents = DB::table('ops_incidents')->where('order_id', $orderId)->get(['id', 'status', 'severity']);
        $withEvidence = DB::table('ops_evidences')->whereIn('incident_id', $incidents->pluck('id'))->whereNull('removed_at')->pluck('incident_id')->unique();
        $orderEvidence = DB::table('ops_evidences')->where('order_id', $orderId)->whereNull('removed_at')->count();
        $serious = $incidents->whereIn('severity', ['alta', 'critica'])->reject(fn (object $incident) => $withEvidence->contains($incident->id));

        return [
            ['id' => 'services', 'label' => 'Servicios completados', 'ok' => $services->every(fn (object $service) => $service->status === 'completado'), 'detail' => $services->where('status', 'completado')->count().' de '.$services->count()],
            ['id' => 'incidents', 'label' => 'Incidencias gestionadas', 'ok' => $incidents->whereIn('status', self::OPEN_INCIDENT)->isEmpty(), 'detail' => $incidents->whereIn('status', self::OPEN_INCIDENT)->count().' abiertas'],
            ['id' => 'evidence', 'label' => 'Evidencias registradas', 'ok' => $orderEvidence > 0 && $serious->isEmpty(), 'detail' => $serious->isNotEmpty() ? $serious->count().' incidencias graves sin evidencia' : $orderEvidence.' evidencias'],
            ['id' => 'costs', 'label' => 'Costos de proveedor cargados', 'ok' => $services->every(fn (object $service) => (float) $service->cost_amount > 0), 'detail' => $services->filter(fn (object $service) => (float) $service->cost_amount <= 0)->count().' sin costo'],
        ];
    }
}
