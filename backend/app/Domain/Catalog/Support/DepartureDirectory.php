<?php

declare(strict_types=1);

namespace App\Domain\Catalog\Support;

use App\Domain\Iam\Models\User;
use Illuminate\Support\Facades\DB;

final class DepartureDirectory
{
    public const STATUSES = ['abierta', 'completa', 'cerrada', 'cancelada'];

    public static function available(object $departure, int $held): int
    {
        return in_array($departure->status, ['cerrada', 'cancelada'], true) ? 0 : max(0, (int) $departure->capacity - (int) $departure->sold - $held);
    }

    public static function held(string $departureId): int
    {
        return (int) DB::table('catalog_availability_holds')->where('departure_id', $departureId)->where('status', 'hold')->sum('quantity');
    }

    public function overview(User $viewer): array
    {
        $today = CatalogAccess::today();
        $held = DB::table('catalog_availability_holds')->where('status', 'hold')->whereNotNull('departure_id')
            ->selectRaw('departure_id, sum(quantity) as total')->groupBy('departure_id')->pluck('total', 'departure_id');

        $departures = DB::table('catalog_product_departures as d')
            ->join('catalog_products as p', 'p.id', '=', 'd.product_id')
            ->leftJoin('catalog_providers as pv', 'pv.id', '=', DB::raw('coalesce(d.provider_id, p.main_provider_id)'))
            ->leftJoin('ops_guides as g', 'g.id', '=', 'd.guide_id')
            ->leftJoin('ops_vehicles as v', 'v.id', '=', 'd.vehicle_id')
            ->whereNull('p.deleted_at')
            ->orderBy('d.departure_date')->orderBy('d.departure_time')
            ->get(['d.*', 'p.code as product_code', 'p.name as product_name', 'p.status as product_status', 'pv.name as provider_name', 'g.full_name as guide_name', 'v.plate as vehicle_plate', 'v.capacity as vehicle_capacity'])
            ->map(function (object $row) use ($held, $today) {
                $onHold = (int) ($held[$row->id] ?? 0);

                return [
                    'ref' => $row->ref,
                    'product' => ['id' => $row->product_id, 'code' => $row->product_code, 'name' => $row->product_name, 'status' => $row->product_status],
                    'date' => $row->departure_date,
                    'time' => substr((string) $row->departure_time, 0, 5),
                    'capacity' => (int) $row->capacity,
                    'sold' => (int) $row->sold,
                    'held' => $onHold,
                    'available' => self::available($row, $onHold),
                    'status' => $row->status,
                    'future' => $row->departure_date >= $today,
                    'meeting_point' => $row->meeting_point,
                    'return_point' => $row->return_point,
                    'notes' => $row->notes,
                    'provider' => ['id' => $row->provider_id, 'name' => $row->provider_name],
                    'guide' => $row->guide_id ? ['id' => $row->guide_id, 'name' => $row->guide_name] : null,
                    'vehicle' => $row->vehicle_id ? ['id' => $row->vehicle_id, 'plate' => $row->vehicle_plate, 'capacity' => (int) $row->vehicle_capacity] : null,
                    'lock_version' => (int) $row->lock_version,
                ];
            });

        return [
            'today' => $today,
            'departures' => $departures,
            'options' => [
                'products' => DB::table('catalog_products')->whereNull('deleted_at')->whereNotIn('status', ['INACTIVE', 'ARCHIVED'])->orderBy('name')->get(['id', 'code', 'name', 'status', 'maximum_passengers']),
                'providers' => DB::table('catalog_providers')->whereNull('deleted_at')->where('status', 'activo')->where('contract_end', '>=', $today)->orderBy('name')->get(['id', 'name', 'type']),
                'guides' => DB::table('ops_guides')->whereNull('deleted_at')->where('status', '<>', 'vacaciones')->orderBy('full_name')->get(['id', 'full_name as name']),
                'vehicles' => DB::table('ops_vehicles')->whereNull('deleted_at')->where('status', '<>', 'mantenimiento')->orderBy('plate')->get(['id', 'plate', 'vehicle_type', 'capacity']),
            ],
            'can' => ['manage' => $viewer->can('catalog.products.manage_availability')],
        ];
    }
}
