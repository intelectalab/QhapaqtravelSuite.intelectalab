<?php

declare(strict_types=1);

namespace App\Domain\Landing\Contracts;

use App\Domain\Integrations\Data\AdapterResult;
use App\Domain\Landing\Fake\FakePlatformCheckoutGateway;
use Illuminate\Container\Attributes\Bind;

#[Bind(FakePlatformCheckoutGateway::class)]
interface PlatformCheckoutGateway
{
    public function charge(string $reference, string $amount, string $currency, string $method, array $payment): AdapterResult;
}
