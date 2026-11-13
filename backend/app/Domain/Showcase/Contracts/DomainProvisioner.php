<?php

declare(strict_types=1);

namespace App\Domain\Showcase\Contracts;

use App\Domain\Showcase\Fake\FakeDomainProvisioner;
use Illuminate\Container\Attributes\Bind;

#[Bind(FakeDomainProvisioner::class)]
interface DomainProvisioner
{
    public function verify(string $host, string $token): array;

    public function issueCertificate(string $host): array;
}
