<?php

declare(strict_types=1);

namespace App\Domain\Admin\Http\Middleware;

use App\Domain\Admin\Actions\IssueOAuthTokens;
use App\Domain\Admin\Support\ApiKeyActor;
use App\Domain\Admin\Support\ApiKeyUsage;
use App\Domain\Admin\Support\ApiQuota;
use App\Domain\Admin\Support\PgArray;
use App\Domain\Platform\Support\Entitlements;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Tenancy\TenantContext;
use App\Domain\Shared\Tenancy\TenantDatabase;
use App\Http\Middleware\EnsureFeature;
use Closure;
use Illuminate\Auth\RequestGuard;
use Illuminate\Http\Exceptions\ThrottleRequestsException;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Auth;
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
        private readonly ApiQuota $quota,
        private readonly Entitlements $entitlements,
    ) {}

    public static function looksLikeKey(?string $token): bool
    {
        return $token !== null && (str_starts_with($token, 'qts_') || str_starts_with($token, IssueOAuthTokens::ACCESS_PREFIX));
    }

    public static function sharesSession(Request $request): bool
    {
        return in_array('auth:sanctum', $request->route()?->gatherMiddleware() ?? [], true);
    }

    public function handle(Request $request, Closure $next): Response
    {
        $token = (string) $request->bearerToken();
        $shared = self::sharesSession($request);

        if ($shared && ! self::looksLikeKey($token)) {
            return $next($request);
        }

        $oauth = str_starts_with($token, IssueOAuthTokens::ACCESS_PREFIX);

        if (! $oauth && preg_match(self::TOKEN, $token, $match) !== 1) {
            throw $this->unauthorized($shared ? 'La llave de API no es válida.' : 'Envía tu llave de API en la cabecera Authorization: Bearer qts_live_…');
        }

        $key = $oauth ? $this->findOAuth($token) : $this->find($token, substr($token, 0, strlen("qts_{$match['env']}_") + 4));
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

        $tenantId = (string) $key->tenant_id;
        $blocked = $this->quota->exceeded($tenantId);

        if ($blocked !== null) {
            $this->usage->rejected((string) $key->id);

            return $blocked;
        }

        RateLimiter::hit($bucket, 60);
        $this->quota->hit($tenantId);
        $this->usage->call((string) $key->id);
        $this->touch($key, (string) $request->ip());
        $attributes = ['id' => (string) $key->id, 'code' => (string) $key->code, 'name' => (string) $key->name, 'tenant_id' => $tenantId, 'scopes' => PgArray::parse($key->scopes), 'environment' => (string) $key->environment, 'oauth_owner_id' => $key->owner_id ?? null];
        $request->attributes->set(self::ATTRIBUTE, $attributes);

        if ($shared) {
            $guard = Auth::guard('sanctum');
            $guard->setUser(ApiKeyActor::make($attributes));

            try {
                $response = $next($request);
            } finally {
                if ($guard instanceof RequestGuard) {
                    $guard->forgetUser();
                }
            }
        } else {
            try {
                $response = $this->database->run((string) $key->tenant_id, fn () => $next($request));
            } finally {
                $this->context->clear();
            }
        }

        $response->headers->add($this->headers($limit, RateLimiter::remaining($bucket, $limit), RateLimiter::availableIn($bucket)) + $this->quota->headers($this->quota->limit($tenantId), $this->quota->used($tenantId)));

        return $response;
    }

    private function findOAuth(string $token): object
    {
        $key = DB::connection('pgsql_platform')->table('integration_oauth_tokens as k')
            ->join('integration_oauth_apps as a', 'a.client_id', '=', 'k.client_id')
            ->join('oauth_clients as c', 'c.id', '=', 'k.client_id')
            ->where('k.access_hash', hash('sha256', $token))
            ->first(['k.id as token_id', 'k.client_id as id', 'k.tenant_id', 'k.user_id as owner_id', 'k.scopes', 'k.revoked_at', 'a.status', 'a.allowed_scopes', 'c.name', 'c.revoked', DB::raw('k.expires_at <= now() as expired')]);

        if ($key === null || $key->revoked_at !== null || $key->revoked || $key->status !== 'active') {
            throw $this->unauthorized('El token de la aplicación no es válido o fue revocado.');
        }

        if ($key->expired) {
            throw $this->unauthorized('El token de la aplicación venció. Renuévalo con tu refresh_token.');
        }

        $this->ensureTenantActive((string) $key->tenant_id);

        if (! $this->entitlements->enabled((string) $key->tenant_id, IssueOAuthTokens::FEATURE)) {
            throw ApiException::forbidden(EnsureFeature::CODE, 'El plan de la agencia ya no incluye aplicaciones OAuth.', ['oauth_apps']);
        }

        $key->code = 'OAuth';
        $key->environment = 'live';
        $key->ip_allowlist = null;
        $key->scopes = PgArray::from(array_values(array_intersect(PgArray::parse($key->scopes), PgArray::parse($key->allowed_scopes))));

        return $key;
    }

    private function ensureTenantActive(string $tenantId): void
    {
        $tenant = DB::connection('pgsql_platform')->table('tenants')->where('id', $tenantId)->value('status');

        if ($tenant === 'suspendido' || $tenant === 'cancelado') {
            throw ApiException::forbidden('TENANT_SUSPENDED', 'La agencia de esta llave está suspendida.', ['tenant.active']);
        }
    }

    private function find(string $token, string $prefix): object
    {
        $hash = hash('sha256', $token);
        $key = DB::connection('pgsql_platform')->table('integration_api_keys')->where('prefix', $prefix)->get(['id', 'tenant_id', 'code', 'name', 'environment', 'token_hash', 'scopes', 'ip_allowlist', 'expires_at', 'status', 'last_used_at'])
            ->first(fn (object $row): bool => hash_equals((string) $row->token_hash, $hash));

        if ($key === null) {
            throw $this->unauthorized('La llave de API no es válida.');
        }

        if ($key->status !== 'active' || ($key->expires_at !== null && (string) $key->expires_at < Carbon::today('America/Lima')->toDateString())) {
            throw $this->unauthorized($key->status === 'revoked' ? 'La llave de API fue revocada.' : 'La llave de API venció.');
        }

        $this->ensureTenantActive((string) $key->tenant_id);

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

        isset($key->token_id)
            ? DB::connection('pgsql_platform')->table('integration_oauth_tokens')->where('id', $key->token_id)->update(['last_used_at' => now()->utc(), 'last_used_ip' => $ip])
            : DB::connection('pgsql_platform')->table('integration_api_keys')->where('id', $key->id)->update(['last_used_at' => now(), 'last_used_ip' => $ip]);
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
