<?php

declare(strict_types=1);

namespace App\Domain\Integrations\Contracts;

interface FxRateProvider extends HealthCheckable
{
    public function latest(array $currencies, string $date): array;
}
