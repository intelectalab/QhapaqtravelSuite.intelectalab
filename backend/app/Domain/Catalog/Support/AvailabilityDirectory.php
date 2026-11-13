<?php

declare(strict_types=1);

namespace App\Domain\Catalog\Support;

use App\Domain\Iam\Models\User;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

final class AvailabilityDirectory
{
    public const RANGE_STATUSES = ['disponible', 'cerrado', 'agotado'];

    public static function rangesQuery(): Builder
    {
        return DB::table('catalog_availability_ranges as r')
            ->join('catalog_products as p', 'p.id', '=', 'r.product_id')
            ->whereNull('r.deleted_at')->whereNull('p.deleted_at')
            ->select(['r.*', 'p.code as product_code', 'p.name as product_name']);
    }

    public static function presentRange(object $range, string $today): array
    {
        return [
            'code' => $range->code,
            'product' => ['id' => $range->product_id, 'code' => $range->product_code, 'name' => $range->product_name],
            'date_from' => $range->date_from,
            'date_to' => $range->date_to,
            'days' => Carbon::parse($range->date_from)->diffInDays(Carbon::parse($range->date_to)) + 1,
            'status' => $range->status,
            'capacity_per_day' => (int) $range->capacity_per_day,
            'note' => $range->note,
            'phase' => match (true) {
                $range->date_to < $today => 'pasado',
                $range->date_from > $today => 'proximo',
                default => 'en_curso',
            },
        ];
    }

    public static function holdsQuery(): Builder
    {
        return DB::table('catalog_availability_holds as h')
            ->leftJoin('catalog_product_departures as d', 'd.id', '=', 'h.departure_id')
            ->leftJoin('catalog_products as p', 'p.id', '=', DB::raw('coalesce(d.product_id, h.product_id)'))
            ->leftJoin('iam_users as u', 'u.id', '=', 'h.created_by')
            ->select(['h.*', 'd.ref as departure_ref', 'd.departure_date', 'd.departure_time', 'p.code as product_code', 'p.name as product_name', 'u.name as user_name']);
    }

    public static function presentHold(object $hold, Carbon $now): array
    {
        return [
            'ref' => $hold->ref,
            'lock_version' => (int) $hold->lock_version,
            'departure' => $hold->departure_ref ? ['ref' => $hold->departure_ref, 'date' => $hold->departure_date, 'time' => substr((string) $hold->departure_time, 0, 5)] : null,
            'product' => ['code' => $hold->product_code, 'name' => $hold->product_name],
            'service_date' => $hold->service_date ?? $hold->departure_date,
            'quantity' => (int) $hold->quantity,
            'reference' => $hold->reference,
            'status' => $hold->status,
            'expired' => $hold->status === 'hold' && Carbon::parse($hold->expires_at)->lt($now),
            'expires_at' => Carbon::parse($hold->expires_at)->toIso8601String(),
            'created_at' => Carbon::parse($hold->created_at)->toIso8601String(),
            'user' => $hold->user_name,
            'released_reason' => $hold->released_reason,
            'notes' => $hold->notes,
        ];
    }

    public function overview(User $viewer): array
    {
        $today = CatalogAccess::today();
        $now = now();

        $ranges = self::rangesQuery()->orderBy('p.name')->orderBy('r.date_from')->get()
            ->map(fn (object $range) => self::presentRange($range, $today));

        $holds = self::holdsQuery()->orderByDesc('h.created_at')->get()
            ->map(fn (object $hold) => self::presentHold($hold, $now));

        $held = DB::table('catalog_availability_holds')->where('status', 'hold')->whereNotNull('departure_id')
            ->selectRaw('departure_id, sum(quantity) as total')->groupBy('departure_id')->pluck('total', 'departure_id');

        return [
            'today' => $today,
            'ranges' => $ranges,
            'holds' => $holds,
            'options' => [
                'products' => DB::table('catalog_products')->whereNull('deleted_at')->whereNotIn('status', ['ARCHIVED'])->orderBy('name')->get(['id', 'code', 'name']),
                'departures' => DB::table('catalog_product_departures as d')->join('catalog_products as p', 'p.id', '=', 'd.product_id')
                    ->where('d.status', 'abierta')->where('d.departure_date', '>=', $today)->where('p.status', 'ACTIVE')->whereNull('p.deleted_at')
                    ->orderBy('d.departure_date')->orderBy('d.departure_time')
                    ->get(['d.id', 'd.ref', 'd.departure_date', 'd.departure_time', 'd.capacity', 'd.sold', 'd.status', 'p.name as product_name'])
                    ->map(fn (object $departure) => [
                        'id' => $departure->id,
                        'ref' => $departure->ref,
                        'label' => $departure->product_name,
                        'date' => $departure->departure_date,
                        'time' => substr((string) $departure->departure_time, 0, 5),
                        'available' => DepartureDirectory::available($departure, (int) ($held[$departure->id] ?? 0)),
                    ])
                    ->filter(fn (array $departure) => $departure['available'] > 0)
                    ->values(),
            ],
            'can' => [
                'manage_ranges' => $viewer->can('catalog.allotments.manage'),
                'manage_holds' => $viewer->can('catalog.products.manage_availability'),
            ],
        ];
    }
}
