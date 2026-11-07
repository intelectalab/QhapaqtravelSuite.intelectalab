<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Tenancy\TenantContext;
use Closure;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\Response;

final class ResolvePublicSite
{
    private const ACTIVE = ['activo', 'prueba'];

    public function __construct(private readonly TenantContext $context) {}

    public function handle(Request $request, Closure $next): Response
    {
        $key = trim((string) $request->header((string) config('sites.key_header'), ''));
        $tenant = $key !== '' ? $this->byKey($key, $request) : $this->byHost($this->host($request));

        if ($tenant === null) {
            throw ApiException::notFound('Esta agencia no tiene un sitio publicado.');
        }

        $this->context->set($tenant);
        $request->attributes->set('tenant_id', $tenant);

        return $next($request);
    }

    private function byKey(string $key, Request $request): string
    {
        $config = $this->db()->table('channel_widget_config')
            ->where(fn ($query) => $query->where('public_key', $key)->orWhere(fn ($query) => $query->where('public_key_prev', $key)->where('prev_expires_at', '>', now())))
            ->first(['tenant_id']);
        $tenant = $config ? $this->active((string) $config->tenant_id) : null;

        if ($tenant === null) {
            throw ApiException::unauthorized('WIDGET_KEY_INVALID', 'La clave pública del sitio no es válida.');
        }

        $origin = parse_url((string) $request->header('Origin', ''), PHP_URL_HOST);

        if (is_string($origin) && $origin !== '' && $this->byHost($origin) !== $tenant) {
            throw ApiException::forbidden('WIDGET_ORIGIN_NOT_ALLOWED', 'Este dominio no está verificado para el sitio de la agencia.');
        }

        return $tenant;
    }

    private function byHost(string $host): ?string
    {
        if ($host === '') {
            return null;
        }

        $domain = mb_strtolower((string) config('sites.domain'));
        $subdomain = str_ends_with($host, ".{$domain}") ? explode('.', substr($host, 0, -strlen(".{$domain}")))[0] : null;
        $tenant = $this->db()->table('tenants')->whereIn('status', self::ACTIVE)
            ->where(fn ($query) => $query->where('custom_domain', $host)->when($subdomain !== null, fn ($query) => $query->orWhere('subdomain', $subdomain)))
            ->value('id');

        if ($tenant !== null) {
            return (string) $tenant;
        }

        $verified = $this->db()->table('channel_widget_domains')->where('domain', $host)->where('status', 'verificado')->value('tenant_id');

        return $verified !== null ? $this->active((string) $verified) : null;
    }

    private function active(string $tenantId): ?string
    {
        return $this->db()->table('tenants')->where('id', $tenantId)->whereIn('status', self::ACTIVE)->exists() ? $tenantId : null;
    }

    private function host(Request $request): string
    {
        $raw = (string) ($request->header('X-Forwarded-Host') ?: $request->getHost());

        return mb_strtolower(trim(explode(':', explode(',', $raw)[0])[0]));
    }

    private function db(): ConnectionInterface
    {
        return DB::connection('pgsql_platform');
    }
}
