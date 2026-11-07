<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Domain\Platform\Models\Tenant;
use App\Domain\Shared\Tenancy\TenantContext;
use App\Domain\Shared\Tenancy\TenantDatabase;
use App\Jobs\PlatformJob;
use App\Jobs\TenantJob;
use Carbon\CarbonImmutable;
use Cron\CronExpression;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Throwable;

final class RunDueJobs extends Command
{
    protected $signature = 'jobs:run-due {--at= : Momento a evaluar (por defecto, ahora)} {--tenant= : Código de una sola agencia}';

    protected $description = 'Encola los procesos programados que tocan ahora, por agencia y según su cron y su zona horaria';

    public function handle(TenantDatabase $database, TenantContext $context): int
    {
        $now = $this->option('at') ? CarbonImmutable::parse((string) $this->option('at')) : CarbonImmutable::now();
        $queued = 0;

        $tenants = Tenant::on('pgsql_platform')
            ->whereIn('status', ['activo', 'prueba'])
            ->when($this->option('tenant'), fn ($query, $code) => $query->where('code', $code))
            ->get(['id', 'code', 'timezone']);

        foreach ($tenants as $tenant) {
            $tenantId = (string) $tenant->getKey();
            $local = $now->setTimezone($tenant->timezone ?: 'America/Lima');
            $queued += (int) $database->run($tenantId, fn (): int => $this->dispatchDue(
                DB::table('sys_scheduled_jobs')->where('tenant_id', $tenantId),
                $local,
                fn (string $class, object $job): TenantJob => (new $class)->forTenant($tenantId)->scheduled((string) $job->id),
                TenantJob::class,
                DB::connection(),
            ));
        }

        $context->clear();

        if (! $this->option('tenant')) {
            $platform = DB::connection('pgsql_platform');
            $queued += $platform->transaction(fn (): int => $this->dispatchDue(
                $platform->table('sys_scheduled_jobs')->whereNull('tenant_id'),
                $now->setTimezone('America/Lima'),
                fn (string $class, object $job): PlatformJob => (new $class)->scheduled((string) $job->id),
                PlatformJob::class,
                $platform,
            ));
        }

        $this->line("{$queued} proceso(s) en cola.");

        return self::SUCCESS;
    }

    private function dispatchDue($query, CarbonImmutable $local, callable $make, string $base, $connection): int
    {
        $queued = 0;

        foreach ($query->where('paused', false)->get(['id', 'code', 'job_class', 'cron', 'queue']) as $job) {
            if (! class_exists($job->job_class) || ! is_subclass_of($job->job_class, $base)) {
                continue;
            }

            try {
                $cron = new CronExpression((string) $job->cron);
            } catch (Throwable) {
                continue;
            }

            if ($cron->isDue($local)) {
                dispatch($make($job->job_class, $job)->onQueue($job->queue))->afterCommit();
                $queued++;
            }

            $connection->table('sys_scheduled_jobs')->where('id', $job->id)->update([
                'next_run_at' => CarbonImmutable::instance($cron->getNextRunDate($local))->utc(),
                'updated_at' => now(),
            ]);
        }

        return $queued;
    }
}
