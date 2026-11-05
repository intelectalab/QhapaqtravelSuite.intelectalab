<?php

declare(strict_types=1);

namespace App\Domain\Integrations\Contracts;

use App\Domain\Integrations\Data\FxRate;

interface FxRateProvider extends HealthCheckable
{
    public function latest(array $currencies, string $date): array;
}
