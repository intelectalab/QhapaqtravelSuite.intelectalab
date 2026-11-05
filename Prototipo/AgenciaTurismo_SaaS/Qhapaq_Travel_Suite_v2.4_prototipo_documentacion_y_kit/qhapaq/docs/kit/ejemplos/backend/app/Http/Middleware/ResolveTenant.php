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

/**
 * Resuelve el tenant de la solicitud (spec 00 SEC-BR-01/02; 02-ARQUITECTURA §4.1).
 *
 * Orden en el grupo `api` (spec 00 §11 fila 1):
 *   AssignCorrelationId → auth:sanctum → ResolveTenant → EnsureTenantActive → EnsureMfaVerified
 *   → SetPostgresTenant → SetPermissionsTeam → EnsureExperience → (Idempotency) → Controller/Policy
 *
 * Fuentes válidas del tenant, en este orden:
 *  1. Token Sanctum: `personal_access_tokens.tenant_id` (tabla SIN RLS a propósito, C-08: es la fuente del tenant).
 *     Si además hay host de tenant, debe coincidir; si no → 403 TENANT_SCOPE_VIOLATION.
 *  2. Host (rutas públicas, sitio, widget, portales con enlace): función SECURITY DEFINER
 *     `app_resolve_tenant_by_host(host, base_domain)` de database/90_rls.sql (subdominio o dominio propio).
 *
 * NUNCA: `X-Tenant-Id`, `?tenant=`, `tenant_id` del cuerpo. Si llegan y difieren → 403 TENANT_SCOPE_VIOLATION
 * (TenantIsolationTest). Si coinciden o no llegan, se ignoran.
 */
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
        $request->attributes->set('tenant_id', $tenantId); // para logs y auditoría

        return $next($request);
    }

    private function tenantFromToken(Request $request): ?string
    {
        $user = $request->user();
        if ($user === null || ! method_exists($user, 'currentAccessToken')) {
            return null;
        }

        $token = $user->currentAccessToken();

        // Sanctum::actingAs en pruebas usa TransientToken (sin fila): se toma el tenant del usuario.
        if (! $token instanceof PersonalAccessToken) {
            return $user->tenant_id ?? null;
        }

        return $token->getAttribute('tenant_id'); // NULL solo para platform_users (guard platform)
    }

    private function tenantFromHost(Request $request): ?string
    {
        $base = (string) config('tenancy.central_domain'); // TENANCY_CENTRAL_DOMAIN en infra/env/backend.env.example
        $host = strtolower($request->getHost());

        if ($base === '' || $host === $base || $host === 'api.'.$base) {
            return null; // host de la API central: el tenant sale del token
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

        // tenant_id en el cuerpo: se descarta sin error (BelongsToTenant lo sobrescribe de todos modos).
        $request->request->remove('tenant_id');
    }
}
