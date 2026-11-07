<?php

declare(strict_types=1);

namespace App\Domain\Reports\Support;

use Illuminate\Support\Facades\DB;

final class ReportExports
{
    public const DAYS_AVAILABLE = 7;

    public static function nextCode(): string
    {
        DB::select('select pg_advisory_xact_lock(hashtext(?))', ['report_exports:code']);
        $next = (int) DB::table('report_exports')->whereNotNull('code')->selectRaw("coalesce(max(nullif(substring(code from '(\\d+)$'), '')::int), 0) as last")->value('last') + 1;

        return 'EXP-'.str_pad((string) $next, 4, '0', STR_PAD_LEFT);
    }
}
