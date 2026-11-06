<?php

declare(strict_types=1);

namespace Database\Seeders\Modules;

use App\Domain\Platform\Models\Tenant;
use Database\Support\KitSeeds;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

final class OperationsTimeline
{
    private const ANCHOR = 'RES-2026-000347';

    public static function shift(Tenant $tenant): ?int
    {
        $seed = collect(KitSeeds::read('reservations'))->firstWhere('id', self::ANCHOR);
        $current = DB::table('booking_reservations')->where('tenant_id', $tenant->getKey())->where('code', self::ANCHOR)->value('travel_from');

        return $seed && $current ? (int) Carbon::parse($seed['travelFrom'])->diffInDays(Carbon::parse($current), false) : null;
    }
}
