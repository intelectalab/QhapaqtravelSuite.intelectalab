<?php

declare(strict_types=1);

namespace App\Domain\Platform\Support;

use Illuminate\Database\ConnectionInterface;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

final class PlatformOperations
{
    public const JOBS = [
        'PLT-01' => ['billing:renewals', 'Renovar suscripciones', 'Aplica cambios programados, emite la factura del nuevo periodo y la cobra.', '0 6 * * *', 'diario 06:00', 'critical'],
        'PLT-02' => ['billing:dunning', 'Reintentar cobros fallidos', 'Reintenta las facturas en cobranza según la política y suspende al agotar los intentos.', '0 10 * * *', 'diario 10:00', 'critical'],
        'PLT-03' => ['billing:trials', 'Avisos y cierre de pruebas', 'Avisa a 7, 3 y 1 día del fin de la prueba y suspende las que vencen sin tarjeta.', '0 8 * * *', 'diario 08:00', 'default'],
        'PLT-04' => ['billing:expire-cards', 'Tarjetas por vencer', 'Avisa a las agencias cuya tarjeta vence en los próximos 30 días.', '0 9 1 * *', 'mensual, día 1', 'low'],
        'PLT-05' => ['usage:consolidate', 'Consolidar uso', 'Vuelca los contadores del día y envía los avisos al 80 y 100 % del límite.', '15 0 * * *', 'diario 00:15', 'reports'],
        'PLT-06' => ['platform:metrics-snapshot', 'Foto de métricas', 'Calcula MRR, ARR, ARPA, altas y bajas del día.', '0 1 * * *', 'diario 01:00', 'reports'],
        'PLT-07' => ['api-keys:expire', 'Vencer llaves de API', 'Marca como vencidas las llaves con fecha cumplida y avisa 7 días antes.', '30 0 * * *', 'diario 00:30', 'low'],
        'PLT-08' => ['webhooks:purge', 'Depurar entregas de webhooks', 'Elimina las entregas con más de 30 días de antigüedad.', '45 0 * * *', 'diario 00:45', 'low'],
    ];

    public const QUEUES = [
        'critical' => 'Cobros y renovaciones',
        'default' => 'General',
        'notifications' => 'Notificaciones',
        'documents' => 'Comprobantes',
        'integrations' => 'Integraciones',
        'reports' => 'Reportes y métricas',
        'low' => 'Mantenimiento',
    ];

    private const CONNECTION = 'pgsql_platform';

    public function overview(): array
    {
        $jobs = $this->db()->table('sys_scheduled_jobs')->whereNull('tenant_id')->orderBy('code')->get();
        $runs = $this->db()->table('sys_job_runs')->whereIn('scheduled_job_id', $jobs->pluck('id'))->orderByDesc('started_at')->get()->groupBy('scheduled_job_id');
        $tenants = $this->db()->table('tenants')->pluck('commercial_name', 'id');

        return [
            'jobs' => $jobs->map(fn (object $job) => [
                'code' => $job->code,
                'command' => $job->job_class,
                'name' => $job->name,
                'description' => $this->description((string) $job->code),
                'cron' => $job->cron,
                'cron_label' => $job->cron_label,
                'queue' => $job->queue,
                'paused' => (bool) $job->paused,
                'last_run_at' => $job->last_run_at ? Carbon::parse($job->last_run_at)->toIso8601String() : null,
                'next_run_at' => $job->next_run_at ? Carbon::parse($job->next_run_at)->toIso8601String() : null,
                'last_status' => $job->last_status,
                'last_result' => $job->last_result,
                'runnable' => class_exists((string) $job->job_class),
                'runs' => $this->runs($runs->get($job->id, collect())),
            ])->values(),
            'queues' => $this->queues(),
            'agencies' => $this->agencies($tenants),
            'errors' => $this->db()->table('integration_errors')->whereNotNull('tenant_id')->orderByDesc('created_at')->limit(200)->get()
                ->map(fn (object $error) => [
                    'id' => $error->id,
                    'code' => $error->code,
                    'tenant' => $tenants[$error->tenant_id] ?? null,
                    'source' => $error->source,
                    'ref' => $error->ref_code,
                    'target' => $error->target,
                    'error' => $error->error,
                    'class' => $error->error_class,
                    'attempt' => (int) $error->attempt,
                    'max_attempts' => (int) $error->max_attempts,
                    'next_retry_at' => $error->next_retry_at ? Carbon::parse($error->next_retry_at)->toIso8601String() : null,
                    'status' => $error->status,
                    'at' => Carbon::parse($error->created_at)->toIso8601String(),
                ])->values(),
        ];
    }

