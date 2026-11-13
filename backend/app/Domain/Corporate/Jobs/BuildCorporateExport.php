<?php

declare(strict_types=1);

namespace App\Domain\Corporate\Jobs;

use App\Domain\Corporate\Actions\CorporateExports;
use App\Domain\Shared\Tenancy\Jobs\TenantAware;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;

final class BuildCorporateExport implements ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use TenantAware;

    public int $tries = 1;

    public function __construct(public readonly string $exportId)
    {
        $this->onQueue('reports');
    }

    public function handle(CorporateExports $exports): void
    {
        $exports->build($this->exportId);
    }
}
