<?php

declare(strict_types=1);

namespace App\Jobs;

use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

final class MaintainMonthlyPartitions extends PlatformJob
{
    public const TABLES = ['audit_events', 'usage_counters', 'channel_web_events', 'integration_webhook_deliveries'];

    public const MONTHS_AHEAD = 3;

    protected function run(): string
    {
        $owner = DB::connection('pgsql_owner');
        $start = CarbonImmutable::now('America/Lima')->startOfMonth()->toDateString();
        $created = 0;
        $tables = 0;

        foreach (self::TABLES as $table) {
            if ($owner->selectOne('select to_regclass(?) as oid', [$table])->oid === null) {
                continue;
            }

            $before = $this->partitions($table);
            $owner->select('select app_create_monthly_partitions(?, ?::date, ?)', [$table, $start, self::MONTHS_AHEAD + 1]);
            $created += $this->partitions($table) - $before;
            $tables++;
        }

        $until = CarbonImmutable::parse($start)->addMonths(self::MONTHS_AHEAD)->format('m/Y');

        return $created === 0
            ? "Particiones al día hasta {$until} en {$tables} tablas"
            : "{$created} partición(es) nuevas · al día hasta {$until} en {$tables} tablas";
    }

    private function partitions(string $table): int
    {
        return (int) DB::connection('pgsql_owner')->selectOne(
            'select count(*) as total from pg_inherits i join pg_class p on p.oid = i.inhparent where p.relname = ?',
            [$table],
        )->total;
    }
}
