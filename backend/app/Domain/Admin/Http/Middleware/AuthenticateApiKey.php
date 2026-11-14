<?php

declare(strict_types=1);

namespace App\Domain\Admin\Http\Middleware;

use App\Domain\Admin\Support\ApiKeyUsage;
use App\Domain\Admin\Support\PgArray;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Tenancy\TenantContext;
use App\Domain\Shared\Tenancy\TenantDatabase;
use Closure;
use Illuminate\Http\Exceptions\ThrottleRequestsException;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\RateLimiter;
use Symfony\Component\HttpFoundation\IpUtils;
use Symfony\Component\HttpFoundation\Response;

final class AuthenticateApiKey
{
    public const ATTRIBUTE = 'api_key';

    private const TOKEN = '/^qts_(?<env>live|test)_[A-Za-z0-9]{32}$/';

    private const DEFAULT_RATE = 60;

    public function __construct(
        private readonly TenantContext $context,
        private readonly TenantDatabase $database,
        private readonly ApiKeyUsage $usage,
    ) {}

    public function handle(Request $request, Closure $next): Response
    {
        $token = (string) $request->bearerToken();

        if (preg_match(self::TOKEN, $token, $match) !== 1) {
            throw $this->unauthorized('Envía tu llave de API en la cabecera Authorization: Bearer qts_live_…');
        }

        $key = $this->find($token, substr($token, 0, strlen("qts_{$match['env']}_") + 4));
        $ips = PgArray::parse($key->ip_allowlist);

        if ($ips !== [] && ! IpUtils::checkIp((string) $request->ip(), $ips)) {
            throw ApiException::forbidden('API_KEY_IP', 'La llave no admite llamadas desde esta IP. Agrégala a su lista de IP permitidas.', ['ip_allowlist']);
        }

        $limit = $this->rate((string) $key->tenant_id);
        $bucket = "api-key:{$key->id}";

        if (RateLimiter::tooManyAttempts($bucket, $limit)) {
            $this->usage->rejected((string) $key->id);
            $retry = RateLimiter::availableIn($bucket);

            throw new ThrottleRequestsException('Superaste el límite de llamadas por minuto de esta llave.', null, $this->headers($limit, 0, $retry) + ['Retry-After' => (string) $retry]);
        }

        RateLimiter::hit($bucket, 60);
        $this->usage->call((string) $key->id);
        $this->touch($key, (string) $request->ip());
        $request->attributes->set(self::ATTRIBUTE, ['id' => (string) $key->id, 'code' => (string) $key->code, 'tenant_id' => (string) $key->tenant_id, 'scopes' => PgArray::parse($key->scopes), 'environment' => (string) $key->environment]);
        try {
            $response = $this->database->run((string) $key->tenant_id, fn () => $next($request));
        } finally {
            $this->context->clear();
        }

        $response->headers->add($this->headers($limit, RateLimiter::remaining($bucket, $limit), RateLimiter::availableIn($bucket)));

        return $response;
    }

    private function find(string $token, string $prefix): object
    {
        $hash = hash('sha256', $token);
        $key = DB::connection('pgsql_platform')->table('integration_api_keys')->where('prefix', $prefix)->get(['id', 'tenant_id', 'code', 'environment', 'token_hash', 'scopes', 'ip_allowlist', 'expires_at', 'status', 'last_used_at'])
            ->first(fn (object $row): bool => hash_equals((string) $row->token_hash, $hash));

        if ($key === null) {
            throw $this->unauthorized('La llave de API no es válida.');
        }

        if ($key->status !== 'active' || ($key->expires_at !== null && (string) $key->expires_at < Carbon::today('America/Lima')->toDateString())) {
            throw $this->unauthorized($key->status === 'revoked' ? 'La llave de API fue revocada.' : 'La llave de API venció.');
        }

        $tenant = DB::connection('pgsql_platform')->table('tenants')->where('id', $key->tenant_id)->value('status');

        if ($tenant === 'suspendido' || $tenant === 'cancelado') {
            throw ApiException::forbidden('TENANT_SUSPENDED', 'La agencia de esta llave está suspendida.', ['tenant.active']);
        }

        return $key;
    }

    private function rate(string $tenantId): int
    {
        return (int) Cache::remember("api-key:rate:{$tenantId}", now()->addMinutes(5), fn (): int => (int) (DB::connection('pgsql_platform')->table('plan_limits as l')
            ->join('tenants as t', 't.plan_id', '=', 'l.plan_id')
            ->where('t.id', $tenantId)->where('l.metric', 'api_rate_per_min')->value('l.value') ?: self::DEFAULT_RATE));
    }

    private function touch(object $key, string $ip): void
    {
        if (! Cache::add("api-key:touch:{$key->id}", 1, 60)) {
            return;
        }

        DB::connection('pgsql_platform')->table('integration_api_keys')->where('id', $key->id)->update(['last_used_at' => now(), 'last_used_ip' => $ip]);
    }

    private function headers(int $limit, int $remaining, int $reset): array
    {
        return [
            'X-RateLimit-Limit' => (string) $limit,
            'X-RateLimit-Remaining' => (string) max(0, $remaining),
            'X-RateLimit-Reset' => (string) (now()->addSeconds($reset)->getTimestamp()),
        ];
    }

    private function unauthorized(string $message): ApiException
    {
        return ApiException::unauthorized('API_KEY_INVALID', $message);
    }
}
