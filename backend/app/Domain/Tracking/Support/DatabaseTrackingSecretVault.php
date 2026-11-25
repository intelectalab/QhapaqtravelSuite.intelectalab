<?php

declare(strict_types=1);

namespace App\Domain\Tracking\Support;

use App\Domain\Shared\Vault\EncryptedVaultStore;
use App\Domain\Tracking\Contracts\TrackingSecretVault;

final class DatabaseTrackingSecretVault implements TrackingSecretVault
{
    public function __construct(private readonly EncryptedVaultStore $store) {}

    public function put(string $reference, string $secret): void
    {
        $this->store->put('seguimiento', $reference, $secret);
    }

    public function get(string $reference): ?string
    {
        return $this->store->get($reference);
    }

    public function has(string $reference): bool
    {
        return $this->store->has($reference);
    }
}
