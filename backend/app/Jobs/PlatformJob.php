<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Domain\Shared\Jobs\RecordJobRun;
use Carbon\CarbonImmutable;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;

abstract class PlatformJob implements ShouldBeUnique, ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;

    public const QUEUE = 'low';

    public int $tries = 3;

    public int $uniqueFor = 3600;

    public ?string $tenantId = null;

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
        return [60, 300, 900];
    }

    public function middleware(): array
    {
        return [new RecordJobRun($this->trigger)];
    }

    protected function warn(string $message): string
    {
        $this->runWarning = $message;

        return $message;
    }

    protected function today(): CarbonImmutable
    {
        return CarbonImmutable::now('America/Lima')->startOfDay();
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

    public function scheduled(string $scheduledJobId, string $trigger = 'schedule', ?string $runId = null): static
    {
        $this->scheduledJobId = $scheduledJobId;
        $this->trigger = $trigger;
        $this->runId = $runId;

        return $this;
    }
}
