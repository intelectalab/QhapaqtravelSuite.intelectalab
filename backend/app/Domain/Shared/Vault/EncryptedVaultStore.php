<?php

declare(strict_types=1);

namespace App\Domain\Shared\Vault;

use Illuminate\Database\ConnectionInterface;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;

final class EncryptedVaultStore
{
    private const PLATFORM_PREFIX = 'vault://platform/';

    public function put(string $kind, string $reference, string $plain): void
    {
        $this->connection($reference)->table($this->table($reference))->upsert(
            [['reference' => $reference, 'kind' => $kind, 'payload' => Crypt::encryptString($plain), 'updated_at' => now()]],
            $this->isPlatform($reference) ? ['reference'] : ['tenant_id', 'reference'],
            ['payload', 'kind', 'updated_at'],
        );
    }

    public function get(string $reference): ?string
    {
        $payload = $this->connection($reference)->table($this->table($reference))->where('reference', $reference)->value('payload');

        return $payload === null ? null : Crypt::decryptString((string) $payload);
    }

    public function has(string $reference): bool
    {
        return $this->connection($reference)->table($this->table($reference))->where('reference', $reference)->exists();
    }

    private function isPlatform(string $reference): bool
    {
        return str_starts_with($reference, self::PLATFORM_PREFIX);
    }

    private function table(string $reference): string
    {
        return $this->isPlatform($reference) ? 'platform_vault_secrets' : 'integration_vault_secrets';
    }

    private function connection(string $reference): ConnectionInterface
    {
        return $this->isPlatform($reference) ? DB::connection('pgsql_platform') : DB::connection();
    }
}
