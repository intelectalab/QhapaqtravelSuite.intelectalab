<?php

declare(strict_types=1);

namespace App\Domain\Integrations\Contracts;

use App\Domain\Integrations\Data\AdapterResult;

interface WhatsappCloud extends HealthCheckable
{
    public function verifyApp(string $appId, string $appSecret, string $apiVersion): AdapterResult;

    public function exchangeSignup(string $code, string $appId, string $appSecret): AdapterResult;

    public function verifyNumber(string $phoneNumberId, string $accessToken): AdapterResult;
}
