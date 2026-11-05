<?php

declare(strict_types=1);

namespace App\Domain\Shared\Tenancy;

use App\Domain\Platform\Models\Tenant;
use App\Domain\Shared\Errors\ApiException;

final class TenantContext
{
    private ?string $tenantId = null;

    private ?Tenant $tenant = null;

    public function set(Tenant|string $tenant): void
    {
        if ($tenant instanceof Tenant) {
            $this->tenant = $tenant;
            $this->tenantId = (string) $tenant->getKey();

            return;
        }

        $this->tenant = null;
        $this->tenantId = $tenant;
    }

    public function clear(): void
    {
        $this->tenant = null;
        $this->tenantId = null;
    }

    public function has(): bool
    {
        return $this->tenantId !== null;
    }

    public function id(): ?string
    {
        return $this->tenantId;
    }

    public function idOrFail(): string
    {
        return $this->tenantId ?? throw ApiException::forbidden(
            'TENANT_REQUIRED',
            'La solicitud no tiene un tenant válido.',
        );
    }

    public function tenant(): Tenant
    {
        if ($this->tenant === null) {
            $this->tenant = Tenant::query()->findOrFail($this->idOrFail());
        }

        return $this->tenant;
    }

    public function timezone(): string
    {
        return $this->tenant()->timezone ?? 'America/Lima';
    }

    public function key(string|int ...$parts): string
    {
        return 't:'.$this->idOrFail().':'.implode(':', $parts);
    }
}
