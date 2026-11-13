<?php

declare(strict_types=1);

namespace App\Domain\Tracking\Contracts;

use App\Domain\Tracking\Fake\FakeTrackingSecretVault;
use Illuminate\Container\Attributes\Bind;

#[Bind(FakeTrackingSecretVault::class)]
interface TrackingSecretVault
{
    public function put(string $reference, string $secret): void;

    public function has(string $reference): bool;
}
