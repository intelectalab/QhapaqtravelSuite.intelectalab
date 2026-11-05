<?php

declare(strict_types=1);

namespace App\Domain\Integrations\Contracts;

use App\Domain\Integrations\Data\AdapterResult;
use App\Domain\Integrations\Data\PaymentRequest;

interface PaymentGateway extends HealthCheckable
{
    public function createCharge(PaymentRequest $request): AdapterResult;

    public function refund(string $externalId, string $amount, string $currency, string $reason): AdapterResult;

    public function verifyWebhook(string $rawBody, string $signature): bool;
}
