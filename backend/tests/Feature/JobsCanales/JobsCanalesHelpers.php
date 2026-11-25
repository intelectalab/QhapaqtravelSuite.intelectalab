<?php

use App\Jobs\SendNotificationEmail;
use App\Jobs\SendPushNotification;
use App\Jobs\TenantJob;
use Illuminate\Support\Facades\DB;

function canalesJobRun(TenantJob $job): object
{
    $runs = fn () => DB::connection('pgsql_audit')->table('sys_job_runs')->where('tenant_id', tenantA()->getKey())->where('job_class', $job::class);
    $before = $runs()->pluck('id')->all();
    dispatch_sync($job->forTenant((string) tenantA()->getKey()));

    return $runs()->whereNotIn('id', $before)->orderByDesc('id')->first(['status', 'result']);
}

function canalesSideJobs(): array
{
    return [SendNotificationEmail::class, SendPushNotification::class];
}

function canalesNotices(string $event, ?string $sourceId = null, ?string $sourceType = null): int
{
    return withinTenant(tenantA(), fn () => DB::table('notif_messages')->where('event_code', $event)
        ->when($sourceId !== null, fn ($query) => $query->where('source_id', $sourceId))
        ->when($sourceType !== null, fn ($query) => $query->where('source_type', $sourceType))
        ->count());
}
