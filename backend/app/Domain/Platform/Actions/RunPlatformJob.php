<?php

declare(strict_types=1);

namespace App\Domain\Platform\Actions;

use App\Domain\Platform\Models\PlatformUser;
use App\Domain\Shared\Errors\ApiException;
use App\Jobs\PlatformJob;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Support\Facades\DB;
use Throwable;

final class RunPlatformJob
{
    private const CONNECTION = 'pgsql_platform';

    public function __construct(private readonly PlatformSession $session) {}

    public function run(string $code, PlatformUser $actor): string
    {
        $job = $this->job($code);

        if (! class_exists((string) $job->job_class) || ! is_subclass_of((string) $job->job_class, PlatformJob::class)) {
            throw ApiException::conflict('JOB_NOT_RUNNABLE', 'Esta tarea solo corre en su horario programado.');
        }

        if ($job->paused) {
            throw ApiException::conflict('JOB_PAUSED', 'La tarea está pausada. Reanúdala antes de ejecutarla.');
        }

        $class = (string) $job->job_class;

        try {
            dispatch_sync((new $class)->scheduled((string) $job->id, 'manual'));
        } catch (Throwable $e) {
            report($e);
        }

        $result = (string) $this->db()->table('sys_scheduled_jobs')->where('id', $job->id)->value('last_result');
        $this->session->log('Job', $class, 'ejecutar', null, $result, $actor);

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

    private function job(string $code): object
    {
        return $this->db()->table('sys_scheduled_jobs')->whereNull('tenant_id')->where('code', $code)->first() ?? throw ApiException::notFound('La tarea no existe.');
    }

    private function db(): ConnectionInterface
    {
        return DB::connection(self::CONNECTION);
    }
}
