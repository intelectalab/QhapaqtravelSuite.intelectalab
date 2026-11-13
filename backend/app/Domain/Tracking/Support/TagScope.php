<?php

declare(strict_types=1);

namespace App\Domain\Tracking\Support;

use Illuminate\Database\ConnectionInterface;
use Illuminate\Support\Facades\DB;

final class TagScope
{
    private function __construct(
        public readonly string $name,
        public readonly ?string $connection,
        public readonly string $tags,
        public readonly string $mappings,
        public readonly string $dispatches,
        public readonly string $prefix,
        public readonly string $entity,
        public readonly string $scriptEntity,
    ) {}

    public static function tenant(): self
    {
        return new self('tenant', null, 'mkt_tracking_tags', 'mkt_conversion_mappings', 'mkt_conversion_dispatches', 'TAG-', 'Etiqueta', 'Script propio');
    }

    public static function platform(): self
    {
        return new self('platform', 'pgsql_platform', 'platform_tracking_tags', 'platform_conversion_mappings', 'platform_conversion_dispatches', 'PTG-', 'Etiqueta vitrina', 'Script vitrina');
    }

    public function isPlatform(): bool
    {
        return $this->name === 'platform';
    }

    public function events(): array
    {
        return $this->isPlatform() ? TrackingCatalog::PLATFORM_EVENTS : TrackingCatalog::TENANT_EVENTS;
    }

    public function needsReview(string $provider): bool
    {
        return $this->isPlatform() || $provider === 'script';
    }

    public function entityFor(string $provider): string
    {
        return $provider === 'script' ? $this->scriptEntity : $this->entity;
    }

    public function db(): ConnectionInterface
    {
        return DB::connection($this->connection);
    }
}
