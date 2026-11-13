<?php

declare(strict_types=1);

namespace App\Domain\Mobile\Support;

use App\Domain\Channels\Support\ChannelKit;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

final class OperatorAppPreview
{
    public const FIELD_KINDS = ['tour', 'traslado', 'tren_entrada'];

    public function __construct(private readonly ChannelKit $kit) {}

    public function show(?string $date, ?string $staff): array
    {
        $today = $this->kit->today();
        $staffList = $this->staff();
        $selectedStaff = $staffList->firstWhere('code', $staff);
        $days = $this->base($selectedStaff)
            ->whereBetween('s.service_date', [Carbon::parse($today)->subDays(7)->toDateString(), Carbon::parse($today)->addDays(21)->toDateString()])
            ->selectRaw('s.service_date as day, count(*) as total')
            ->groupBy('s.service_date')
            ->orderBy('s.service_date')
            ->get();
        $day = $date && $days->contains('day', $date) ? $date : ($days->firstWhere('day', '>=', $today)->day ?? $days->last()->day ?? $today);

        $rows = $this->base($selectedStaff)
            ->where('s.service_date', $day)
            ->leftJoin('ops_vehicles as v', 'v.id', '=', 'a.vehicle_id')
            ->leftJoin('ops_orders as o', 'o.id', '=', 'a.order_id')
            ->orderBy('s.service_time')
            ->get(['s.code', 's.name', 's.service_time', 's.service_kind', 's.status', 's.pax', 's.confirmation_code', 's.reservation_id', 'r.code as reservation', 'r.title as reservation_title', 'a.status as assignment_status', 'a.confirmed_at', 'a.started_at', 'a.finished_at', 'g.full_name as guide', 'd.full_name as driver', 'v.plate', 'v.vehicle_type', 'o.code as order_code']);
        $leads = DB::table('booking_passengers')->whereIn('reservation_id', $rows->pluck('reservation_id')->unique())->orderByDesc('is_lead')->orderBy('seq')->get(['reservation_id', 'full_name', 'phone'])->groupBy('reservation_id');
        $devices = DB::table('ops_mobile_devices')->where('app', 'operador')->whereNull('revoked_at');

        return [
            'today' => $today,
            'date' => $day,
            'days' => $days->map(fn (object $row): array => ['date' => $row->day, 'services' => (int) $row->total])->values(),
            'staff' => $staffList->values(),
            'selected_staff' => $selectedStaff,
            'devices' => [
                'active' => (clone $devices)->count(),
                'last_sync_at' => (clone $devices)->max('last_sync_at'),
                'items' => (clone $devices)->join('iam_users as u', 'u.id', '=', 'ops_mobile_devices.user_id')->orderByRaw('ops_mobile_devices.last_sync_at desc nulls last')->limit(20)
                    ->get(['ops_mobile_devices.id', 'u.name', 'ops_mobile_devices.platform', 'ops_mobile_devices.app_version', 'ops_mobile_devices.last_seen_at', 'ops_mobile_devices.last_sync_at'])
                    ->map(fn (object $row): array => ['id' => $row->id, 'user' => $row->name, 'platform' => $row->platform, 'version' => $row->app_version, 'last_seen_at' => $row->last_seen_at, 'last_sync_at' => $row->last_sync_at])->values(),
            ],
            'sync' => $this->syncCounters(Carbon::parse($today)->subDays(6)->startOfDay()),
            'kpis' => [
                'services' => $rows->count(),
                'pax' => (int) $rows->sum('pax'),
                'assigned' => $rows->filter(fn (object $row): bool => $row->guide !== null || $row->driver !== null)->count(),
                'confirmed' => $rows->whereIn('assignment_status', ['confirmada', 'en_curso', 'completada'])->count(),
                'done' => $rows->where('assignment_status', 'completada')->count(),
            ],
            'services' => $rows->map(function (object $row) use ($leads): array {
                $lead = ($leads[$row->reservation_id] ?? collect())->first();

                return [
                    'code' => $row->code,
                    'name' => $row->name,
                    'time' => $row->service_time ? substr((string) $row->service_time, 0, 5) : null,
                    'kind' => $row->service_kind,
                    'status' => $row->status,
                    'pax' => (int) $row->pax,
                    'confirmation' => $row->confirmation_code,
                    'reservation' => $row->reservation,
                    'reservation_title' => $row->reservation_title,
                    'lead' => $lead ? ['name' => $lead->full_name, 'phone' => $lead->phone] : null,
                    'assignment' => $row->assignment_status,
                    'confirmed_at' => $row->confirmed_at,
                    'started_at' => $row->started_at,
                    'finished_at' => $row->finished_at,
                    'guide' => $row->guide,
                    'driver' => $row->driver,
                    'vehicle' => $row->plate ? trim($row->plate.' · '.($row->vehicle_type ?? '')) : null,
                    'order' => $row->order_code,
                ];
            })->values(),
        ];
    }

    private function staff()
    {
        $guides = DB::table('ops_guides as g')->whereNull('g.deleted_at')->whereExists(fn (Builder $sub) => $sub->from('ops_assignments as a')->whereColumn('a.guide_id', 'g.id'))->orderBy('g.full_name')->get(['g.id', 'g.code', 'g.full_name', 'g.phone'])->map(fn (object $row): array => ['id' => $row->id, 'code' => $row->code, 'name' => $row->full_name, 'phone' => $row->phone, 'role' => 'guia']);
        $drivers = DB::table('ops_drivers as d')->whereNull('d.deleted_at')->whereExists(fn (Builder $sub) => $sub->from('ops_assignments as a')->whereColumn('a.driver_id', 'd.id'))->orderBy('d.full_name')->get(['d.id', 'd.code', 'd.full_name', 'd.phone'])->map(fn (object $row): array => ['id' => $row->id, 'code' => $row->code, 'name' => $row->full_name, 'phone' => $row->phone, 'role' => 'conductor']);

        return $guides->concat($drivers);
    }

    private function syncCounters(Carbon $since): array
    {
        $rows = DB::table('ops_sync_actions')->where('received_at', '>=', $since)
            ->selectRaw('result, count(*) as total, sum(case when captured_offline then 1 else 0 end) as offline')->groupBy('result')->get()->keyBy('result');
        $count = fn (string $result): int => (int) ($rows[$result]->total ?? 0);

        return [
            'since' => $since->toDateString(),
            'received' => (int) $rows->sum('total'),
            'applied' => $count('applied') + $count('duplicate'),
            'offline' => (int) $rows->sum('offline'),
            'conflicts' => $count('conflict_resolved'),
            'rejected' => $count('rejected'),
        ];
    }

    private function base(?array $staff): Builder
    {
        return DB::table('booking_reservation_services as s')
            ->join('booking_reservations as r', 'r.id', '=', 's.reservation_id')
            ->leftJoin('ops_assignments as a', 'a.reservation_service_id', '=', 's.id')
            ->leftJoin('ops_guides as g', 'g.id', '=', 'a.guide_id')
            ->leftJoin('ops_drivers as d', 'd.id', '=', 'a.driver_id')
            ->whereNull('r.deleted_at')
            ->whereNotIn('r.status', ['cancelada', 'borrador'])
            ->where('s.status', '<>', 'cancelado')
            ->whereIn('s.service_kind', self::FIELD_KINDS)
            ->when($staff, fn (Builder $query) => $staff['role'] === 'guia' ? $query->where('a.guide_id', $staff['id']) : $query->where('a.driver_id', $staff['id']));
    }
}