    private function description(string $code): ?string
    {
        return isset(self::JOBS[$code]) ? self::JOBS[$code][2] : null;
    }

    private function runs(Collection $runs): array
    {
        $items = [];

        foreach ($runs->take(6) as $run) {
            $items[] = [
                'status' => $run->status,
                'trigger' => $run->trigger,
                'result' => $run->result,
                'started_at' => Carbon::parse($run->started_at)->toIso8601String(),
                'duration_ms' => $run->finished_at ? (int) Carbon::parse($run->started_at)->diffInMilliseconds(Carbon::parse($run->finished_at)) : null,
            ];
        }

        return $items;
    }

    private function queues(): Collection
    {
        $pending = $this->db()->table('jobs')->selectRaw('queue, count(*) as total')->groupBy('queue')->pluck('total', 'queue');
        $failed = $this->db()->table('failed_jobs')->selectRaw('queue, count(*) as total')->groupBy('queue')->pluck('total', 'queue');
        $scheduled = $this->db()->table('sys_scheduled_jobs')->selectRaw('queue, count(*) as total')->groupBy('queue')->pluck('total', 'queue');
        $runs = $this->db()->table('sys_job_runs as r')->join('sys_scheduled_jobs as j', 'j.id', '=', 'r.scheduled_job_id')->where('r.started_at', '>=', now()->subDays(7))
            ->selectRaw("j.queue, count(*) as total, count(*) filter (where r.status = 'error') as errors, count(*) filter (where r.status = 'advertencia') as warnings")->groupBy('j.queue')->get()->keyBy('queue');

        return collect(self::QUEUES)->map(fn (string $label, string $queue) => [
            'queue' => $queue,
            'label' => $label,
            'pending' => (int) ($pending[$queue] ?? 0),
            'failed' => (int) ($failed[$queue] ?? 0),
            'scheduled' => (int) ($scheduled[$queue] ?? 0),
            'runs' => (int) ($runs[$queue]->total ?? 0),
            'errors' => (int) ($runs[$queue]->errors ?? 0),
            'warnings' => (int) ($runs[$queue]->warnings ?? 0),
        ])->values();
    }

    private function agencies(Collection $tenants): Collection
    {
        $jobs = $this->db()->table('sys_scheduled_jobs')->whereNotNull('tenant_id')
            ->selectRaw("tenant_id, count(*) as total, count(*) filter (where paused) as paused, count(*) filter (where last_status = 'error') as errors, count(*) filter (where last_status = 'advertencia') as warnings, max(last_run_at) as last_run_at")
            ->groupBy('tenant_id')->get()->keyBy('tenant_id');
        $errors = $this->db()->table('integration_errors')->whereNotNull('tenant_id')->where('status', '<>', 'resuelto')->selectRaw('tenant_id, count(*) as total')->groupBy('tenant_id')->pluck('total', 'tenant_id');

        return $tenants->map(fn (string $name, string $id) => [
            'name' => $name,
            'jobs' => (int) ($jobs[$id]->total ?? 0),
            'paused' => (int) ($jobs[$id]->paused ?? 0),
            'errors' => (int) ($jobs[$id]->errors ?? 0),
            'warnings' => (int) ($jobs[$id]->warnings ?? 0),
            'open_errors' => (int) ($errors[$id] ?? 0),
            'last_run_at' => isset($jobs[$id]) && $jobs[$id]->last_run_at ? Carbon::parse($jobs[$id]->last_run_at)->toIso8601String() : null,
        ])->filter(fn (array $row) => $row['jobs'] > 0 || $row['open_errors'] > 0)->sortBy('name')->values();
    }

    private function db(): ConnectionInterface
    {
        return DB::connection(self::CONNECTION);
    }
}
