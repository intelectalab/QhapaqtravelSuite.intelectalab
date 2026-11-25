<?php

declare(strict_types=1);

namespace App\Domain\Integrations\Contracts;

use App\Domain\Integrations\Data\AdapterResult;

interface TravelInventory extends HealthCheckable
{
    public function search(array $criteria): array;

    public function find(string $provider, string $offerRef): ?array;

    public function hold(string $provider, string $offerRef): AdapterResult;

    public function issue(string $provider, string $offerRef, string $idempotencyKey): AdapterResult;

    public function void(string $provider, string $reference): AdapterResult;
}
