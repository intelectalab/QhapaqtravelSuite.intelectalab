<?php

declare(strict_types=1);

namespace App\Domain\Tracking\Contracts;

use App\Domain\Tracking\Support\DatabaseTrackingSecretVault;
use Illuminate\Container\Attributes\Bind;

#[Bind(DatabaseTrackingSecretVault::class)]
interface TrackingSecretVault
{
    public function put(string $reference, string $secret): void;

    public function get(string $reference): ?string;

    public function has(string $reference): bool;
}
