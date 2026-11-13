<?php

declare(strict_types=1);

namespace App\Domain\Tracking\Fake;

use App\Domain\Tracking\Contracts\TrackingSecretVault;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Crypt;

final class FakeTrackingSecretVault implements TrackingSecretVault
{
    public function put(string $reference, string $secret): void
    {
        Cache::forever($this->key($reference), Crypt::encryptString($secret));
    }

    public function has(string $reference): bool
    {
        return Cache::has($this->key($reference));
    }

    private function key(string $reference): string
    {
        return 'tracking-vault:'.hash('sha256', $reference);
    }
}
