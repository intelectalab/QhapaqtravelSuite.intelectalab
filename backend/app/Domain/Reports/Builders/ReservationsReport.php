<?php

declare(strict_types=1);

namespace App\Domain\Reports\Builders;

use App\Domain\Iam\Models\User;
use App\Domain\Reports\Support\KpiReport;
use App\Domain\Reports\Support\ReportFilters;
use App\Domain\Reports\Support\ReportShape as S;
use Illuminate\Support\Facades\DB;

final class ReservationsReport extends ReportBuilder
{
    private const STATUS = ['borrador' => 'Borrador', 'pendiente_disponibilidad' => 'Pendiente de disponibilidad', 'confirmada' => 'Confirmada', 'pendiente_pago' => 'Pendiente de pago', 'pendiente_proveedor' => 'Pendiente de proveedor', 'reprogramada' => 'Reprogramada', 'parcial' => 'Parcial', 'incidencia' => 'Con incidencia', 'en_operacion' => 'En operación', 'completada' => 'Completada', 'cancelada' => 'Cancelada'];

    public function build(User $viewer, ReportFilters $filters): array
    {
        $rows = $this->reservations($viewer, $filters, false)
            ->leftJoin('crm_clients as c', 'c.id', '=', 'r.client_id')
            ->leftJoin('iam_users as u', 'u.id', '=', 'r.owner_id')
            ->leftJoin('iam_sedes as sd', 'sd.id', '=', 'r.sede_id')
            ->orderByDesc('r.created_at')
            ->get(['r.id', 'r.code', 'r.title', 'r.status', 'r.channel', 'r.travel_from', 'r.travel_to', 'r.created_at', DB::raw("{$this->sales()} as sales"), 'c.name as client', 'u.name as seller', 'sd.name as sede']);
        $sold = $rows->whereIn('status', KpiReport::SOLD);
        $pax = DB::table('booking_passengers')->whereIn('reservation_id', $rows->pluck('id'))->where('is_placeholder', false)->selectRaw('reservation_id, count(*) as total')->groupBy('reservation_id')->pluck('total', 'reservation_id');
        $destinations = DB::table('booking_reservation_services as s')->join('catalog_products as p', 'p.id', '=', 's.product_id')->join('catalog_destinations as d', 'd.id', '=', 'p.primary_destination_id')
            ->whereIn('s.reservation_id', $sold->pluck('id'))->where('s.status', '<>', 'cancelado')->distinct()->get(['s.reservation_id', 'd.name']);
        $places = DB::table('booking_reservation_services as s')->join('catalog_products as p', 'p.id', '=', 's.product_id')->join('catalog_destinations as d', 'd.id', '=', 'p.primary_destination_id')
            ->whereIn('s.reservation_id', $rows->pluck('id'))->where('s.status', '<>', 'cancelado')->distinct()->orderBy('d.name')->get(['s.reservation_id', 'd.name'])
            ->groupBy('reservation_id')->map(fn ($group): string => $group->pluck('name')->unique()->implode(', '));
        $salesById = $sold->pluck('sales', 'id');
        $byDestination = $destinations->groupBy('name')->map(fn ($group, string $name): array => S::point($name, round((float) $group->sum(fn (object $row): float => (float) ($salesById[$row->reservation_id] ?? 0)), 2), ['count' => $group->count()]))->sortByDesc('value')->take(8);
        $salesTotal = (float) $sold->sum('sales');
        $months = $this->reservations($viewer, $filters)->selectRaw($filters->monthExpression('r.created_at')." as m, sum({$this->sales()}) as sales, count(*) as total")->groupBy('m')->get()->keyBy('m');

        return [
            'kpis' => [
                S::kpi('reservations', 'Reservas', $rows->count(), 'number', $rows->where('status', '<>', 'cancelada')->count().' vigentes'),
                S::kpi('pax', 'Pasajeros', (int) $pax->only($sold->pluck('id')->all())->sum()),
                S::kpi('sales', 'Ventas', round($salesTotal, 2), 'money'),
                S::kpi('ticket', 'Ticket promedio', $sold->count() > 0 ? $salesTotal / $sold->count() : null, 'money'),
                S::kpi('cancelled', 'Canceladas', $rows->where('status', 'cancelada')->count(), 'number', S::rate($rows->where('status', 'cancelada')->count(), $rows->count()) !== null ? S::rate($rows->where('status', 'cancelada')->count(), $rows->count()).' % del total' : null),
            ],
            'charts' => [
                S::chart('channels', 'Ventas por canal', 'hbar', $sold->groupBy(fn (object $row): string => (string) ($row->channel ?: 'Sin canal'))->map(fn ($group, string $channel): array => S::point($channel, round((float) $group->sum('sales'), 2), ['count' => $group->count()]))->sortByDesc('value')->all(), 'money'),
                S::chart('destinations', 'Ventas por destino', 'hbar', $byDestination->all(), 'money'),
                S::chart('status', 'Reservas por estado', 'donut', $rows->countBy('status')->map(fn (int $count, string $status): array => S::point(self::STATUS[$status] ?? $status, $count))->all()),
                S::chart('months', 'Ventas por mes', 'bar', collect($filters->months())->map(fn (string $label, string $key): array => S::point($label, round((float) ($months[$key]->sales ?? 0), 2), ['count' => (int) ($months[$key]->total ?? 0)]))->all(), 'money'),
            ],
            'table' => S::table([
                S::column('code', 'Reserva'),
                S::column('client', 'Cliente'),
                S::column('destination', 'Destino'),
                S::column('sede', 'Sede'),
                S::column('seller', 'Vendedor'),
                S::column('channel', 'Canal', 'text', ['filter' => true]),
                S::column('status', 'Estado', 'status', ['filter' => true]),
                S::column('travel_from', 'Viaje desde', 'date'),
                S::column('travel_to', 'Viaje hasta', 'date'),
                S::column('pax', 'Pax', 'number'),
                S::column('sales', 'Total S/', 'money'),
            ], $rows->map(fn (object $row): array => [
                'code' => $row->code,
                'client' => $row->client,
                'destination' => $places[$row->id] ?? null,
                'sede' => $row->sede,
                'seller' => $row->seller,
                'channel' => $row->channel,
                'status' => self::STATUS[$row->status] ?? $row->status,
                'status_key' => $row->status,
                'travel_from' => $row->travel_from,
                'travel_to' => $row->travel_to,
                'pax' => (int) ($pax[$row->id] ?? 0),
                'sales' => $row->status === 'cancelada' ? 0.0 : round((float) $row->sales, 2),
            ])->all(), null, '/reservas/{code}'),
        ];
    }
}
