<?php

declare(strict_types=1);

namespace App\Domain\Integrations\Contracts;

use App\Domain\Integrations\Data\AdapterResult;

interface HealthCheckable
{
    public function healthcheck(): AdapterResult;
}
