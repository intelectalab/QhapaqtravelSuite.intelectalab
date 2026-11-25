<?php

declare(strict_types=1);

namespace App\Domain\Showcase\Support;

use App\Domain\Shared\Vault\EncryptedVaultStore;
use App\Domain\Showcase\Contracts\GatewayCredentialVault;

final class DatabaseGatewayCredentialVault implements GatewayCredentialVault
{
    public function __construct(private readonly EncryptedVaultStore $store) {}

    public function put(string $reference, array $secrets): void
    {
        $this->store->put('pasarela', $reference, (string) json_encode($secrets, JSON_THROW_ON_ERROR));
    }

    public function get(string $reference): ?array
    {
        $plain = $this->store->get($reference);

        return $plain === null ? null : (array) json_decode($plain, true, 512, JSON_THROW_ON_ERROR);
    }

    public function has(string $reference): bool
    {
        return $this->store->has($reference);
    }
}
