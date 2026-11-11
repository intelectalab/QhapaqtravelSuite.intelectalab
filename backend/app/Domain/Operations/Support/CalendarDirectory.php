<?php

declare(strict_types=1);

namespace App\Domain\Operations\Support;

use App\Domain\Iam\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

final class CalendarDirectory
{
    public function __construct(private readonly OpsCommon $common, private readonly ResourceDirectory $resources) {}

    public function month(User $viewer, ?string $month): array
    {
        $today = $this->common->today();
        $start = CarbonImmutable::parse(($month ?? substr($today, 0, 7)).'-01');
        $end = $start->endOfMonth();
        $horizon = CarbonImmutable::parse($today)->addDays(13)->toDateString();
        $from = min($start->subDays(6)->toDateString(), $today);
        $to = max($end->addDays(6)->toDateString(), $horizon);
        $canAssign = $viewer->can('operations.assign');

        $events = $this->services($from, $to)->concat($this->departures($from, $to))
            ->sortBy(fn (array $event) => $event['date'].($event['time'] ?? '99:99'))
            ->values();

        $inMonth = $events->filter(fn (array $event) => $event['date'] >= $start->toDateString() && $event['date'] <= $end->toDateString());

        return [
            'today' => $today,
            'month' => $start->format('Y-m'),
            'previous' => $start->subMonth()->format('Y-m'),
            'next' => $start->addMonth()->format('Y-m'),
            'can' => ['assign' => $canAssign, 'departures' => $viewer->can('catalog.products.view')],
            'kpis' => [
                'services' => $inMonth->where('source', 'service')->count(),
                'departures' => $inMonth->where('source', 'departure')->count(),
                'pending' => $inMonth->where('pending', true)->count(),
                'today' => $events->where('date', $today)->count(),
            ],
            'events' => $events,
            'options' => $canAssign ? $this->resources->options() : null,
        ];
    }

    private function services(string $from, string $to): Collection
    {
        $rows = DB::table('booking_reservation_services as s')
            ->join('booking_reservations as r', 'r.id', '=', 's.reservation_id')
            ->leftJoin('crm_clients as c', 'c.id', '=', 'r.client_id')
            ->leftJoin('ops_orders as o', fn ($join) => $join->on('o.reservation_id', '=', 'r.id')->whereNull('o.deleted_at')->where('o.status', '<>', 'cancelada'))
            ->leftJoin('ops_assignments as a', fn ($join) => $join->on('a.reservation_service_id', '=', 's.id')->on('a.order_id', '=', 'o.id'))
            ->leftJoin('catalog_providers as p', 'p.id', '=', 's.provider_id')
            ->whereNull('r.deleted_at')
            ->whereNotIn('r.status', ['cancelada', 'borrador'])
            ->where('s.status', '<>', 'cancelado')
            ->whereBetween('s.service_date', [$from, $to])
            ->get([
                's.code', 's.name', 's.service_date', 's.service_time', 's.service_kind', 's.status', 's.confirmation_code', 'p.ref as provider_code', 'p.name as provider_name',
                'r.id as reservation_id', 'r.code as reservation_code', 'r.title as reservation_title', 'r.status as reservation_status', 'c.code as client_code', 'c.name as client_name',
                'o.code as order_code', 'o.status as order_status', 'a.id as assignment_id',
            ]);

        $assignments = $this->resources->assignments([], [$from, $to])->keyBy('id');
        $passengers = DB::table('booking_passengers')->whereIn('reservation_id', $rows->pluck('reservation_id')->unique())->selectRaw('reservation_id, count(*) as total')->groupBy('reservation_id')->pluck('total', 'reservation_id');

        return $rows->map(function (object $row) use ($assignments, $passengers): array {
            $assignment = $row->assignment_id ? $assignments->get($row->assignment_id) : null;
            $needsResources = in_array($row->service_kind, ['tour', 'traslado'], true);
            $pendingSupplier = in_array($row->status, ['pendiente', 'solicitado'], true);
            $pendingResources = $needsResources && $row->order_code !== null && in_array($assignment['status'] ?? null, [null, 'pendiente'], true);

            return [
                'id' => $row->code,
                'source' => 'service',
                'code' => $row->code,
                'name' => $row->name,
                'date' => $row->service_date,
                'time' => OpsCommon::time($row->service_time),
                'kind' => $row->service_kind,
                'status' => $row->status,
                'confirmation' => $row->confirmation_code,
                'provider' => $row->provider_name ? ['code' => $row->provider_code, 'name' => $row->provider_name] : null,
                'reservation' => ['code' => $row->reservation_code, 'title' => $row->reservation_title, 'status' => $row->reservation_status],
                'client' => $row->client_name ? ['code' => $row->client_code, 'name' => $row->client_name] : null,
                'passengers' => (int) ($passengers[$row->reservation_id] ?? 0),
                'order' => $row->order_code ? ['code' => $row->order_code, 'status' => $row->order_status] : null,
                'assignment' => $assignment,
                'departure' => null,
                'resources' => array_values(array_filter([$assignment['guide']['name'] ?? null, $assignment['driver']['name'] ?? null, isset($assignment['vehicle']) ? explode(' · ', $assignment['vehicle']['name'])[0] : null])),
                'pending' => $pendingSupplier || $pendingResources || ($needsResources && $row->order_code === null),
                'pending_reason' => match (true) {
                    $pendingSupplier => 'Falta confirmación del proveedor',
                    $needsResources && $row->order_code === null => 'La reserva aún no tiene orden operativa',
                    $pendingResources => 'Sin guía, conductor ni vehículo',
                    default => null,
                },
            ];
        });
    }

