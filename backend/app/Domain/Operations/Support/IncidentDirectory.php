<?php

declare(strict_types=1);

namespace App\Domain\Operations\Support;

use App\Domain\Iam\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\DB;

final class IncidentDirectory
{
    public const TYPES = ['Transporte', 'Proveedor', 'Salud del pasajero', 'Horario', 'Clima', 'Documentación', 'Equipaje', 'Seguridad', 'Capacidad', 'Pasajero', 'Otro'];

    public const SEVERITIES = ['baja', 'media', 'alta', 'critica'];

    public const SLA_HOURS = ['critica' => 4, 'alta' => 8, 'media' => 24, 'baja' => 72];

    public const OPEN = ['abierta', 'en_proceso'];

    public function __construct(private readonly OpsCommon $common) {}

    public function list(User $viewer): array
    {
        $now = CarbonImmutable::now();
        $rows = $this->query()->orderByRaw("case when i.status in ('abierta','en_proceso') then 0 else 1 end")->orderBy('i.sla_due_at')->get();
        $evidences = DB::table('ops_evidences')->whereIn('incident_id', $rows->pluck('id'))->whereNull('removed_at')->selectRaw('incident_id, count(*) as total')->groupBy('incident_id')->pluck('total', 'incident_id');
        $items = $rows->map(fn (object $row): array => [...$this->summary($row, $now), 'evidences' => (int) ($evidences[$row->id] ?? 0)])->values();
        $canManage = $viewer->can('operations.incidents');

        return [
            'now' => $now->toIso8601String(),
            'can' => ['manage' => $canManage],
            'kpis' => [
                'open' => $items->whereIn('status', self::OPEN)->count(),
                'critical' => $items->whereIn('status', self::OPEN)->where('severity', 'critica')->count(),
                'in_process' => $items->where('status', 'en_proceso')->count(),
                'overdue' => $items->where('overdue', true)->count(),
            ],
            'items' => $items,
            'types' => self::TYPES,
            'orders' => $canManage ? $this->orders() : [],
            'assignees' => $canManage ? $this->common->coordinators() : [],
        ];
    }

    public function find(User $viewer, string $code): ?array
    {
        $row = $this->query()->where('i.code', $code)->first();

        if ($row === null) {
            return null;
        }

        $names = $this->common->userNames();
        $canManage = $viewer->can('operations.incidents');

        return [
            ...$this->summary($row, CarbonImmutable::now()),
            'description' => $row->description,
            'resolution' => $row->resolution,
            'resolved_at' => $row->resolved_at,
            'closed_at' => $row->closed_at,
            'assignee_id' => $row->assignee_id,
            'logs' => DB::table('ops_incident_logs')->where('incident_id', $row->id)->orderBy('created_at')->get(['id', 'user_id', 'kind', 'message', 'visibility', 'created_at'])
                ->map(fn (object $log): array => ['id' => $log->id, 'user' => $log->user_id ? ($names[$log->user_id] ?? 'Usuario') : 'Sistema', 'kind' => $log->kind, 'message' => $log->message, 'at' => $log->created_at])->values(),
            'evidence_files' => DB::table('ops_evidences')->where('incident_id', $row->id)->whereNull('removed_at')->orderBy('captured_at')->get(['id', 'file_name', 'mime_type', 'size_bytes', 'source', 'captured_at', 'uploaded_by'])
                ->map(fn (object $file): array => ['id' => $file->id, 'name' => $file->file_name, 'mime' => $file->mime_type, 'size' => (int) $file->size_bytes, 'source' => $file->source, 'at' => $file->captured_at, 'by' => $names[$file->uploaded_by] ?? null])->values(),
            'can' => ['manage' => $canManage],
            'types' => self::TYPES,
            'assignees' => $canManage ? $this->common->coordinators() : [],
        ];
    }

    public function orders(): array
    {
        return DB::table('ops_orders')->whereNull('deleted_at')->whereNotIn('status', ['cancelada'])->orderByDesc('date_from')->get(['code', 'title', 'status'])
            ->map(fn (object $order): array => ['value' => $order->code, 'label' => "{$order->code} · {$order->title}", 'hint' => $order->status])->all();
    }

    private function query(): Builder
    {
        return DB::table('ops_incidents as i')
            ->leftJoin('ops_orders as o', 'o.id', '=', 'i.order_id')
            ->leftJoin('booking_reservations as r', 'r.id', '=', 'i.reservation_id')
            ->leftJoin('iam_users as a', 'a.id', '=', 'i.assignee_id')
            ->leftJoin('iam_users as rep', 'rep.id', '=', 'i.reported_by')
            ->select(['i.*', 'o.code as order_code', 'o.title as order_title', 'r.code as reservation_code', 'r.title as reservation_title', 'a.name as assignee_name', 'a.avatar_color as assignee_color', 'rep.name as reporter_name']);
    }

    private function summary(object $row, CarbonImmutable $now): array
    {
        $created = CarbonImmutable::parse($row->created_at);
        $due = CarbonImmutable::parse($row->sla_due_at);
        $open = in_array($row->status, self::OPEN, true);
        $total = max(1, $created->diffInMinutes($due));
        $end = $open ? $now : CarbonImmutable::parse($row->resolved_at ?? $row->closed_at ?? $row->updated_at);

        return [
            'code' => $row->code,
            'lock_version' => (int) $row->lock_version,
            'title' => $row->title,
            'type' => $row->type,
            'severity' => $row->severity,
            'status' => $row->status,
            'source' => $row->source,
            'order' => $row->order_code ? ['code' => $row->order_code, 'title' => $row->order_title] : null,
            'reservation' => $row->reservation_code ? ['code' => $row->reservation_code, 'title' => $row->reservation_title] : null,
            'assignee' => $row->assignee_name ? ['name' => $row->assignee_name, 'color' => $row->assignee_color] : null,
            'reporter' => $row->reporter_name,
            'created_at' => $row->created_at,
            'sla_hours' => (int) $row->sla_hours,
            'sla_due_at' => $row->sla_due_at,
            'sla_pct' => (int) min(100, max(0, round($created->diffInMinutes($end) / $total * 100))),
            'overdue' => $open && $due->lessThan($now),
        ];
    }
}
