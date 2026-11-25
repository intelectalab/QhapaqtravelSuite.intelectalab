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
        public readonly string $hits,
    ) {}

    public static function tenant(string $tenantId): self
    {
        return new self('tenant', null, 'cms_web_analytics_daily', $tenantId, 'cms_web_analytics_hits');
    }

    public static function platform(): self
    {
        return new self('platform', 'pgsql_platform', 'platform_web_analytics_daily', null, 'platform_web_analytics_hits');
    }

    public function isPlatform(): bool
    {
        return $this->name === 'platform';
    }

    public function dimensions(): array
    {
        return $this->isPlatform() ? ['day', 'site', 'path', 'agency_id', 'source', 'medium', 'campaign', 'device', 'country'] : ['day', 'path', 'source', 'medium', 'campaign', 'device', 'country'];
    }

    public function liveKey(?string $site = null): string
    {
        return $this->isPlatform() ? 'platform:'.($site ?? 'todos') : 'tenant:'.$this->tenantId;
    }
}
