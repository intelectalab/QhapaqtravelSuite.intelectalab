<?php

declare(strict_types=1);

namespace App\Domain\Integrations\Contracts;

use App\Domain\Integrations\Data\AdapterResult;

interface PushSender extends HealthCheckable
{
    public function send(array $tokens, string $title, string $body, array $data = []): AdapterResult;
}
