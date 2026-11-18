<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Domain\Crm\Support\Advisors;
use App\Domain\Finance\Actions\FxProviders;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Support\Facades\DB;

final class RefreshFxRates extends TenantJob
{
    public const QUEUE = 'integrations';

    protected function run(): string
    {
        if (DB::table('fx_rate_providers')->where('status', 'activo')->doesntExist()) {
            return 'Sin proveedor de tipo de cambio elegido: se registra a mano';
        }

        $admin = app(Advisors::class)->all(['tenant_admin', 'finance'])->first()['id'] ?? null;
        $actor = $admin !== null ? User::query()->find($admin) : null;

        if (! $actor instanceof User) {
            return $this->warn('No hay un administrador activo para registrar la actualización');
        }

        try {
            $result = app(FxProviders::class)->refresh($actor);
        } catch (ApiException $error) {
            return $this->warn($error->getMessage());
        }

        $rates = collect($result['rates'])->map(fn (array $row): string => $row['currency'].' '.$row['rate'])->implode(', ');
        $alerts = (int) $result['alerts'];

        return self::summary([$rates !== '' ? "Tipo de cambio del día: {$rates}" : null, $alerts > 0 ? self::plural($alerts, 'variación alta avisada', 'variaciones altas avisadas') : null], 'El proveedor no devolvió monedas activas');
    }
}
