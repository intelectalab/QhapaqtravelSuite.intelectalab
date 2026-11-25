<?php

declare(strict_types=1);

namespace App\Domain\Showcase\Contracts;

use App\Domain\Showcase\Support\DatabaseGatewayCredentialVault;
use Illuminate\Container\Attributes\Bind;

#[Bind(DatabaseGatewayCredentialVault::class)]
interface GatewayCredentialVault
{
    public function put(string $reference, array $secrets): void;

    public function get(string $reference): ?array;

    public function has(string $reference): bool;
}
