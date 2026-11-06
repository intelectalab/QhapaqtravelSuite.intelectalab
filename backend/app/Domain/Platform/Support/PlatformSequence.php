<?php

declare(strict_types=1);

namespace App\Domain\Platform\Support;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class PlatformSequence
{
    private const CONNECTION = 'pgsql_platform';

    public const INVOICE = ['platform_invoice', 'FQ01', 'platform_invoices'];

    public const CREDIT_NOTE = ['platform_credit_note', 'NQ01', 'platform_credit_notes'];

    public function next(array $sequence): int
    {
        [$type, $series, $table] = $sequence;
        $db = DB::connection(self::CONNECTION);
        $row = $db->table('platform_sequences')->where('doc_type', $type)->where('series', $series)->lockForUpdate()->first();
        $floor = (int) $db->table($table)->where('series', $series)->max('number') + 1;

        if ($row === null) {
            $db->table('platform_sequences')->insert(['id' => (string) Str::uuid7(), 'doc_type' => $type, 'series' => $series, 'prefix' => $series.'-', 'pad_width' => 8, 'next_number' => $floor + 1]);

            return $floor;
        }

        $number = max((int) $row->next_number, $floor);
        $db->table('platform_sequences')->where('id', $row->id)->update(['next_number' => $number + 1]);

        return $number;
    }

    public static function format(string $series, int $number): string
    {
        return sprintf('%s-%08d', $series, $number);
    }
}
