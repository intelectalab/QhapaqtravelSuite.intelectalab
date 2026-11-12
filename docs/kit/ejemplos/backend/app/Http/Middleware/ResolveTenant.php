<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Tenancy\TenantContext;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\Response;

/**
 * Resuelve el tenant de la solicitud (spec 00 SEC-BR-01/02; 02-ARQUITECTURA §4.1).
 *
 * Orden en el grupo `api` (spec 00 §11 fila 1, v2.5):
 *   AssignCorrelationId → ResolveTenant → SetPostgresTenant → auth:sanctum → EnsureTenantActive
 *   → EnsureMfaVerified → SetPermissionsTeam → EnsureExperience → (Idempotency) → Controller/Policy
 *
 * ResolveTenant va ANTES de auth:sanctum: `personal_access_tokens` e `iam_users` tienen RLS, así que Sanctum
 * solo encuentra el token y su usuario cuando `app.tenant_id` ya está fijado en la transacción.
 *
 * Fuentes válidas del tenant, en este orden:
 *  1. Token Bearer: hash SHA-256 del secreto → función SECURITY DEFINER `app_resolve_access_token(hash)`
 *     de database/90_rls.sql (C-08 v2.5). Si además hay host de tenant, debe coincidir; si no → 403 TENANT_SCOPE_VIOLATION.
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

        if ($tenantId === null && $request->bearerToken() !== null) {
            throw new \Illuminate\Auth\AuthenticationException(); // token inválido o vencido → 401 UNAUTHENTICATED
        }

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
        $bearer = $request->bearerToken();

        if ($bearer === null) {
            // Sanctum::actingAs en pruebas no envía Bearer: se toma el tenant del usuario autenticado.
            return $request->user('sanctum')?->tenant_id ?? null;
        }

        // Formato de Sanctum: "{id}|{secreto}". En la tabla se guarda hash('sha256', secreto).
        $secret = str_contains($bearer, '|') ? explode('|', $bearer, 2)[1] : $bearer;

        $row = DB::selectOne(
            'select tenant_id from app_resolve_access_token(?)',
            [hash('sha256', $secret)],
        );

        return $row?->tenant_id; // NULL: token inexistente, vencido o de plataforma → auth:sanctum responde 401
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
