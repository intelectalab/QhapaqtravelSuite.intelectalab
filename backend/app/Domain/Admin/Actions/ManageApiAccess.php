<?php

declare(strict_types=1);

namespace App\Domain\Admin\Actions;

use App\Domain\Admin\Support\ApiDirectory;
use App\Domain\Admin\Support\PgArray;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Tenancy\TenantContext;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

final class ManageApiAccess
{
    private const HOOK_STATUS = ['pause' => ['active', 'paused', 'pausar'], 'resume' => ['paused', 'active', 'reanudar']];

    public function __construct(private readonly AuditLogger $audit, private readonly TenantContext $context) {}

    public function createKey(array $data, User $actor): array
    {
        return DB::transaction(function () use ($data, $actor): array {
            $limit = $this->limit('api_keys');
            $active = count(DB::table('integration_api_keys')->where('status', 'active')->lockForUpdate()->pluck('id')->all());

            if ($limit !== null && $active >= $limit) {
                throw ApiException::conflict('API-BR-02', "Tu plan permite {$limit} claves activas. Revoca una que ya no uses o mejora el plan.");
            }

            $token = "qts_{$data['environment']}_".Str::random(32);
            $prefix = substr($token, 0, strlen("qts_{$data['environment']}_") + 4);
            $code = $this->nextCode('integration_api_keys', 'KEY-', 4);
            DB::table('integration_api_keys')->insert([
                'code' => $code,
                'name' => $data['name'],
                'environment' => $data['environment'],
                'prefix' => $prefix,
                'last4' => substr($token, -4),
                'token_hash' => hash('sha256', $token),
                'scopes' => PgArray::from($data['scopes']),
                'ip_allowlist' => ($data['ips'] ?? []) !== [] ? PgArray::from($data['ips']) : null,
                'expires_at' => $data['expires_at'] ?? null,
                'status' => 'active',
                'created_by' => $actor->getKey(),
            ]);
            $this->audit->log('Clave de API', $code, 'crear', null, "{$data['name']} · {$data['environment']} · ".implode(', ', $data['scopes']));

            return ['code' => $code, 'token' => $token];
        });
    }

    public function revokeKey(string $code, string $reason, User $actor): void
    {
        DB::transaction(function () use ($code, $reason, $actor): void {
            $key = DB::table('integration_api_keys')->where('code', $code)->lockForUpdate()->first(['id', 'status', 'name']) ?? throw ApiException::notFound('La clave no existe.');

            if ($key->status !== 'active') {
                throw ApiException::unprocessable('API-BR-01', 'La clave ya no está activa.');
            }

            DB::table('integration_api_keys')->where('id', $key->id)->update(['status' => 'revoked', 'revoked_at' => now(), 'revoked_by' => $actor->getKey(), 'revoke_reason' => $reason]);
            $this->audit->log('Clave de API', $code, 'revocar', 'activa', $reason);
        });
    }

    public function createWebhook(array $data, User $actor): array
    {
        $this->assertSafeUrl($data['url']);

        return DB::transaction(function () use ($data, $actor): array {
            $limit = $this->limit('webhooks');
            $count = count(DB::table('integration_webhooks')->where('status', '<>', 'deleted')->lockForUpdate()->pluck('id')->all());

            if ($limit !== null && $count >= $limit) {
                throw ApiException::conflict('API-BR-04', "Tu plan permite {$limit} webhooks.");
            }

            $secret = 'whsec_'.Str::random(32);
            $code = $this->nextCode('integration_webhooks', 'WH-', 4);
            DB::table('integration_webhooks')->insert([
                'code' => $code,
                'url' => $data['url'],
                'description' => $data['description'] ?? null,
                'events' => PgArray::from($data['events']),
                'secret_encrypted' => Crypt::encryptString($secret),
                'secret_prefix' => substr($secret, 0, 10),
                'api_version' => ApiDirectory::API_VERSION,
                'status' => 'active',
                'created_by' => $actor->getKey(),
                'updated_by' => $actor->getKey(),
            ]);
            $this->audit->log('Webhook', $code, 'crear', null, $data['url'].' · '.implode(', ', $data['events']));

            return ['code' => $code, 'secret' => $secret];
        });
    }

