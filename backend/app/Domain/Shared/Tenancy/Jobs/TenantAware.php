<?php

declare(strict_types=1);

namespace App\Domain\Shared\Tenancy\Jobs;

use App\Domain\Shared\Tenancy\TenantContext;

trait TenantAware
{
    public ?string $tenantId = null;

    public function captureTenant(): static
    {
        $this->tenantId ??= app(TenantContext::class)->id();

        return $this;
    }

    public function forTenant(string $tenantId): static
    {
        $this->tenantId = $tenantId;

        return $this;
    }

    public function middleware(): array
    {
        return $this->tenantMiddleware();
    }

    protected function tenantMiddleware(): array
    {
        return [new RestoreTenantContext()];
    }
}
