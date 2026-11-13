<?php

declare(strict_types=1);

namespace App\Domain\Integrations\Contracts;

interface AccountingGateway extends HealthCheckable
{
    public function render(string $target, array $entries): array;
}
