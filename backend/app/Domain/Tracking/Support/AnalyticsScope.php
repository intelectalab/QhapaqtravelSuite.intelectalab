<?php

declare(strict_types=1);

namespace App\Domain\Tracking\Support;

final class AnalyticsScope
{
    private function __construct(
        public readonly string $name,
        public readonly ?string $connection,
        public readonly string $table,
        public readonly ?string $tenantId,
    ) {}

    public static function tenant(string $tenantId): self
    {
        return new self('tenant', null, 'cms_web_analytics_daily', $tenantId);
    }

    public static function platform(): self
    {
        return new self('platform', 'pgsql_platform', 'platform_web_analytics_daily', null);
    }

    public function isPlatform(): bool
    {
        return $this->name === 'platform';
    }

    public function liveKey(?string $site = null): string
    {
        return $this->isPlatform() ? 'platform:'.($site ?? 'todos') : 'tenant:'.$this->tenantId;
    }
}
