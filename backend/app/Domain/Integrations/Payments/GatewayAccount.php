<?php

declare(strict_types=1);

namespace App\Domain\Integrations\Payments;

final readonly class GatewayAccount
{
    public function __construct(
        public string $id,
        public string $tenantId,
        public string $provider,
        public string $mode,
        public string $currency,
        public array $secrets,
        public ?string $webhookUrl = null,
    ) {}

    public function sandbox(): bool
    {
        return $this->mode !== 'produccion';
    }

    public function secret(string $key): string
    {
        return trim((string) ($this->secrets[$key] ?? ''));
    }
}
