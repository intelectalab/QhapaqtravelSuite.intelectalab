<?php

declare(strict_types=1);

namespace App\Domain\Reports\Builders;

use App\Domain\Admin\Support\TenantSettings;
use App\Domain\Iam\Models\User;
use App\Domain\Reports\Support\ReportFilters;
use App\Domain\Reports\Support\ReportShape as S;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

final class OperationsReport extends ReportBuilder
{
    private const SERVICE = ['pendiente' => 'Pendiente', 'solicitado' => 'Solicitado', 'confirmado' => 'Confirmado', 'rechazado' => 'Rechazado', 'en_curso' => 'En curso', 'completado' => 'Completado', 'cancelado' => 'Cancelado'];

    private const ORDER = ['planificada' => 'Planificada', 'pendiente_asignacion' => 'Pendiente de asignación', 'asignada' => 'Asignada', 'confirmada' => 'Confirmada', 'en_ejecucion' => 'En ejecución', 'completada' => 'Completada', 'cancelada' => 'Cancelada'];

    private const SEVERITY = ['baja' => 'Baja', 'media' => 'Media', 'alta' => 'Alta', 'critica' => 'Crítica'];

    public function __construct(private readonly TenantSettings $settings) {}

    public function build(User $viewer, ReportFilters $filters): array
    {
        $from = $filters->from->toDateString();
        $to = $filters->to->toDateString();
        $scoped = fn (Builder $query, string $column): Builder => $filters->sede($query->join('booking_reservations as r', 'r.id', '=', $column)->whereNull('r.deleted_at'), 'r.sede_id');
        $services = $scoped(DB::table('booking_reservation_services as s'), 's.reservation_id')->whereBetween('s.service_date', [$from, $to])->where('s.status', '<>', 'cancelado')->get(['s.status']);
        $pending = $scoped(DB::table('ops_supplier_requests as q')->join('booking_reservation_services as s', 's.id', '=', 'q.reservation_service_id'), 's.reservation_id')->whereNull('q.deleted_at')->where('q.status', 'solicitado')->count();
        $incidents = $filters->between($scoped(DB::table('ops_incidents as i'), 'i.reservation_id'), 'i.created_at')->get(['i.severity', 'i.type', 'i.status', 'i.order_id']);
        $tolerance = (int) ($this->settings->section('operations')['checkin_tolerance_min'] ?? 15);
        $assignments = $scoped(DB::table('ops_assignments as a')->join('ops_orders as o', 'o.id', '=', 'a.order_id'), 'o.reservation_id')->whereBetween('a.service_date', [$from, $to])->whereNotNull('a.first_checkin_at')->whereNotNull('a.service_time')->get(['a.service_date', 'a.service_time', 'a.first_checkin_at']);
        $onTime = $assignments->filter(fn (object $row): bool => Carbon::parse($row->first_checkin_at)->lessThanOrEqualTo(Carbon::parse("{$row->service_date} {$row->service_time}", $filters->timezone)->addMinutes($tolerance)))->count();
        $orders = $scoped(DB::table('ops_orders as o'), 'o.reservation_id')->whereNull('o.deleted_at')->where('o.date_from', '<=', $to)->where('o.date_to', '>=', $from)
            ->leftJoin('iam_users as u', 'u.id', '=', 'o.coordinator_id')->orderBy('o.date_from')
            ->get(['o.id', 'o.code', 'o.title', 'o.status', 'o.date_from', 'o.date_to', 'r.code as reservation', 'u.name as coordinator']);
        $tasks = DB::table('ops_order_tasks')->whereIn('order_id', $orders->pluck('id'))->whereNull('deleted_at')->selectRaw('order_id, count(*) as total, sum(case when done then 1 else 0 end) as done')->groupBy('order_id')->get()->keyBy('order_id');
        $counts = DB::table('ops_assignments')->whereIn('order_id', $orders->pluck('id'))->selectRaw('order_id, count(*) as total')->groupBy('order_id')->pluck('total', 'order_id');
        $openTasks = (int) $tasks->sum(fn (object $row): int => (int) $row->total - (int) $row->done);
        $confirmed = $services->whereIn('status', ['confirmado', 'en_curso', 'completado'])->count();

        return [
            'kpis' => [
                S::kpi('services', 'Servicios programados', $services->count(), 'number', S::rate($confirmed, $services->count()) !== null ? S::rate($confirmed, $services->count()).' % confirmados' : null),
                S::kpi('pending', 'Pendientes de proveedor', $pending),
                S::kpi('incidents', 'Incidencias', $incidents->count(), 'number', $incidents->whereIn('status', ['abierta', 'en_proceso'])->count().' abiertas'),
                S::kpi('punctuality', 'Puntualidad de check-in', S::rate($onTime, $assignments->count()), 'percent', "Tolerancia de {$tolerance} min"),
                S::kpi('tasks', 'Tareas pendientes', $openTasks),
            ],
            'charts' => [
                S::chart('services', 'Servicios por estado', 'donut', $services->countBy('status')->map(fn (int $count, string $status): array => S::point(self::SERVICE[$status] ?? $status, $count))->all()),
                S::chart('severity', 'Incidencias por severidad', 'bar', collect(self::SEVERITY)->map(fn (string $label, string $key): array => S::point($label, $incidents->where('severity', $key)->count()))->all()),
                S::chart('types', 'Incidencias por tipo', 'hbar', $incidents->countBy('type')->sortDesc()->map(fn (int $count, string $type): array => S::point($type, $count))->all()),
            ],
            'table' => S::table([
                S::column('code', 'Orden'),
                S::column('reservation', 'Reserva'),
                S::column('title', 'Servicio'),
                S::column('status', 'Estado', 'status'),
                S::column('coordinator', 'Coordinador'),
                S::column('date_from', 'Desde', 'date'),
                S::column('assignments', 'Asignaciones', 'number'),
                S::column('incidents', 'Incidencias', 'number'),
                S::column('tasks', 'Tareas'),
            ], $orders->map(fn (object $row): array => [
                'code' => $row->code,
                'reservation' => $row->reservation,
                'title' => $row->title,
                'status' => self::ORDER[$row->status] ?? $row->status,
                'status_key' => $row->status,
                'coordinator' => $row->coordinator,
                'date_from' => $row->date_from,
                'assignments' => (int) ($counts[$row->id] ?? 0),
                'incidents' => $incidents->where('order_id', $row->id)->count(),
                'tasks' => isset($tasks[$row->id]) ? "{$tasks[$row->id]->done}/{$tasks[$row->id]->total}" : '—',
            ])->all(), null, '/operaciones/ordenes/{code}'),
        ];
    }
}
