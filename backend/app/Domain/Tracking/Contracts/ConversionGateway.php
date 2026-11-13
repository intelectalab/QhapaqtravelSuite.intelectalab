<?php

declare(strict_types=1);

namespace App\Domain\Tracking\Contracts;

use App\Domain\Integrations\Data\AdapterResult;
use App\Domain\Tracking\Fake\FakeConversionGateway;
use Illuminate\Container\Attributes\Bind;

#[Bind(FakeConversionGateway::class)]
interface ConversionGateway
{
    public function send(string $provider, array $payload): AdapterResult;
}
