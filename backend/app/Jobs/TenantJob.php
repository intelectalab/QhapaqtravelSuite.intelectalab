<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Domain\Admin\Support\AdapterRetryPolicy;
use App\Domain\Shared\Jobs\RecordJobRun;
use App\Domain\Shared\Tenancy\Jobs\RestoreTenantContext;
use App\Domain\Shared\Tenancy\Jobs\TenantAware;
use App\Domain\Shared\Tenancy\TenantContext;
use Carbon\CarbonImmutable;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Support\Facades\DB;

abstract class TenantJob implements ShouldBeUnique, ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use TenantAware;

    public const QUEUE = 'default';

    public int $tries = 5;

    public int $uniqueFor = 600;

    public ?string $scheduledJobId = null;

    public ?string $runId = null;

    public string $trigger = 'schedule';

    public ?string $runResult = null;

    public ?string $runWarning = null;

    final public function __construct()
    {
        $this->onQueue(static::QUEUE);
    }

    abstract protected function run(): string;

    public function handle(): void
    {
        $this->runResult = $this->run();
    }

    public function backoff(): array
    {
        return AdapterRetryPolicy::delays(AdapterRetryPolicy::BASE_SECONDS, $this->tries);
    }

    public function uniqueId(): string
    {
        return $this->tenantId.':'.($this->runId ?? 'schedule');
    }

    public function middleware(): array
    {
        return [new RecordJobRun($this->trigger), new RestoreTenantContext];
    }

    public function scheduled(string $scheduledJobId, string $trigger = 'schedule', ?string $runId = null): static
    {
        $this->scheduledJobId = $scheduledJobId;
        $this->trigger = $trigger;
        $this->runId = $runId;

        return $this;
    }

    protected function warn(string $message): string
    {
        $this->runWarning = $message;

        return $message;
    }

    protected function today(): CarbonImmutable
    {
        return CarbonImmutable::now(app(TenantContext::class)->timezone())->startOfDay();
    }

    protected function setting(string $section, string $key, int $default): int
    {
        $values = (array) json_decode((string) DB::table('sys_settings')->where('section', $section)->value('values'), true);

        return is_numeric($values[$key] ?? null) ? (int) $values[$key] : $default;
    }

    protected static function plural(int $count, string $one, string $many): string
    {
        return $count.' '.($count === 1 ? $one : $many);
    }

    protected static function summary(array $parts, string $empty): string
    {
        $parts = array_values(array_filter($parts));

        return $parts === [] ? $empty : implode(' · ', $parts);
    }
}