    private function departures(string $from, string $to): Collection
    {
        return DB::table('catalog_product_departures as d')
            ->join('catalog_products as p', 'p.id', '=', 'd.product_id')
            ->leftJoin('ops_guides as g', 'g.id', '=', 'd.guide_id')
            ->leftJoin('ops_vehicles as v', 'v.id', '=', 'd.vehicle_id')
            ->leftJoin('catalog_providers as pr', 'pr.id', '=', 'd.provider_id')
            ->whereNull('p.deleted_at')
            ->where('d.status', '<>', 'cancelada')
            ->whereBetween('d.departure_date', [$from, $to])
            ->get([
                'd.id', 'd.ref', 'd.departure_date', 'd.departure_time', 'd.capacity', 'd.sold', 'd.status', 'd.meeting_point', 'd.return_point', 'd.notes',
                'p.code as product_code', 'p.name as product_name', 'g.full_name as guide_name', 'v.plate as vehicle_plate', 'v.vehicle_type', 'pr.ref as provider_code', 'pr.name as provider_name',
            ])
            ->map(function (object $row): array {
                $missing = array_values(array_filter([$row->guide_name === null ? 'guía' : null, $row->vehicle_plate === null ? 'vehículo' : null]));

                return [
                    'id' => 'dep-'.$row->id,
                    'source' => 'departure',
                    'code' => $row->ref,
                    'name' => "Salida {$row->product_name}",
                    'date' => $row->departure_date,
                    'time' => OpsCommon::time($row->departure_time),
                    'kind' => 'salida',
                    'status' => $row->status,
                    'confirmation' => null,
                    'provider' => $row->provider_name ? ['code' => $row->provider_code, 'name' => $row->provider_name] : null,
                    'reservation' => null,
                    'client' => null,
                    'passengers' => (int) $row->sold,
                    'order' => null,
                    'assignment' => null,
                    'departure' => [
                        'ref' => $row->ref,
                        'product' => ['code' => $row->product_code, 'name' => $row->product_name],
                        'capacity' => (int) $row->capacity,
                        'sold' => (int) $row->sold,
                        'guide' => $row->guide_name,
                        'vehicle' => $row->vehicle_plate ? "{$row->vehicle_plate} · {$row->vehicle_type}" : null,
                        'meeting_point' => $row->meeting_point,
                        'return_point' => $row->return_point,
                        'notes' => $row->notes,
                    ],
                    'resources' => array_values(array_filter([$row->guide_name, $row->vehicle_plate])),
                    'pending' => $missing !== [],
                    'pending_reason' => $missing === [] ? null : 'Sin '.implode(' ni ', $missing),
                ];
            });
    }
}
