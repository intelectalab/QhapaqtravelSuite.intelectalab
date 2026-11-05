<?php

declare(strict_types=1);

namespace App\Domain\Shared\Tenancy\Jobs;

use App\Domain\Shared\Tenancy\TenantContext;
use App\Domain\Shared\Tenancy\TenantDatabase;
use Closure;
use Illuminate\Support\Facades\Log;
use RuntimeException;

final class RestoreTenantContext
{
    public function __construct(private readonly ?string $tenantId = null)
    {
    }

    public function handle(object $job, Closure $next): mixed
    {
        $tenantId = $this->tenantId ?? (property_exists($job, 'tenantId') ? $job->tenantId : null);

        if (! is_string($tenantId) || $tenantId === '') {
            throw new RuntimeException('Job sin tenant serializado: '.$job::class.' (usar TenantAware::captureTenant()).');
        }

        $context = app(TenantContext::class);
        Log::withContext(['tenant_id' => $tenantId, 'job' => $job::class]);

        try {
            return app(TenantDatabase::class)->run($tenantId, fn () => $next($job));
        } finally {
            $context->clear();
        }
    }
}
