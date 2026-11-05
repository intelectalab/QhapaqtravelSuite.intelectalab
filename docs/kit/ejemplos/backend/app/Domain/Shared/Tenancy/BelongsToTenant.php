<?php

declare(strict_types=1);

namespace App\Domain\Shared\Tenancy;

use App\Domain\Platform\Models\Tenant;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Trait obligatorio en TODO modelo de negocio (tablas con `tenant_id`; CLAUDE.md backend «Tenancy»).
 *
 * 1. Global scope TenantScope: toda consulta Eloquent filtra por el tenant del contexto.
 * 2. `creating`: asigna `tenant_id` desde TenantContext e IGNORA cualquier valor que venga del request
 *    (aunque el FormRequest lo dejara pasar). Prueba: TenantIsolationTest «ignora X-Tenant-Id y tenant_id».
 * 3. `updating`: impide mover una fila a otro tenant.
 *
 * `tenant_id` nunca debe estar en `$fillable`. La columna tiene además
 * `default app_current_tenant_id()` en SQL como defensa adicional.
 *
 * @mixin Model
 */
trait BelongsToTenant
{
    public static function bootBelongsToTenant(): void
    {
        static::addGlobalScope(new TenantScope());

        static::creating(function (Model $model): void {
            // Siempre el del contexto; si no hay contexto, falla (nunca se inserta "sin tenant").
            $model->setAttribute('tenant_id', app(TenantContext::class)->idOrFail());
        });

        static::updating(function (Model $model): void {
            if ($model->isDirty('tenant_id')) {
                throw ApiException::forbidden('TENANT_SCOPE_VIOLATION', 'No se puede cambiar el tenant de un registro.');
            }
        });
    }

    public function initializeBelongsToTenant(): void
    {
        // Evita asignación masiva aunque alguien agregue tenant_id a $fillable por error.
        $this->guarded = array_values(array_unique([...$this->guarded, 'tenant_id']));
    }

    /** @return BelongsTo<Tenant, $this> */
    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class, 'tenant_id');
    }
}
