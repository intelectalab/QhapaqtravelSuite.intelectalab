<?php

declare(strict_types=1);

namespace App\Domain\Platform\Actions;

use App\Domain\Platform\Models\Plan;
use App\Domain\Platform\Models\PlatformUser;
use App\Domain\Platform\Models\Tenant;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Support\Facades\DB;

final class ChangeTenantStatus
{
    private const CONNECTION = 'pgsql_platform';

    public function __construct(private readonly PlatformSession $session) {}

    public function suspend(Tenant $tenant, string $reason, ?PlatformUser $actor = null): void
    {
        if ($tenant->isSuspended()) {
            throw ApiException::conflict('TEN-BR-08', 'La agencia ya está suspendida.');
        }

        DB::connection(self::CONNECTION)->transaction(function () use ($tenant, $reason, $actor): void {
            $before = $tenant->status;
            $tenant->forceFill(['status' => 'suspendido', 'suspend_reason' => $reason, 'suspended_at' => now(), 'updated_by' => $actor?->getKey()])->save();
            DB::connection(self::CONNECTION)->table('personal_access_tokens')->where('tenant_id', $tenant->getKey())->delete();
            $this->session->log('Tenant', $tenant->code, 'suspender', $before, "suspendido · {$reason}", $actor);
        });
    }

    public function reactivate(Tenant $tenant, string $reason, ?PlatformUser $actor = null): void
    {
        if (! $tenant->isSuspended()) {
            throw ApiException::conflict('TEN-BR-08', 'La agencia no está suspendida.');
        }

        DB::connection(self::CONNECTION)->transaction(function () use ($tenant, $reason, $actor): void {
            $price = (float) (Plan::on(self::CONNECTION)->find($tenant->plan_id)?->price_month ?? 0);
            $tenant->forceFill([
                'status' => 'activo',
                'suspend_reason' => null,
                'suspended_at' => null,
                'mrr' => (float) $tenant->mrr > 0 ? $tenant->mrr : $price,
                'updated_by' => $actor?->getKey(),
            ])->save();
            $this->session->log('Tenant', $tenant->code, 'reactivar', 'suspendido', "activo · {$reason}", $actor);
        });
    }
}
