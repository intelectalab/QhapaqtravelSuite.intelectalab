<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Domain\Shared\Tenancy\Jobs\RestoreTenantContext;
use App\Domain\Shared\Tenancy\Jobs\TenantAware;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Support\Facades\DB;

final class ResumeCampaign implements ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use TenantAware;

    public function __construct(public readonly string $campaignId)
    {
        $this->onQueue('notifications');
    }

    public function middleware(): array
    {
        return [new RestoreTenantContext];
    }

    public function handle(): void
    {
        if (DB::table('mkt_campaigns')->where('id', $this->campaignId)->value('status') !== 'enviando') {
            return;
        }

        dispatch((new SendCampaign($this->campaignId))->forTenant((string) $this->tenantId));
    }
}
