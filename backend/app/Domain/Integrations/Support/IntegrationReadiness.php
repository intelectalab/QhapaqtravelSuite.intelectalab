<?php

declare(strict_types=1);

namespace App\Domain\Integrations\Support;

use App\Domain\Integrations\Data\AdapterResult;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Tenancy\TenantContext;
use Illuminate\Support\Facades\DB;

final class IntegrationReadiness
{
    public const CODE = 'INTEGRATION_UNAVAILABLE';

    public static function enforced(): bool
    {
        $flag = config('integrations.require_real');

        return $flag === null || $flag === '' ? app()->isProduction() : filter_var($flag, FILTER_VALIDATE_BOOLEAN);
    }

    public static function real(string $key): bool
    {
        $driver = IntegrationCatalog::driver($key);

        return $driver === null || (string) config("integrations.drivers.{$driver}", 'fake') !== 'fake';
    }

    public static function usable(string $key): bool
    {
        return ! self::enforced() || self::real($key);
    }

    public static function simulationAllowed(string $key): bool
    {
        if (! isset(IntegrationCatalog::TRIAL_SIMULATION[$key])) {
            return false;
        }

        $tenantId = app(TenantContext::class)->id();

        return $tenantId !== null && DB::connection('pgsql_platform')->table('tenants')->where('id', $tenantId)->value('status') === 'prueba';
    }

    public static function refuse(string $key): void
    {
        if (self::enforced() && ! self::simulationAllowed($key)) {
            throw self::exception($key);
        }
    }

    public static function exception(string $key, ?string $message = null): ApiException
    {
        return ApiException::conflict(self::CODE, $message ?? IntegrationCatalog::missing($key), ['integration' => $key]);
    }

    public static function unavailable(string $key): ?AdapterResult
    {
        return self::enforced() && ! self::simulationAllowed($key) ? AdapterResult::permanent(IntegrationCatalog::missing($key)) : null;
    }

    public static function health(string $key): ?AdapterResult
    {
        return self::enforced() ? AdapterResult::permanent('Sin proveedor real: '.IntegrationCatalog::missing($key)) : null;
    }

    public static function features(): array
    {
        return collect(IntegrationCatalog::PLATFORM)->mapWithKeys(fn (array $row, string $key): array => [$key => [
            'available' => self::usable($key),
            'label' => $row['label'],
            'message' => self::usable($key) ? null : $row['missing'],
        ]])->all();
    }
}
