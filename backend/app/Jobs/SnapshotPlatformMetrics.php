<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Domain\Platform\Support\BillingMetrics;

final class SnapshotPlatformMetrics extends PlatformJob
{
    public const QUEUE = 'reports';

    protected function run(): string
    {
        $metrics = app(BillingMetrics::class);
        $snapshot = $metrics->snapshot();
        $metrics->storeSnapshot($snapshot);

        return 'MRR S/ '.number_format((float) $snapshot['mrr'], 0, '.', ' ').' · '.self::plural((int) $snapshot['active_tenants'], 'agencia que paga', 'agencias que pagan');
    }
}
