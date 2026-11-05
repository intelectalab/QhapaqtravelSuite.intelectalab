<?php

declare(strict_types=1);

namespace App\Domain\Shared\Tenancy;

use App\Domain\Platform\Models\Tenant;
use App\Domain\Shared\Errors\ApiException;

/**
 * Contexto de tenant de la solicitud (o del job) en curso.
 *
 * - Lo fija SOLO el middleware ResolveTenant (desde el token Sanctum o el host) o el middleware de job
 *   RestoreTenantContext. Nunca se toma de un parámetro, header o cuerpo enviado por el cliente
 *   (spec 00 SEC-BR-02, CONVENCIONES §1).
 * - Se registra como `scoped` en el contenedor (AppServiceProvider):
 *       $this->app->scoped(TenantContext::class);
 *   `scoped` se reinicia en cada request/job, también con Octane y Horizon (no se filtra entre tenants).
 * - Las plantillas Pest llaman `app(TenantContext::class)->set($tenant)` (kit-ia/tests/pest/Support/Helpers.php).
 */
final class TenantContext
{
    private ?string $tenantId = null;

    private ?Tenant $tenant = null;

    /** Fija el tenant. Acepta el modelo o solo el uuid (jobs, scheduler). */
    public function set(Tenant|string $tenant): void
    {
        if ($tenant instanceof Tenant) {
            $this->tenant = $tenant;
            $this->tenantId = (string) $tenant->getKey();

            return;
        }

        $this->tenant = null;
        $this->tenantId = $tenant;
    }

    public function clear(): void
    {
        $this->tenant = null;
        $this->tenantId = null;
    }

    public function has(): bool
    {
        return $this->tenantId !== null;
    }

    /** uuid del tenant o null si no hay contexto (rutas de plataforma, login). */
    public function id(): ?string
    {
        return $this->tenantId;
    }

    /** uuid del tenant; falla cerrado si no hay contexto (equivale a RLS sin app.tenant_id). */
    public function idOrFail(): string
    {
        return $this->tenantId ?? throw ApiException::forbidden(
            'TENANT_REQUIRED',
            'La solicitud no tiene un tenant válido.',
        );
    }

    /**
     * Modelo del tenant (carga perezosa). La tabla `tenants` tiene RLS `tenant_self`: con la conexión
     * de la app solo se ve la fila propia, por eso se lee después de fijar app.tenant_id.
     */
    public function tenant(): Tenant
    {
        if ($this->tenant === null) {
            $this->tenant = Tenant::query()->findOrFail($this->idOrFail());
        }

        return $this->tenant;
    }

    /** Zona horaria del tenant (`tenants.timezone`, por defecto America/Lima). */
    public function timezone(): string
    {
        return $this->tenant()->timezone ?? 'America/Lima';
    }

    /**
     * Prefijo para claves de caché, locks y contadores Redis: `t:{tenant_id}:…` (02-ARQUITECTURA §4.5).
     * Ejemplo: $ctx->key('quote', $id, 'convert') → "t:0199…:quote:0199…:convert".
     */
    public function key(string|int ...$parts): string
    {
        return 't:'.$this->idOrFail().':'.implode(':', $parts);
    }
}
