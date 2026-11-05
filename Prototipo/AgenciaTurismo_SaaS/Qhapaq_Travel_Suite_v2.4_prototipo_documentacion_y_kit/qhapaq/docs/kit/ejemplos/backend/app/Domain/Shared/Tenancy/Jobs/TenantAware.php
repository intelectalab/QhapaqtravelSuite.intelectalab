<?php

declare(strict_types=1);

namespace App\Domain\Shared\Tenancy\Jobs;

use App\Domain\Shared\Tenancy\TenantContext;

/**
 * Trait para jobs y listeners en cola de dominio (02-ARQUITECTURA §4.4; spec 00 §3.11 «TenantAware»).
 *
 * Uso:
 *   final class ExpireQuotes implements ShouldQueue {
 *       use Dispatchable, InteractsWithQueue, Queueable, SerializesModels, TenantAware;
 *       public function __construct() { $this->captureTenant(); }
 *       public function handle(): void { ... }   // corre con app.tenant_id fijado
 *   }
 *
 * - `captureTenant()` guarda el uuid del tenant del contexto al despachar; se serializa con el job.
 * - `middleware()` devuelve RestoreTenantContext, que fija TenantContext y SET LOCAL app.tenant_id y
 *   ejecuta handle() dentro de una transacción. Si el job define su propio middleware(), debe incluir
 *   `...$this->tenantMiddleware()` (la prueba TenantIsolationTest lo verifica).
 * - Jobs del scheduler multi-tenant: un job "coordinador" (conexión de plataforma) recorre `tenants`
 *   y despacha UN job por tenant con `->forTenant($id)`; nunca un job que mezcle tenants.
 */
trait TenantAware
{
    public ?string $tenantId = null;

    /** Toma el tenant del contexto actual (request o job padre). */
    public function captureTenant(): static
    {
        $this->tenantId ??= app(TenantContext::class)->id();

        return $this;
    }

    /** Fija el tenant explícitamente (scheduler multi-tenant). */
    public function forTenant(string $tenantId): static
    {
        $this->tenantId = $tenantId;

        return $this;
    }

    /** @return list<object> */
    public function middleware(): array
    {
        return $this->tenantMiddleware();
    }

    /** @return list<object> */
    protected function tenantMiddleware(): array
    {
        return [new RestoreTenantContext()];
    }
}
