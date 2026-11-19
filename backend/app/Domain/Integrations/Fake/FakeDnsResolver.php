<?php

declare(strict_types=1);

namespace App\Domain\Integrations\Fake;

use App\Domain\Integrations\Contracts\DnsResolver;

final class FakeDnsResolver implements DnsResolver
{
    private array $records = [];

    public array $lookups = [];

    public function put(string $host, string ...$values): self
    {
        $this->records[mb_strtolower($host)] = $values;

        return $this;
    }

    public function forget(string $host): self
    {
        unset($this->records[mb_strtolower($host)]);

        return $this;
    }

    public function txt(string $host): array
    {
        $this->lookups[] = mb_strtolower($host);

        return $this->records[mb_strtolower($host)] ?? [];
    }
}
