<?php

declare(strict_types=1);

namespace App\Domain\Shared\Jobs;

use Illuminate\Support\Facades\DB;

final class DefaultScheduledJobs
{
    public function sync(string $tenantId): int
    {
        $existing = DB::table('sys_scheduled_jobs')->where('tenant_id', $tenantId)->pluck('code')->all();
        $created = 0;

        foreach (JobCatalog::TENANT as $code => $job) {
            if (in_array($code, $existing, true)) {
                continue;
            }

            DB::table('sys_scheduled_jobs')->insert([
                'tenant_id' => $tenantId,
                ...$this->values($code, $job),
            ]);
            $created++;
        }

        return $created;
    }

    public function syncPlatform(string $connection = 'pgsql_platform'): int
    {
        $db = DB::connection($connection);
        $existing = $db->table('sys_scheduled_jobs')->whereNull('tenant_id')->pluck('code')->all();
        $created = 0;

        foreach (JobCatalog::PLATFORM as $code => $job) {
            if (in_array($code, $existing, true)) {
                $db->table('sys_scheduled_jobs')->whereNull('tenant_id')->where('code', $code)->where('job_class', '<>', $job['class'])->update(['job_class' => $job['class'], 'updated_at' => now()]);

                continue;
            }

            $db->table('sys_scheduled_jobs')->insert(['tenant_id' => null, ...$this->values($code, $job)]);
            $created++;
        }

        return $created;
    }

    private function values(string $code, array $job): array
    {
        return [
            'code' => $code,
            'name' => $job['name'],
            'job_class' => $job['class'],
            'cron' => $job['cron'],
            'cron_label' => $job['label'],
            'queue' => $job['queue'],
            'paused' => false,
            'is_system' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ];
    }
}
