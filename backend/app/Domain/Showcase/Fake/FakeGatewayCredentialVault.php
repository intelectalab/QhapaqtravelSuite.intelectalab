<?php

declare(strict_types=1);

namespace App\Domain\Showcase\Fake;

use App\Domain\Showcase\Contracts\GatewayCredentialVault;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Crypt;

final class FakeGatewayCredentialVault implements GatewayCredentialVault
{
    public function put(string $reference, array $secrets): void
    {
        Cache::forever($this->key($reference), Crypt::encryptString((string) json_encode($secrets)));
    }

    public function has(string $reference): bool
    {
        return Cache::has($this->key($reference));
    }

    private function key(string $reference): string
    {
        return 'gateway-vault:'.hash('sha256', $reference);
    }
}
