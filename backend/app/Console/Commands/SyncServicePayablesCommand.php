<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Domain\Finance\Actions\SyncServicePayables;
use App\Domain\Platform\Models\Tenant;
use App\Domain\Shared\Tenancy\TenantContext;
use App\Domain\Shared\Tenancy\TenantDatabase;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

final class SyncServicePayablesCommand extends Command
{
    protected $signature = 'finance:service-payables {--tenant= : Código de la agencia (por defecto, todas)}';

    protected $description = 'Genera las cuentas por pagar de servicio que falten en las reservas confirmadas o en curso, sin duplicar las existentes';

    public function handle(SyncServicePayables $payables, TenantDatabase $database, TenantContext $context): int
    {
        $tenants = Tenant::on('pgsql_platform')
            ->when($this->option('tenant'), fn ($query, $code) => $query->where('code', $code))
            ->orderBy('code')
            ->get(['id', 'code']);

        if ($tenants->isEmpty()) {
            $this->error('No se encontró ninguna agencia.');

            return self::FAILURE;
        }

        foreach ($tenants as $tenant) {
            $tenantId = (string) $tenant->getKey();
            $reservations = $database->run($tenantId, fn (): array => DB::table('booking_reservations')->whereNull('deleted_at')
                ->whereIn('status', SyncServicePayables::GENERATING)->orderBy('code')->pluck('id')->map(fn ($id): string => (string) $id)->all());
            $totals = ['created' => 0, 'adjusted' => 0, 'cancelled' => 0];

            foreach ($reservations as $reservationId) {
                $result = $database->run($tenantId, fn (): array => $payables->handle($reservationId), attempts: 3);
                foreach ($totals as $key => $count) {
                    $totals[$key] = $count + count($result[$key]);
                }
            }

            $this->line("{$tenant->code}: ".count($reservations)." reservas revisadas, {$totals['created']} cuentas por pagar generadas, {$totals['adjusted']} ajustadas, {$totals['cancelled']} anuladas");
        }

        $context->clear();

        return self::SUCCESS;
    }
}
