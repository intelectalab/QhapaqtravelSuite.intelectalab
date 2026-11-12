<?php

declare(strict_types=1);

namespace App\Domain\Shared\Jobs;

use App\Domain\Admin\Support\IntegrationErrors;
use App\Domain\Shared\Tenancy\TenantDatabase;
use App\Http\Middleware\AssignCorrelationId;
use Closure;
use Illuminate\Support\Facades\DB;
use Throwable;

final class RecordJobRun
{
    public function __construct(
        private readonly string $trigger = 'schedule',
        private readonly ?string $tenantId = null,
    ) {}

    public function handle(object $job, Closure $next): mixed
    {
        $tenantId = $this->tenantId ?? (property_exists($job, 'tenantId') ? $job->tenantId : null);
        $attempt = method_exists($job, 'attempts') ? max(1, (int) $job->attempts()) : 1;
        $scheduledJobId = property_exists($job, 'scheduledJobId') ? $job->scheduledJobId : null;
        $existing = property_exists($job, 'runId') && $attempt === 1 ? $job->runId : null;

        $runId = $existing !== null ? $this->resume($tenantId, $existing) : $this->start($tenantId, $job, $attempt, $scheduledJobId);

        try {
            $result = $next($job);
            $warning = property_exists($job, 'runWarning') ? $job->runWarning : null;
            $summary = property_exists($job, 'runResult') ? $job->runResult : null;
            $this->finish($tenantId, $runId, $job, $scheduledJobId, $warning === null ? 'ok' : 'advertencia', $warning ?? $summary);
            [$ref] = $this->reference($job);
            IntegrationErrors::resolve($tenantId, 'job', $ref);

            return $result;
        } catch (Throwable $e) {
            $this->finish($tenantId, $runId, $job, $scheduledJobId, 'error', class_basename($e).': '.mb_substr($e->getMessage(), 0, 200));
            [$ref, $target] = $this->reference($job);
            $max = property_exists($job, 'tries') ? max(1, (int) $job->tries) : 1;
            IntegrationErrors::record($tenantId, 'job', $ref, $target, IntegrationErrors::describe($e), $attempt, $max);
            throw $e;
        }
    }

    private function reference(object $job): array
    {
        $entry = JobCatalog::forClass($job::class);

        return [$entry['code'] ?? class_basename($job), $entry['name'] ?? class_basename($job)];
    }

    private function start(?string $tenantId, object $job, int $attempt, ?string $scheduledJobId): string
    {
        return (string) $this->write($tenantId, fn () => DB::connection($this->connectionFor($tenantId))->table('sys_job_runs')->insertGetId([
            'tenant_id' => $tenantId,
            'scheduled_job_id' => $scheduledJobId,
            'job_class' => mb_substr($job::class, 0, 150),
            'trigger' => $attempt > 1 ? 'retry' : $this->trigger,
            'status' => 'en_curso',
            'started_at' => now(),
            'attempt' => $attempt,
            'correlation_id' => mb_substr(AssignCorrelationId::current(), 0, 40),
        ]));
    }

    private function resume(?string $tenantId, string $runId): string
    {
        $this->write($tenantId, fn () => DB::connection($this->connectionFor($tenantId))->table('sys_job_runs')->where('id', $runId)
            ->update(['status' => 'en_curso', 'result' => null, 'started_at' => now(), 'finished_at' => null]));

        return $runId;
    }

    private function finish(?string $tenantId, string $runId, object $job, ?string $scheduledJobId, string $status, ?string $result): void
    {
        $result = $result === null ? null : mb_substr($result, 0, 250);

        $this->write($tenantId, function () use ($tenantId, $runId, $job, $scheduledJobId, $status, $result): void {
            $db = DB::connection($this->connectionFor($tenantId));
            $db->table('sys_job_runs')->where('id', $runId)->update(['status' => $status, 'result' => $result, 'finished_at' => now()]);

            $scheduled = $db->table('sys_scheduled_jobs');
            $scheduled = $scheduledJobId !== null
                ? $scheduled->where('id', $scheduledJobId)
                : $scheduled->where('job_class', $job::class)->when($tenantId === null, fn ($query) => $query->whereNull('tenant_id'), fn ($query) => $query->where('tenant_id', $tenantId));
            $scheduled->update(['last_run_at' => now(), 'last_status' => $status, 'last_result' => $result, 'updated_at' => now()]);
        });
    }

    private function connectionFor(?string $tenantId): string
    {
        return $tenantId === null ? 'pgsql_platform' : 'pgsql_audit';
    }

    private function write(?string $tenantId, Closure $fn): mixed
    {
        if ($tenantId === null) {
            return DB::connection('pgsql_platform')->transaction($fn);
        }

        return app(TenantDatabase::class)->run($tenantId, $fn, connection: 'pgsql_audit');
    }
}
