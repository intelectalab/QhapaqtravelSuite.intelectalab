<?php

declare(strict_types=1);

namespace App\Domain\Integrations\Contracts;

use App\Domain\Integrations\Data\AdapterResult;
use App\Domain\Integrations\Data\OutboundMessage;

interface MessagingChannel extends HealthCheckable
{
    public function send(OutboundMessage $message): AdapterResult;

    public function canSendFreeText(string $to): bool;
}
