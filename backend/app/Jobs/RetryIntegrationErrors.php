<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Domain\Admin\Actions\ManageIntegrations;
use App\Domain\Admin\Support\IntegrationErrors;
use App\Domain\Shared\Jobs\JobCatalog;
use Illuminate\Support\Facades\DB;

final class RetryIntegrationErrors extends TenantJob
{
    public const QUEUE = 'integrations';

    protected function run(): string
    {
        $due = DB::table('integration_errors')->where('status', 'reintentando')->whereNotNull('next_retry_at')->where('next_retry_at', '<=', now())
            ->where(fn ($query) => $query->where('source', '<>', 'job')->orWhere('attempt', 0))
            ->orderBy('next_retry_at')->limit(50)->lockForUpdate()->get(['id', 'source', 'ref_code', 'target', 'attempt', 'max_attempts']);

        if ($due->isEmpty()) {
            return 'Sin reintentos pendientes';
        }

        $counts = ['job' => 0, 'notification' => 0, 'integration' => 0];

        foreach ($due as $error) {
            DB::table('integration_errors')->where('id', $error->id)->update(['next_retry_at' => null, 'updated_at' => now()]);
            $counts[$error->source] += match ($error->source) {
                'job' => $this->job($error),
                'notification' => $this->notification($error),
                default => $this->integration($error),
            };
        }

        return self::summary([
            $counts['job'] ? self::plural($counts['job'], 'proceso relanzado', 'procesos relanzados') : null,
            $counts['notification'] ? self::plural($counts['notification'], 'mensaje reenviado', 'mensajes reenviados') : null,
            $counts['integration'] ? self::plural($counts['integration'], 'integración probada', 'integraciones probadas') : null,
        ], 'Sin reintentos aplicables');
    }

    private function job(object $error): int
    {
        $job = DB::table('sys_scheduled_jobs')->where('code', $error->ref_code)->first(['id', 'job_class', 'queue']);
        $class = $job->job_class ?? (JobCatalog::TENANT[$error->ref_code]['class'] ?? null);

        if ($job === null || ! is_string($class) || ! is_subclass_of($class, TenantJob::class) || $class === self::class) {
            return 0;
        }

        dispatch((new $class)->forTenant((string) $this->tenantId)->scheduled((string) $job->id, 'retry')->onQueue((string) ($job->queue ?: $class::QUEUE)))->afterCommit();

        return 1;
    }

    private function notification(object $error): int
    {
        $ref = (string) $error->ref_code;
        $message = DB::table('notif_messages')->whereIn('status', ['fallido', 'pendiente'])
            ->where(fn ($query) => str_starts_with($ref, 'MSG-') ? $query->whereRaw('id::text like ?', ['%'.substr($ref, 4)]) : $query->where('code', $ref))
            ->first(['id', 'channel']);

        if ($message === null) {
            return 0;
        }

        DB::table('notif_messages')->where('id', $message->id)->update(['status' => 'pendiente', 'last_error' => null]);
        RetryNotificationMessage::for($message, (string) $this->tenantId);

        return 1;
    }

    private function integration(object $error): int
    {
        $test = app(ManageIntegrations::class)->test((string) $error->ref_code);

        if ($test['ok']) {
            IntegrationErrors::resolve($this->tenantId, 'integration', (string) $error->ref_code);
        } else {
            IntegrationErrors::record($this->tenantId, 'integration', (string) $error->ref_code, (string) $error->target, (string) $test['result'], (int) $error->attempt + 1, (int) $error->max_attempts);
        }

        return 1;
    }
}
