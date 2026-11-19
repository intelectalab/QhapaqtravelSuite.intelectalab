<?php

declare(strict_types=1);

namespace App\Domain\Integrations\Adapters;

use App\Domain\Integrations\Contracts\DnsResolver;

final class SystemDnsResolver implements DnsResolver
{
    public function txt(string $host): array
    {
        $records = @dns_get_record(rtrim($host, '.').'.', DNS_TXT);

        if (! is_array($records)) {
            return [];
        }

        return array_values(array_filter(array_map(
            fn (array $record): string => trim((string) ($record['txt'] ?? implode('', (array) ($record['entries'] ?? [])))),
            $records,
        ), fn (string $value): bool => $value !== ''));
    }
}
