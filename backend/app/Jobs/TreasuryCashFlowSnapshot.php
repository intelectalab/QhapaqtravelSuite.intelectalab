<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Domain\Finance\Support\TreasuryDirectory;
use App\Domain\Shared\Tenancy\TenantContext;
use Illuminate\Support\Facades\Cache;

final class TreasuryCashFlowSnapshot extends TenantJob
{
    public const QUEUE = 'reports';

    protected function run(): string
    {
        $flow = app(TreasuryDirectory::class)->cashFlow();
        Cache::put(TreasuryDirectory::snapshotKey(app(TenantContext::class)->idOrFail()), ['taken_at' => now()->toIso8601String(), ...$flow], now()->addHours(26));
        $risk = $flow['risk'];

        return $risk === null
            ? 'Proyección guardada · sin déficit a 90 días'
            : $this->warn("Proyección guardada · saldo negativo en el horizonte de {$risk['label']}");
    }
}
