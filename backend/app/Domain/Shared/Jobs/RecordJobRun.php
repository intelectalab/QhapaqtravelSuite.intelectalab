<?php

declare(strict_types=1);

namespace App\Domain\Shared\Jobs;

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
    ) {
    }

    public function handle(object $job, Closure $next): mixed
    {
        $tenantId = $this->tenantId ?? (property_exists($job, 'tenantId') ? $job->tenantId : null);
        $attempt = method_exists($job, 'attempts') ? (int) $job->attempts() : 1;

        $runId = $this->write($tenantId, fn () => DB::connection($this->connectionFor($tenantId))->table('sys_job_runs')->insertGetId([
            'tenant_id' => $tenantId,
            'job_class' => mb_substr($job::class, 0, 150),
            'trigger' => $attempt > 1 ? 'retry' : $this->trigger,
            'status' => 'en_curso',
            'started_at' => now(),
            'attempt' => $attempt,
            'correlation_id' => mb_substr(AssignCorrelationId::current(), 0, 40),
        ]));

        try {
            $result = $next($job);
            $warning = property_exists($job, 'runWarning') ? $job->runWarning : null;
            $this->finish($tenantId, (string) $runId, $warning === null ? 'ok' : 'advertencia', $warning);

            return $result;
        } catch (Throwable $e) {
            $this->finish($tenantId, (string) $runId, 'error', class_basename($e).': '.mb_substr($e->getMessage(), 0, 200));
            throw $e;
        }
    }

    private function finish(?string $tenantId, string $runId, string $status, ?string $result): void
    {
        $this->write($tenantId, fn () => DB::connection($this->connectionFor($tenantId))->table('sys_job_runs')->where('id', $runId)->update([
            'status' => $status,
            'result' => $result === null ? null : mb_substr($result, 0, 250),
            'finished_at' => now(),
        ]));
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
