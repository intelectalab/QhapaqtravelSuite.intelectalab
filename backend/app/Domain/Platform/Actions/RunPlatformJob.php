<?php

declare(strict_types=1);

namespace App\Domain\Platform\Actions;

use App\Domain\Platform\Models\PlatformUser;
use App\Domain\Platform\Support\BillingMetrics;
use App\Domain\Platform\Support\PlatformOperations;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class RunPlatformJob
{
    private const CONNECTION = 'pgsql_platform';

    public function __construct(
        private readonly CollectInvoice $collect,
        private readonly BillingMetrics $metrics,
        private readonly PlatformSession $session,
    ) {}

    public function run(string $code, PlatformUser $actor): string
    {
        $job = $this->job($code);

        if (! in_array($job->code, PlatformOperations::RUNNABLE, true)) {
            throw ApiException::conflict('JOB_NOT_RUNNABLE', 'Esta tarea solo corre en su horario programado.');
        }

        if ($job->paused) {
            throw ApiException::conflict('JOB_PAUSED', 'La tarea está pausada. Reanúdala antes de ejecutarla.');
        }

        $started = now();
        [$status, $result] = match ($job->code) {
            'PLT-02' => $this->dunning($actor),
            default => $this->snapshot(),
        };

        $this->db()->transaction(function () use ($job, $status, $result, $started, $actor): void {
            $this->db()->table('sys_job_runs')->insert([
                'id' => (string) Str::uuid7(),
                'tenant_id' => null,
                'scheduled_job_id' => $job->id,
                'job_class' => $job->job_class,
                'trigger' => 'manual',
                'status' => $status,
                'result' => $result,
                'started_at' => $started,
                'finished_at' => now(),
                'attempt' => 1,
                'correlation_id' => (string) Str::uuid7(),
            ]);
            $this->db()->table('sys_scheduled_jobs')->where('id', $job->id)->update(['last_run_at' => $started, 'last_status' => $status, 'last_result' => $result, 'updated_at' => now()]);
            $this->session->log('Job', $job->job_class, 'ejecutar', null, $result, $actor);
        });

        return $result;
    }

    public function setPaused(string $code, bool $paused, PlatformUser $actor): void
    {
        $job = $this->job($code);

        if ((bool) $job->paused === $paused) {
            throw ApiException::conflict('JOB_STATUS', $paused ? 'La tarea ya está pausada.' : 'La tarea ya está activa.');
        }

        $this->db()->transaction(function () use ($job, $paused, $actor): void {
            $this->db()->table('sys_scheduled_jobs')->where('id', $job->id)->update(['paused' => $paused, 'updated_at' => now()]);
            $this->session->log('Job', $job->job_class, $paused ? 'pausar' : 'reanudar', $paused ? 'activa' : 'pausada', $paused ? 'pausada' : 'activa', $actor);
        });
    }

    private function dunning(PlatformUser $actor): array
    {
        $summary = $this->collect->runDunning($actor);

        if ($summary['processed'] === 0) {
            return ['ok', 'Sin facturas con reintento pendiente'];
        }

        $parts = array_filter([
            $summary['paid'] ? "{$summary['paid']} cobrada".($summary['paid'] === 1 ? '' : 's') : null,
            $summary['declined'] ? "{$summary['declined']} rechazada".($summary['declined'] === 1 ? '' : 's') : null,
            $summary['suspended'] ? "{$summary['suspended']} agencia suspendida" : null,
        ]);

        return [$summary['declined'] > 0 ? 'advertencia' : 'ok', "{$summary['processed']} reintento".($summary['processed'] === 1 ? '' : 's').' · '.implode(', ', $parts)];
    }

    private function snapshot(): array
    {
        $snapshot = $this->metrics->snapshot();
        $this->metrics->storeSnapshot($snapshot);

        return ['ok', 'MRR S/ '.number_format($snapshot['mrr'], 0, '.', ' ')." · {$snapshot['active_tenants']} agencias que pagan"];
    }

    private function job(string $code): object
    {
        return $this->db()->table('sys_scheduled_jobs')->whereNull('tenant_id')->where('code', $code)->first() ?? throw ApiException::notFound('La tarea no existe.');
    }

    private function db(): ConnectionInterface
    {
        return DB::connection(self::CONNECTION);
    }
}
