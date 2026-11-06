<?php

declare(strict_types=1);

namespace App\Domain\Shared\Tenancy;

use App\Domain\Platform\Models\Tenant;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

trait BelongsToTenant
{
    public static function bootBelongsToTenant(): void
    {
        static::addGlobalScope(new TenantScope);

        static::creating(function (Model $model): void {
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
        $this->guarded = array_values(array_unique([...$this->guarded, 'tenant_id']));
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class, 'tenant_id');
    }
}
