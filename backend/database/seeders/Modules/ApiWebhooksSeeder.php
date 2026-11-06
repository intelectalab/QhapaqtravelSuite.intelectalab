<?php

declare(strict_types=1);

namespace Database\Seeders\Modules;

use App\Domain\Admin\Support\PgArray;
use App\Domain\Platform\Models\Tenant;
use Database\Support\KitSeeds;
use Database\Support\SeedsTenant;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class ApiWebhooksSeeder
{
    use SeedsTenant;

    private const KEY_STATUS = ['activa' => 'active', 'revocada' => 'revoked', 'vencida' => 'expired'];

    private const HOOK_STATUS = ['activo' => 'active', 'pausado' => 'paused', 'deshabilitado' => 'disabled'];

    private const DELIVERY_STATUS = ['entregado' => 'delivered', 'reintentando' => 'retrying', 'fallido' => 'failed', 'pendiente' => 'pending'];

    public function __construct(private readonly Tenant $tenant) {}

    protected function tenant(): Tenant
    {
        return $this->tenant;
    }

    public function run(): void
    {
        $this->keys();
        $hooks = $this->webhooks();
        $this->deliveries($hooks);
        $this->oauthApps();
    }

    private function mine(string $name): array
    {
        return array_values(array_filter(KitSeeds::read($name), fn (array $row): bool => ($row['tenantId'] ?? $this->tenant->code) === $this->tenant->code));
    }

    private function keys(): void
    {
        foreach ($this->mine('apiKeys') as $row) {
            $expires = $this->day($row['expiresAt']);
            $status = self::KEY_STATUS[$row['status']] ?? 'active';

            if ($status === 'active' && $expires !== null && $expires < Carbon::today()->toDateString()) {
                $status = 'expired';
            }

            $this->upsert('integration_api_keys', ['code' => $row['id']], [
                'name' => $row['name'],
                'environment' => $row['env'],
                'prefix' => $row['prefix'],
                'last4' => $row['last4'],
                'token_hash' => hash('sha256', $row['id'].$row['prefix'].$row['last4']),
                'scopes' => PgArray::from($row['scopes']),
                'ip_allowlist' => $row['ipAllow'] ? PgArray::from(array_map(fn (string $ip): string => str_contains($ip, '/') ? $ip : $ip.'/32', explode(',', $row['ipAllow']))) : null,
                'expires_at' => $expires,
                'last_used_at' => $this->moment($row['lastUsedAt']),
                'last_used_ip' => $row['lastIp'] ?: null,
                'status' => $status,
                'revoked_at' => $this->moment($row['revokedAt'] ?? null),
                'revoked_by' => isset($row['revokedBy']) ? $this->userId($row['revokedBy']) : null,
                'revoke_reason' => $row['revokeReason'] ?? null,
                'created_by' => $this->userId($row['createdBy']),
                'created_at' => $this->moment($row['createdAt']),
            ]);
        }
    }

    private function webhooks(): array
    {
        $ids = [];

        foreach ($this->mine('webhooks') as $row) {
            $existing = DB::table('integration_webhooks')->where('tenant_id', $this->tenant->getKey())->where('code', $row['id'])->value('secret_encrypted');
            $ids[$row['id']] = $this->upsert('integration_webhooks', ['code' => $row['id']], [
                'url' => $row['url'],
                'description' => $row['description'],
                'events' => PgArray::from($row['events']),
                'secret_encrypted' => $existing ?? Crypt::encryptString($row['secretPrefix'].Str::random(28)),
                'secret_prefix' => $row['secretPrefix'],
                'api_version' => $row['apiVersion'],
                'status' => self::HOOK_STATUS[$row['status']] ?? 'active',
                'consecutive_failures' => $row['consecutiveFailures'],
                'created_by' => $this->userId($row['createdBy']),
                'updated_by' => $this->userId($row['pausedBy'] ?? $row['createdBy']),
                'created_at' => $this->moment($row['createdAt']),
                'updated_at' => $this->moment($row['pausedAt'] ?? $row['secretRotatedAt'] ?? $row['createdAt']),
            ]);
        }

        return $ids;
    }

    private function deliveries(array $hooks): void
    {
        foreach (KitSeeds::read('webhookDeliveries') as $row) {
            $hook = $hooks[$row['webhookId']] ?? null;

            if ($hook === null) {
                continue;
            }

            $status = self::DELIVERY_STATUS[$row['status']] ?? 'pending';
            $code = (int) $row['code'];
            $this->upsert('integration_webhook_deliveries', ['code' => $row['id']], [
                'webhook_id' => $hook,
                'event_type' => $row['event'],
                'event_id' => $row['eventId'],
                'entity_code' => $row['entityId'],
                'payload' => json_encode(['id' => $row['eventId'], 'type' => $row['event'], 'data' => ['code' => $row['entityId']]], JSON_UNESCAPED_UNICODE),
                'attempt' => $row['attempt'],
                'status' => $status,
                'http_status' => $code > 0 ? $code : null,
                'duration_ms' => $row['ms'],
                'error' => match (true) {
                    $code === 0 => 'Tiempo de espera agotado (30 s).',
                    $code >= 400 => "El destino respondió {$code}.",
                    default => null,
                },
                'next_retry_at' => $this->moment($row['nextRetryAt']),
                'created_at' => $this->moment($row['ts']),
            ]);
        }
    }

    private function oauthApps(): void
    {
        foreach ($this->mine('oauthApps') as $row) {
            $app = DB::table('integration_oauth_apps')->where('tenant_id', $this->tenant->getKey())->where('vendor', $row['vendor'])->first(['id', 'client_id']);
            $client = [
                'name' => $row['name'],
                'provider' => null,
                'redirect_uris' => json_encode($row['redirectUris']),
                'grant_types' => json_encode(['authorization_code', 'refresh_token']),
                'revoked' => $row['status'] !== 'activa',
                'created_by' => $this->userId($row['createdBy']),
                'updated_at' => $this->moment($row['lastTokenAt'] ?? $row['createdAt']),
            ];

            if ($app) {
                DB::table('oauth_clients')->where('id', $app->client_id)->update($client);
                DB::table('integration_oauth_apps')->where('id', $app->id)->update(['allowed_scopes' => PgArray::from($row['scopes']), 'status' => $row['status'] === 'activa' ? 'active' : 'revoked']);

                continue;
            }

            $clientId = (string) Str::uuid7();
            DB::table('oauth_clients')->insert(['id' => $clientId, 'tenant_id' => $this->tenant->getKey(), 'secret' => hash('sha256', $row['clientId']), 'created_at' => $this->moment($row['createdAt']), ...$client]);
            DB::table('integration_oauth_apps')->insert([
                'tenant_id' => $this->tenant->getKey(),
                'client_id' => $clientId,
                'vendor' => $row['vendor'],
                'allowed_scopes' => PgArray::from($row['scopes']),
                'status' => $row['status'] === 'activa' ? 'active' : 'revoked',
                'created_by' => $this->userId($row['createdBy']),
                'created_at' => $this->moment($row['createdAt']),
            ]);
        }
    }
}
