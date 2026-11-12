<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Domain\Crm\Support\Advisors;
use App\Jobs\Concerns\NotifiesStaff;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

final class CatalogValidityAlerts extends TenantJob
{
    use NotifiesStaff;

    public const QUEUE = 'notifications';

    public const CONTRACT_DAYS = 95;

    public const SERVICE_DAYS = 90;

    protected function run(): string
    {
        $today = $this->today()->toDateString();
        $contracts = DB::table('catalog_providers')->whereNull('deleted_at')->where('status', 'activo')->whereBetween('contract_end', [$today, $this->today()->addDays(self::CONTRACT_DAYS)->toDateString()])->get(['id', 'name', 'contract_end']);
        $services = DB::table('catalog_services')->whereNull('deleted_at')->where('status', 'activo')->whereBetween('valid_to', [$today, $this->today()->addDays(self::SERVICE_DAYS)->toDateString()])->get(['id', 'name', 'valid_to']);
        $unpriced = DB::table('catalog_products as p')->whereNull('p.deleted_at')->where('p.status', 'ACTIVE')
            ->whereNotExists(fn ($query) => $query->from('catalog_rates as r')->whereColumn('r.product_id', 'p.id')->where('r.status', 'vigente')->where('r.valid_from', '<=', $today)->where('r.valid_to', '>=', $today))
            ->get(['p.id', 'p.code', 'p.name']);
        $users = app(Advisors::class)->all(['operations', 'manager', 'tenant_admin'])->pluck('id')->map(fn (mixed $id): string => (string) $id);
        $sent = 0;

        foreach ($users as $userId) {
            foreach ($contracts as $provider) {
                $sent += $this->notifyOnce('proveedor.contrato_por_vencer', $userId, 'catalog_provider', (string) $provider->id, "Contrato de {$provider->name} por vencer", 'Vence el '.Carbon::parse($provider->contract_end)->format('d/m/Y').'. Renuévalo para seguir vendiendo sus servicios.', false) ? 1 : 0;
            }

            foreach ($services as $service) {
                $sent += $this->notifyOnce('servicio.vigencia_por_vencer', $userId, 'catalog_service', (string) $service->id, "Servicio {$service->name} por vencer", 'Su vigencia termina el '.Carbon::parse($service->valid_to)->format('d/m/Y').'.', false) ? 1 : 0;
            }

            foreach ($unpriced as $product) {
                $sent += $this->notifyOnce('producto.sin_tarifa', $userId, 'catalog_product', (string) $product->id, "{$product->code} sin tarifa vigente", "{$product->name} está activo, pero no tiene una tarifa vigente: no se puede cotizar ni vender.", true) ? 1 : 0;
            }
        }

        if ($contracts->isEmpty() && $services->isEmpty() && $unpriced->isEmpty()) {
            return 'Contratos, servicios y tarifas al día';
        }

        return self::summary([
            $contracts->isNotEmpty() ? self::plural($contracts->count(), 'contrato por vencer', 'contratos por vencer') : null,
            $services->isNotEmpty() ? self::plural($services->count(), 'servicio por vencer', 'servicios por vencer') : null,
            $unpriced->isNotEmpty() ? self::plural($unpriced->count(), 'producto sin tarifa', 'productos sin tarifa') : null,
            self::plural($sent, 'aviso', 'avisos'),
        ], 'Sin avisos');
    }
}
