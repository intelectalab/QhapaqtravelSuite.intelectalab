<?php

declare(strict_types=1);

namespace App\Domain\Integrations\Contracts;

interface DnsResolver
{
    public function txt(string $host): array;
}
