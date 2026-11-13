<?php

declare(strict_types=1);

namespace App\Domain\Integrations\Contracts;

use App\Domain\Integrations\Data\AdapterResult;

interface OtaConnector extends HealthCheckable
{
    public function verify(string $ota, string $accountRef, string $credentials): AdapterResult;

    public function pushAvailability(string $ota, string $accountRef, string $credentials, array $listings): AdapterResult;
}
