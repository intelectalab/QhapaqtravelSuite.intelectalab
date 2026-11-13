<?php

declare(strict_types=1);

namespace App\Domain\Showcase\Support;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class ShowcaseSequence
{
    public const AGENCY = ['showcase_agency', 'SHA-', 2, 'platform_showcase_agencies'];

    public const LISTING = ['showcase_listing', 'SHL-', 3, 'platform_showcase_listings'];

    public const BOOKING = ['showcase_booking', 'SHB-', 4, 'platform_showcase_bookings'];

    public const PASS = ['access_pass', 'PASE-', 4, 'platform_access_passes'];

    public function next(array $sequence): string
    {
        [$type, $prefix, $pad, $table] = $sequence;
        $db = DB::connection('pgsql_platform');
        $row = $db->table('platform_sequences')->where('doc_type', $type)->where('series', 'default')->lockForUpdate()->first();
        $floor = (int) $db->table($table)->where('code', 'like', $prefix.'%')->selectRaw("coalesce(max(nullif(substring(code from '[0-9]+$'), '')::int), 0) as n")->value('n') + 1;

        if ($row === null) {
            $db->table('platform_sequences')->insert(['id' => (string) Str::uuid7(), 'doc_type' => $type, 'series' => 'default', 'prefix' => $prefix, 'pad_width' => $pad, 'next_number' => $floor + 1]);
            $number = $floor;
        } else {
            $number = max((int) $row->next_number, $floor);
            $db->table('platform_sequences')->where('id', $row->id)->update(['next_number' => $number + 1]);
        }

        return $prefix.str_pad((string) $number, $pad, '0', STR_PAD_LEFT);
    }
}
