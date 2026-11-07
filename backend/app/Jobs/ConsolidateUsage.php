<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Domain\Platform\Support\PlatformSettings;
use App\Domain\Platform\Support\TenantNotice;
use Illuminate\Support\Facades\DB;

final class ConsolidateUsage extends PlatformJob
{
    public const QUEUE = 'reports';

    public const LABELS = [
        'reservations_month' => 'reservas del mes',
        'api_calls_month' => 'llamadas a la API del mes',
        'email_month' => 'correos del mes',
        'whatsapp_month' => 'mensajes de WhatsApp del mes',
        'storage_gb' => 'almacenamiento (GB)',
    ];

    protected function run(): string
    {
        $db = DB::connection('pgsql_platform');
        $month = $this->today()->startOfMonth()->toDateString();
        $events = $db->transaction(function () use ($db): int {
            $pending = $db->table('usage_events')->whereNull('processed_at')->orderBy('created_at')->lockForUpdate()->get(['id', 'tenant_id', 'metric', 'day', 'value']);

            foreach ($pending->groupBy(fn (object $event): string => "{$event->tenant_id}|{$event->metric}|{$event->day}") as $group) {
                $first = $group->first();
                $db->statement('insert into usage_counters (tenant_id, metric, day, value) values (?, ?, ?, ?) on conflict (tenant_id, metric, day) do update set value = usage_counters.value + excluded.value', [$first->tenant_id, $first->metric, $first->day, (int) $group->sum('value')]);
            }

            $db->table('usage_events')->whereIn('id', $pending->pluck('id'))->update(['processed_at' => now()]);

            return $pending->count();
        });

        $totals = $db->table('usage_counters')->where('day', '>=', $month)->where('day', '<', $this->today()->startOfMonth()->addMonth()->toDateString())
            ->selectRaw("tenant_id, metric, case when metric like '%\\_month' escape '\\' then sum(value) else max(value) end as total")->groupBy('tenant_id', 'metric')->get();
        $limits = $db->table('tenants as t')->join('plan_limits as l', 'l.plan_id', '=', 't.plan_id')->whereNotNull('l.value')->get(['t.id as tenant_id', 'l.metric', 'l.value'])
            ->keyBy(fn (object $row): string => "{$row->tenant_id}|{$row->metric}");
        $alerts = 0;

        foreach ($totals as $row) {
            $limit = $limits->get("{$row->tenant_id}|{$row->metric}")?->value;
            $alerts += $db->transaction(fn (): int => $this->store($row, $month, $limit === null ? null : (int) $limit));
        }

        $tenants = $totals->pluck('tenant_id')->unique()->count();

        return self::summary([
            self::plural($tenants, 'agencia consolidada', 'agencias consolidadas'),
            $events ? self::plural($events, 'evento de uso procesado', 'eventos de uso procesados') : null,
            $alerts ? self::plural($alerts, 'aviso de límite', 'avisos de límite') : null,
        ], 'Sin uso por consolidar');
    }

    private function store(object $row, string $month, ?int $limit): int
    {
        $db = DB::connection('pgsql_platform');
        $key = ['tenant_id' => $row->tenant_id, 'metric' => $row->metric, 'month' => $month];
        $db->table('usage_monthly')->updateOrInsert($key, ['value' => (int) $row->total, 'limit_value' => $limit]);
        $current = $db->table('usage_monthly')->where($key)->lockForUpdate()->first();

        if ($limit === null || $limit <= 0) {
            return 0;
        }

        $percent = intdiv((int) $row->total * 100, $limit);
        $label = self::LABELS[$row->metric] ?? $row->metric;

        if ($percent >= 100 && $current->alert_100_sent_at === null) {
            $db->table('usage_monthly')->where($key)->update(['alert_100_sent_at' => now(), 'alert_80_sent_at' => $current->alert_80_sent_at ?? now()]);

            return app(TenantNotice::class)->send((string) $row->tenant_id, 'Llegaste al límite de tu plan', "Usaste {$row->total} de {$limit} en {$label}. Para seguir sin restricciones este mes, sube de plan o agrega un complemento.") ? 1 : 0;
        }

        if ($percent >= app(PlatformSettings::class)->notices()['usage_warn_pct'] && $current->alert_80_sent_at === null) {
            $db->table('usage_monthly')->where($key)->update(['alert_80_sent_at' => now()]);

            return app(TenantNotice::class)->send((string) $row->tenant_id, "Usaste el {$percent} % de tu plan", "Llevas {$row->total} de {$limit} en {$label} este mes.") ? 1 : 0;
        }

        return 0;
    }
}
