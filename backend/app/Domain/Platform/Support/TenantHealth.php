<?php

declare(strict_types=1);

namespace App\Domain\Platform\Support;

use Illuminate\Database\ConnectionInterface;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

final class TenantHealth
{
    private const CONNECTION = 'pgsql_platform';

    public function all(): array
    {
        $tenants = $this->db()->table('tenants as t')->leftJoin('plans as p', 'p.id', '=', 't.plan_id')->orderBy('t.commercial_name')
            ->get(['t.id', 't.code', 't.commercial_name', 't.status', 't.trial_ends_at', 'p.code as plan_code', 'p.name as plan_name']);
        $adapters = $this->grouped('integration_adapters', "count(*) as total, count(*) filter (where status = 'activo') as active, count(*) filter (where last_test_ok = false) as failing");
        $jobs = $this->grouped('sys_scheduled_jobs', "count(*) as total, count(*) filter (where paused) as paused, count(*) filter (where last_status = 'error') as errors, count(*) filter (where last_status = 'advertencia') as warnings, max(last_run_at) as last_run_at");
        $errors = $this->grouped('integration_errors', "count(*) filter (where status <> 'resuelto') as open, count(*) filter (where status = 'fallo_definitivo') as definitive");
        $logins = $this->grouped('iam_users', 'max(last_login_at) as last_login_at');

        return $tenants->map(function (object $tenant) use ($adapters, $jobs, $errors, $logins): array {
            $adapter = $adapters->get($tenant->id);
            $job = $jobs->get($tenant->id);
            $error = $errors->get($tenant->id);
            $heartbeat = collect([$job->last_run_at ?? null, $logins->get($tenant->id)->last_login_at ?? null])->filter()->map(fn (string $at) => Carbon::parse($at))->max();
            $open = (int) ($error->open ?? 0);
            $definitive = (int) ($error->definitive ?? 0);
            $jobErrors = (int) ($job->errors ?? 0);
            $level = match (true) {
                $tenant->status === 'suspendido' || $definitive > 0 || $jobErrors > 0 => 'critico',
                $open > 0 || (int) ($job->warnings ?? 0) > 0 || (int) ($job->paused ?? 0) > 0 || (int) ($adapter->failing ?? 0) > 0 => 'atencion',
                default => 'ok',
            };

            return [
                'id' => $tenant->id,
                'code' => $tenant->code,
                'name' => $tenant->commercial_name,
                'status' => $tenant->status,
                'trial_ends_at' => $tenant->status === 'prueba' ? $tenant->trial_ends_at : null,
                'plan' => $tenant->plan_code ? ['code' => $tenant->plan_code, 'name' => $tenant->plan_name] : null,
                'health' => $level,
                'integrations' => ['total' => (int) ($adapter->total ?? 0), 'active' => (int) ($adapter->active ?? 0), 'failing' => (int) ($adapter->failing ?? 0)],
                'jobs' => ['total' => (int) ($job->total ?? 0), 'paused' => (int) ($job->paused ?? 0), 'errors' => $jobErrors, 'warnings' => (int) ($job->warnings ?? 0), 'last_run_at' => isset($job->last_run_at) ? Carbon::parse($job->last_run_at)->toIso8601String() : null],
                'open_errors' => $open,
                'definitive_errors' => $definitive,
                'last_heartbeat_at' => $heartbeat?->toIso8601String(),
            ];
        })->values()->all();
    }

    public function kpis(array $rows): array
    {
        $rows = collect($rows);

        return [
            'tenants' => $rows->count(),
            'ok' => $rows->where('health', 'ok')->count(),
            'attention' => $rows->where('health', 'atencion')->count(),
            'critical' => $rows->where('health', 'critico')->count(),
            'open_errors' => $rows->sum('open_errors'),
        ];
    }

    private function grouped(string $table, string $select): Collection
    {
        return $this->db()->table($table)->whereNotNull('tenant_id')->selectRaw("tenant_id, {$select}")->groupBy('tenant_id')->get()->keyBy('tenant_id');
    }

    private function db(): ConnectionInterface
    {
        return DB::connection(self::CONNECTION);
    }
}
