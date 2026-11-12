<?php

declare(strict_types=1);

namespace App\Domain\Platform\Support;

use DateTimeInterface;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Throwable;

final class UsageMeter
{
    public const STORAGE_TABLES = ['sys_documents', 'ops_evidences', 'report_exports', 'collab_message_attachments'];

    public static function record(string $tenantId, string $metric, int $value = 1): void
    {
        if ($value <= 0) {
            return;
        }

        try {
            DB::connection('pgsql_platform')->table('usage_events')->insert(['tenant_id' => $tenantId, 'metric' => $metric, 'day' => Carbon::today('America/Lima')->toDateString(), 'value' => $value]);
        } catch (Throwable $e) {
            report($e);
        }
    }

    public static function used(string $tenantId, string $metric): int
    {
        $db = DB::connection('pgsql_platform');
        $month = Carbon::today('America/Lima')->startOfMonth();
        $counted = (int) $db->table('usage_counters')->where('tenant_id', $tenantId)->where('metric', $metric)->where('day', '>=', $month->toDateString())->sum('value');
        $pending = (int) $db->table('usage_events')->where('tenant_id', $tenantId)->where('metric', $metric)->whereNull('processed_at')->where('day', '>=', $month->toDateString())->sum('value');

        return $counted + $pending;
    }

    public static function exhausted(string $tenantId, string $planId, string $metric, int $more = 1): bool
    {
        $hard = DB::connection('pgsql_platform')->table('plan_limits')->where('plan_id', $planId)->where('metric', $metric)->value('hard');
        $limit = EffectiveLimits::limit($tenantId, $planId, $metric);

        return $limit !== null && $hard !== false && self::used($tenantId, $metric) + $more > $limit;
    }

    public static function snapshot(DateTimeInterface $date): int
    {
        $today = Carbon::parse($date->format('Y-m-d'), 'America/Lima');
        $db = DB::connection('pgsql_platform');
        $month = $today->copy()->startOfMonth();
        $reservations = $db->table('booking_reservations')->whereNull('deleted_at')->where('created_at', '>=', $month)->where('created_at', '<', $month->copy()->addMonth())
            ->groupBy('tenant_id')->selectRaw('tenant_id, count(*) as total')->pluck('total', 'tenant_id');
        $bytes = collect();

        foreach (self::STORAGE_TABLES as $table) {
            $db->table($table)->groupBy('tenant_id')->selectRaw('tenant_id, coalesce(sum(size_bytes), 0) as total')->get()
                ->each(function (object $row) use ($bytes): void {
                    $bytes->put((string) $row->tenant_id, (int) ($bytes->get((string) $row->tenant_id, 0)) + (int) $row->total);
                });
        }

        foreach ($reservations as $tenantId => $total) {
            $db->table('usage_counters')->where('tenant_id', $tenantId)->where('metric', 'reservations_month')->where('day', '>', $month->toDateString())->where('day', '<', $month->copy()->addMonth()->toDateString())->delete();
            self::put((string) $tenantId, 'reservations_month', $month->toDateString(), (int) $total);
        }

        foreach ($bytes as $tenantId => $total) {
            $db->table('tenants')->where('id', $tenantId)->update(['storage_used_bytes' => $total]);
            self::put((string) $tenantId, 'storage_gb', $today->toDateString(), (int) ceil($total / 1024 ** 3));
        }

        return $reservations->keys()->merge($bytes->keys())->unique()->count();
    }

    private static function put(string $tenantId, string $metric, string $day, int $value): void
    {
        DB::connection('pgsql_platform')->statement('insert into usage_counters (tenant_id, metric, day, value) values (?, ?, ?, ?) on conflict (tenant_id, metric, day) do update set value = excluded.value', [$tenantId, $metric, $day, $value]);
    }
}
