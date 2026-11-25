<?php

declare(strict_types=1);

namespace App\Domain\Integrations\Contracts;

use App\Domain\Integrations\Data\PaymentEvent;
use App\Domain\Integrations\Data\PaymentWebhook;

interface PaymentConnector extends PaymentGateway
{
    public function name(): string;

    public function webhook(PaymentWebhook $hook): ?PaymentEvent;
}
