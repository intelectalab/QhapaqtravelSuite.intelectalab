<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Domain\Shared\Audit\AuditLogger;
use App\Jobs\Concerns\NotifiesStaff;
use Illuminate\Support\Facades\DB;

final class MarkExpiredProviderContracts extends TenantJob
{
    use NotifiesStaff;

    protected function run(): string
    {
        $today = $this->today()->toDateString();
        $providers = DB::table('catalog_providers')->whereNull('deleted_at')->where('status', 'activo')
            ->where('contract_end', '<', $today)->orderBy('id')->lock('for no key update')->get(['id', 'ref', 'name', 'contract_end']);

        if ($providers->isEmpty()) {
            return 'Sin contratos de proveedores vencidos';
        }

        $audit = app(AuditLogger::class);
        DB::table('catalog_providers')->whereIn('id', $providers->pluck('id'))->update(['status' => 'vencido', 'updated_at' => now()]);
        $products = DB::table('catalog_products')->whereNull('deleted_at')->where('status', 'ACTIVE')->whereIn('main_provider_id', $providers->pluck('id'))->count();

        foreach ($providers as $provider) {
            $audit->log('Proveedor', (string) ($provider->ref ?? $provider->id), 'vencer_contrato', 'activo', "vencido · contrato hasta {$provider->contract_end}");

            foreach ($this->managers() as $userId) {
                $this->notifyOnce('proveedor.contrato_vencido', $userId, 'catalog_provider', (string) $provider->id, "Venció el contrato de {$provider->name}",
                    "El contrato terminó el {$provider->contract_end}. El proveedor queda como vencido: renueva el contrato para volver a pedirle servicios.", false);
            }
        }

        $result = self::plural($providers->count(), 'contrato de proveedor vencido', 'contratos de proveedores vencidos');

        return $products > 0 ? $this->warn($result.' · '.self::plural($products, 'producto activo afectado', 'productos activos afectados')) : $result;
    }
}
