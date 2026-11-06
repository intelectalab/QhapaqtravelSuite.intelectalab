<?php

declare(strict_types=1);

namespace App\Domain\Operations\Support;

use App\Domain\Iam\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

final class CalendarDirectory
{
    public function __construct(private readonly OpsCommon $common) {}

    public function month(User $viewer, ?string $month): array
    {
        $today = $this->common->today();
        $start = CarbonImmutable::parse(($month ?? substr($today, 0, 7)).'-01');
        $end = $start->endOfMonth();
        $horizon = CarbonImmutable::parse($today)->addDays(13)->toDateString();
        $from = min($start->toDateString(), $today);
        $to = max($end->toDateString(), $horizon);

        $rows = DB::table('booking_reservation_services as s')
            ->join('booking_reservations as r', 'r.id', '=', 's.reservation_id')
            ->leftJoin('ops_orders as o', fn ($join) => $join->on('o.reservation_id', '=', 'r.id')->whereNull('o.deleted_at')->where('o.status', '<>', 'cancelada'))
            ->leftJoin('ops_assignments as a', fn ($join) => $join->on('a.reservation_service_id', '=', 's.id')->on('a.order_id', '=', 'o.id'))
            ->leftJoin('ops_guides as g', 'g.id', '=', 'a.guide_id')
            ->leftJoin('ops_drivers as d', 'd.id', '=', 'a.driver_id')
            ->leftJoin('ops_vehicles as v', 'v.id', '=', 'a.vehicle_id')
            ->leftJoin('catalog_providers as p', 'p.id', '=', 's.provider_id')
            ->whereNull('r.deleted_at')
            ->whereNotIn('r.status', ['cancelada', 'borrador'])
            ->where('s.status', '<>', 'cancelado')
            ->whereBetween('s.service_date', [$from, $to])
            ->orderBy('s.service_date')->orderBy('s.service_time')
            ->get([
                's.code', 's.name', 's.service_date', 's.service_time', 's.service_kind', 's.status', 's.confirmation_code', 'p.name as provider_name',
                'r.code as reservation_code', 'r.title as reservation_title', 'r.status as reservation_status',
                'o.code as order_code', 'o.status as order_status', 'a.status as assignment_status', 'g.full_name as guide_name', 'd.full_name as driver_name', 'v.plate as vehicle_plate',
            ]);

        $events = $rows->map(function (object $row): array {
            $needsResources = in_array($row->service_kind, ['tour', 'traslado'], true);
            $pendingSupplier = in_array($row->status, ['pendiente', 'solicitado'], true);
            $pendingResources = $needsResources && $row->order_code !== null && in_array($row->assignment_status, [null, 'pendiente'], true);

            return [
                'code' => $row->code,
                'name' => $row->name,
                'date' => $row->service_date,
                'time' => OpsCommon::time($row->service_time),
                'kind' => $row->service_kind,
                'status' => $row->status,
                'confirmation' => $row->confirmation_code,
                'provider' => $row->provider_name,
                'reservation' => ['code' => $row->reservation_code, 'title' => $row->reservation_title, 'status' => $row->reservation_status],
                'order' => $row->order_code ? ['code' => $row->order_code, 'status' => $row->order_status] : null,
                'assignment' => $row->assignment_status,
                'resources' => array_values(array_filter([$row->guide_name, $row->driver_name, $row->vehicle_plate])),
                'pending' => $pendingSupplier || $pendingResources || ($needsResources && $row->order_code === null),
                'pending_reason' => match (true) {
                    $pendingSupplier => 'Falta confirmación del proveedor',
                    $needsResources && $row->order_code === null => 'La reserva aún no tiene orden operativa',
                    $pendingResources => 'Sin guía, conductor ni vehículo',
                    default => null,
                },
            ];
        })->values();

        $inMonth = $events->filter(fn (array $event) => $event['date'] >= $start->toDateString() && $event['date'] <= $end->toDateString());

        return [
            'today' => $today,
            'month' => $start->format('Y-m'),
            'previous' => $start->subMonth()->format('Y-m'),
            'next' => $start->addMonth()->format('Y-m'),
            'can' => ['assign' => $viewer->can('operations.assign')],
            'kpis' => [
                'services' => $inMonth->count(),
                'pending' => $inMonth->where('pending', true)->count(),
                'reservations' => $inMonth->pluck('reservation.code')->unique()->count(),
                'busy_days' => $inMonth->pluck('date')->unique()->count(),
            ],
            'events' => $events,
        ];
    }
}
