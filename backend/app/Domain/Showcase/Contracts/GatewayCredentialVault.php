<?php

declare(strict_types=1);

namespace App\Domain\Showcase\Contracts;

use App\Domain\Showcase\Fake\FakeGatewayCredentialVault;
use Illuminate\Container\Attributes\Bind;

#[Bind(FakeGatewayCredentialVault::class)]
interface GatewayCredentialVault
{
    public function put(string $reference, array $secrets): void;

    public function has(string $reference): bool;
}
