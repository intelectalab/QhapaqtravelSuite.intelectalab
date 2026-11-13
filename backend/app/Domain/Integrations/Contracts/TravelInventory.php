<?php

declare(strict_types=1);

namespace App\Domain\Integrations\Contracts;

interface TravelInventory extends HealthCheckable
{
    public function search(array $criteria): array;

    public function find(string $provider, string $offerRef): ?array;
}
