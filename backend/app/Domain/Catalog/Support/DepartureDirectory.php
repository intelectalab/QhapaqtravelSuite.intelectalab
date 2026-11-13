<?php

declare(strict_types=1);

namespace App\Domain\Catalog\Support;

use App\Domain\Iam\Models\User;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

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

    public static function query(): Builder
    {
        return DB::table('catalog_product_departures as d')
            ->join('catalog_products as p', 'p.id', '=', 'd.product_id')
            ->leftJoin('catalog_providers as pv', 'pv.id', '=', DB::raw('coalesce(d.provider_id, p.main_provider_id)'))
            ->leftJoin('ops_guides as g', 'g.id', '=', 'd.guide_id')
            ->leftJoin('ops_vehicles as v', 'v.id', '=', 'd.vehicle_id')
            ->whereNull('p.deleted_at')
            ->select(['d.*', 'p.code as product_code', 'p.name as product_name', 'p.status as product_status', 'pv.name as provider_name', 'g.full_name as guide_name', 'v.plate as vehicle_plate', 'v.capacity as vehicle_capacity']);
    }

    public static function heldByDeparture(?string $productId = null): Collection
    {
        return DB::table('catalog_availability_holds as h')->where('h.status', 'hold')->whereNotNull('h.departure_id')
            ->when($productId, fn ($query) => $query->whereIn('h.departure_id', DB::table('catalog_product_departures')->where('product_id', $productId)->select('id')))
            ->selectRaw('h.departure_id, sum(h.quantity) as total')->groupBy('h.departure_id')->pluck('total', 'departure_id');
    }

    public static function present(object $row, int $held, string $today): array
    {
        return [
            'id' => $row->id,
            'ref' => $row->ref,
            'product' => ['id' => $row->product_id, 'code' => $row->product_code, 'name' => $row->product_name, 'status' => $row->product_status],
            'date' => $row->departure_date,
            'time' => substr((string) $row->departure_time, 0, 5),
            'capacity' => (int) $row->capacity,
            'sold' => (int) $row->sold,
            'held' => $held,
            'available' => self::available($row, $held),
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
    }

    public function find(string $ref): array
    {
        $row = self::query()->where(Str::isUuid($ref) ? 'd.id' : 'd.ref', $ref)->first() ?? throw ApiException::notFound('La salida no existe.');
        $now = now();

        return [
            ...self::present($row, self::held((string) $row->id), CatalogAccess::today()),
            'holds' => AvailabilityDirectory::holdsQuery()->where('h.departure_id', $row->id)->orderByDesc('h.created_at')->get()
                ->map(fn (object $hold) => AvailabilityDirectory::presentHold($hold, $now))->values(),
        ];
    }

    public function overview(User $viewer): array
    {
        $today = CatalogAccess::today();
        $held = self::heldByDeparture();

        $departures = self::query()
            ->orderBy('d.departure_date')->orderBy('d.departure_time')
            ->get()
            ->map(fn (object $row) => self::present($row, (int) ($held[$row->id] ?? 0), $today));

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
