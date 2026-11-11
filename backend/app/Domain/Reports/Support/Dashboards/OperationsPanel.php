<?php

declare(strict_types=1);

namespace App\Domain\Reports\Support\Dashboards;

use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

final class OperationsPanel
{
    private const UNCONFIRMED = ['solicitado', 'pendiente', 'rechazado'];

    public function __construct(private readonly PanelData $data) {}

    public function build(): array
    {
        $today = $this->data->today();
        $tomorrow = $this->data->now()->addDay()->toDateString();
        $week = $this->data->now()->addDays(7)->toDateString();
        $upcoming = $this->data->services($today, '9999-12-31', null, true);
        $soon = $upcoming->filter(fn (object $row): bool => (string) $row->service_date <= $tomorrow)->values();
        $unconfirmed = $upcoming->filter(fn (object $row): bool => in_array($row->status, self::UNCONFIRMED, true));
        $assignments = $this->pendingAssignments($today);
        $vouchers = $this->vouchersToIssue($upcoming);
        $incidents = $this->data->openIncidents();
        $soonAssignments = $this->assignmentsFor($soon->pluck('id'));
        $orders = $this->ordersFor($soon->pluck('reservation'));

        return [
            'today' => $today,
            'kpis' => [
                'soon' => ['services' => $soon->count(), 'pax' => (int) $soon->sum('pax')],
                'unconfirmed' => ['services' => $unconfirmed->count(), 'providers' => $unconfirmed->pluck('provider')->unique()->count()],
                'assignments' => ['pending' => $assignments->count(), 'within3' => $assignments->filter(fn (array $row): bool => (string) $row['date'] <= $this->data->now()->addDays(3)->toDateString())->count()],
                'vouchers' => ['to_issue' => $vouchers->count()],
                'incidents' => ['open' => $incidents->count(), 'by_severity' => collect(PanelData::SEVERITY)->map(fn (string $level): array => ['severity' => $level, 'count' => $incidents->where('severity', $level)->count()])->filter(fn (array $row): bool => $row['count'] > 0)->values()],
            ],
            'critical' => $this->data->critical($incidents),
            'soon' => $soon->map(fn (object $row): array => [
                ...$this->data->serviceRow($row),
                'confirmation' => $row->confirmation_code,
                'order' => $orders[$row->reservation] ?? null,
                'assignment' => $soonAssignments[$row->id] ?? null,
            ])->values(),
            'unconfirmed' => $unconfirmed->groupBy(fn (object $row): string => (string) ($row->provider ?? 'Sin proveedor'))->map(fn ($group, $provider): array => [
                'provider' => $provider,
                'items' => $group->take(4)->map(fn ($row): array => ['reservation' => $row->reservation, 'date' => $row->service_date, 'name' => $row->name, 'status' => $row->status])->values(),
                'total' => $group->count(),
            ])->values(),
            'assignments' => $assignments->take(6)->values(),
            'vouchers' => $vouchers->take(6)->map(fn (object $row): array => $this->data->serviceRow($row))->values(),
            'incidents' => $incidents->take(6)->values(),
            'arrivals' => $this->arrivals($today, $week),
            'departures' => $this->data->departures(),
        ];
    }

    private function pendingAssignments(string $today): Collection
    {
        return DB::table('ops_assignments as a')->join('ops_orders as o', 'o.id', '=', 'a.order_id')->whereNull('o.deleted_at')
            ->whereNotIn('o.status', ['completada', 'cancelada'])->where('a.status', 'pendiente')->where('a.service_date', '>=', $today)
            ->orderBy('a.service_date')->orderBy('a.service_time')
            ->get(['a.service_date', 'a.service_time', 'a.service_label', 'a.guide_id', 'a.driver_id', 'a.vehicle_id', 'o.code as order'])
            ->map(fn (object $row): array => [
                'date' => $row->service_date,
                'time' => $row->service_time === null ? null : substr((string) $row->service_time, 0, 5),
                'service' => $row->service_label,
                'order' => $row->order,
                'missing' => array_values(array_filter([$row->guide_id === null ? 'guía' : null, $row->driver_id === null ? 'conductor' : null, $row->vehicle_id === null ? 'vehículo' : null])),
            ]);
    }

    private function vouchersToIssue(Collection $upcoming): Collection
    {
        $confirmed = $upcoming->where('status', 'confirmado');
        $issued = DB::table('ops_vouchers')->whereIn('reservation_service_id', $confirmed->pluck('id'))->where('status', '<>', 'anulado')->pluck('reservation_service_id')->flip();

        return $confirmed->reject(fn (object $row): bool => $issued->has($row->id))->values();
    }

    private function assignmentsFor(Collection $serviceIds): array
    {
        return DB::table('ops_assignments as a')->leftJoin('ops_guides as g', 'g.id', '=', 'a.guide_id')->leftJoin('ops_drivers as d', 'd.id', '=', 'a.driver_id')->leftJoin('ops_vehicles as v', 'v.id', '=', 'a.vehicle_id')
            ->whereIn('a.reservation_service_id', $serviceIds)->get(['a.reservation_service_id', 'a.status', 'g.full_name as guide', 'd.full_name as driver', 'v.plate'])
            ->mapWithKeys(fn (object $row): array => [(string) $row->reservation_service_id => ['status' => $row->status, 'guide' => $row->guide, 'driver' => $row->driver, 'vehicle' => $row->plate]])->all();
    }

    private function ordersFor(Collection $reservations): array
    {
        return DB::table('ops_orders as o')->join('booking_reservations as r', 'r.id', '=', 'o.reservation_id')->whereNull('o.deleted_at')->where('o.status', '<>', 'cancelada')
            ->whereIn('r.code', $reservations->unique())->pluck('o.code', 'r.code')->all();
    }

    private function arrivals(string $today, string $week): array
    {
        $lists = DB::table('ops_rooming_lists as l')->join('booking_reservations as r', 'r.id', '=', 'l.reservation_id')->leftJoin('catalog_providers as p', 'p.id', '=', 'l.hotel_provider_id')
            ->whereNull('l.deleted_at')->whereBetween('l.check_in', [$today, $week])->orderBy('l.check_in')
            ->get(['l.id', 'l.check_in', 'l.check_out', 'l.status', 'l.hotel_name', 'l.hotel_confirmed_at', 'p.name as provider', 'r.code as reservation']);
        $rooms = DB::table('ops_rooming_rooms')->whereIn('rooming_list_id', $lists->pluck('id'))->selectRaw('rooming_list_id, count(*) as total')->groupBy('rooming_list_id')->pluck('total', 'rooming_list_id');

        return $lists->map(fn (object $row): array => [
            'hotel' => $row->provider ?? $row->hotel_name,
            'check_in' => $row->check_in,
            'check_out' => $row->check_out,
            'rooms' => (int) ($rooms[$row->id] ?? 0),
            'reservation' => $row->reservation,
            'status' => $row->hotel_confirmed_at !== null ? 'confirmada' : $row->status,
        ])->all();
    }
}
