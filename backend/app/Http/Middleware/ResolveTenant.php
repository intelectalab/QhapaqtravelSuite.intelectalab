<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Tenancy\TenantContext;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\PersonalAccessToken;
use Symfony\Component\HttpFoundation\Response;

final class ResolveTenant
{
    public function __construct(private readonly TenantContext $context)
    {
    }

    public function handle(Request $request, Closure $next): Response
    {
        $fromToken = $this->tenantFromToken($request);
        $fromHost = $this->tenantFromHost($request);

        if ($fromToken !== null && $fromHost !== null && $fromToken !== $fromHost) {
            throw ApiException::forbidden('TENANT_SCOPE_VIOLATION', 'El token no pertenece a este dominio.');
        }

        $tenantId = $fromToken ?? $fromHost;

        if ($tenantId === null) {
            throw ApiException::forbidden('TENANT_REQUIRED', 'No se pudo determinar la empresa (tenant) de la solicitud.');
        }

        $this->rejectClientSuppliedTenant($request, $tenantId);

        $this->context->set($tenantId);
        $request->attributes->set('tenant_id', $tenantId);

        return $next($request);
    }

    private function tenantFromToken(Request $request): ?string
    {
        $user = $request->user();
        if ($user === null || ! method_exists($user, 'currentAccessToken')) {
            return null;
        }

        $token = $user->currentAccessToken();

        if (! $token instanceof PersonalAccessToken) {
            return $user->tenant_id ?? null;
        }

        return $token->getAttribute('tenant_id');
    }

    private function tenantFromHost(Request $request): ?string
    {
        $base = (string) config('tenancy.central_domain');
        $host = strtolower($request->getHost());

        if ($base === '' || $host === $base || $host === 'api.'.$base) {
            return null;
        }

        $row = DB::selectOne(
            'select tenant_id, status from app_resolve_tenant_by_host(?, ?)',
            [$host, $base],
        );

        return $row?->tenant_id;
    }

    private function rejectClientSuppliedTenant(Request $request, string $tenantId): void
    {
        $claimed = array_filter([
            $request->header('X-Tenant-Id'),
            $request->query('tenant'),
        ]);

        foreach ($claimed as $value) {
            if ((string) $value !== $tenantId) {
                throw ApiException::forbidden('TENANT_SCOPE_VIOLATION', 'No puede operar sobre otra empresa.');
            }
        }

        $request->request->remove('tenant_id');
    }
}