    public function updateWebhook(string $code, array $data, User $actor): void
    {
        $this->assertSafeUrl($data['url']);

        DB::transaction(function () use ($code, $data, $actor): void {
            $hook = $this->hook($code);
            $events = PgArray::from($data['events']);
            $same = $hook->url === $data['url'] && (string) $hook->description === (string) ($data['description'] ?? '') && PgArray::parse($hook->events) === PgArray::parse($events);

            if ($same) {
                throw ApiException::unprocessable('CFG-BR-01', 'No hay cambios que guardar.');
            }

            DB::table('integration_webhooks')->where('id', $hook->id)->update(['url' => $data['url'], 'description' => $data['description'] ?? null, 'events' => $events, 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
            $this->audit->log('Webhook', $code, 'editar', $hook->url.' · '.implode(', ', PgArray::parse($hook->events)), $data['url'].' · '.implode(', ', $data['events']));
        });
    }

    public function status(string $code, string $mode, User $actor): void
    {
        [$from, $to, $action] = self::HOOK_STATUS[$mode] ?? throw ApiException::notFound('La acción no existe.');

        DB::transaction(function () use ($code, $from, $to, $action, $actor): void {
            $hook = $this->hook($code);

            if ($hook->status !== $from && ! ($to === 'active' && $hook->status === 'disabled')) {
                throw ApiException::unprocessable('API-BR-07', $to === 'paused' ? 'El webhook no está activo.' : 'El webhook no está pausado.');
            }

            DB::table('integration_webhooks')->where('id', $hook->id)->update(['status' => $to, 'consecutive_failures' => $to === 'active' ? 0 : $hook->consecutive_failures, 'disabled_reason' => null, 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
            $this->audit->log('Webhook', $code, $action, $hook->status, $to);
        });
    }

    public function deleteWebhook(string $code, User $actor): void
    {
        DB::transaction(function () use ($code, $actor): void {
            $hook = $this->hook($code);
            DB::table('integration_webhooks')->where('id', $hook->id)->update(['status' => 'deleted', 'deleted_at' => now(), 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
            $this->audit->log('Webhook', $code, 'eliminar', $hook->url, null);
        });
    }

    private function hook(string $code): object
    {
        return DB::table('integration_webhooks')->where('code', $code)->where('status', '<>', 'deleted')->lockForUpdate()->first() ?? throw ApiException::notFound('El webhook no existe.');
    }

    private function limit(string $metric): ?int
    {
        $value = DB::connection('pgsql_platform')->table('plan_limits')->where('plan_id', $this->context->tenant()->plan_id)->where('metric', $metric)->value('value');

        return $value === null ? null : (int) $value;
    }

    private function nextCode(string $table, string $prefix, int $pad): string
    {
        $last = DB::table($table)->where('code', 'like', $prefix.'%')->pluck('code')->map(fn (string $code): int => (int) substr($code, strlen($prefix)))->max() ?? 0;

        return $prefix.str_pad((string) ($last + 1), $pad, '0', STR_PAD_LEFT);
    }

    public function assertSafeUrl(string $url): void
    {
        $host = strtolower((string) parse_url($url, PHP_URL_HOST));
        $fail = fn (string $message) => throw ValidationException::withMessages(['url' => $message]);

        if (! str_starts_with($url, 'https://') || $host === '') {
            $fail('La URL debe empezar con https:// (API-BR-05).');
        }

        if ($host === 'localhost' || str_ends_with($host, '.local') || str_ends_with($host, '.internal') || str_ends_with($host, '.localhost')) {
            $fail('La URL no puede apuntar a una red interna (API-BR-06).');
        }

        $ips = filter_var($host, FILTER_VALIDATE_IP) ? [$host] : (gethostbynamel($host) ?: []);

        if ($ips === []) {
            $fail('No pudimos resolver ese dominio. Revisa la dirección.');
        }

        foreach ($ips as $ip) {
            if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE) === false) {
                $fail('La URL no puede apuntar a una red interna (API-BR-06).');
            }
        }
    }
}
