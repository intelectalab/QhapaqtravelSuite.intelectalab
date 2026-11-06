<?php

declare(strict_types=1);

namespace App\Domain\Catalog\Support;

use App\Domain\Iam\Models\User;
use Illuminate\Support\Facades\DB;

final class ServiceDirectory
{
    public const TYPES = ['Traslado', 'Transporte', 'Tren', 'Entrada', 'Guía', 'Alimentación', 'Alojamiento', 'Actividad', 'Tour', 'Seguro', 'Otro'];

    public const UNITS = ['pax', 'servicio', 'habitación', 'noche', 'vehículo', 'unidad'];

    public static function providerState(object $provider, string $today): string
    {
        return $provider->status === 'activo' && $provider->contract_end < $today ? 'vencido' : $provider->status;
    }

    public function overview(User $viewer): array
    {
        $today = CatalogAccess::today();
        $seesCost = CatalogAccess::seesCost($viewer);
        $usage = DB::table('catalog_product_items as i')->join('catalog_products as p', 'p.id', '=', 'i.product_id')->whereNull('p.deleted_at')->whereNotNull('i.service_id')
            ->get(['i.service_id', 'p.code', 'p.name'])->groupBy('service_id');

        $services = DB::table('catalog_services as s')
            ->join('catalog_providers as pv', 'pv.id', '=', 's.provider_id')
            ->whereNull('s.deleted_at')
            ->orderBy('s.name')
            ->get(['s.*', 'pv.ref as provider_ref', 'pv.name as provider_name', 'pv.status as provider_status', 'pv.contract_end'])
            ->map(function (object $service) use ($today, $seesCost, $usage) {
                $providerState = self::providerState((object) ['status' => $service->provider_status, 'contract_end' => $service->contract_end], $today);
                $products = [];

                foreach (ProviderDirectory::group($usage, $service->id) as $item) {
                    $products[$item->code] = ['code' => $item->code, 'name' => $item->name];
                }

                return [
                    'ref' => $service->ref,
                    'name' => $service->name,
                    'type' => $service->type,
                    'unit' => $service->unit,
                    'cost' => $seesCost ? $service->cost : null,
                    'currency' => trim($service->currency),
                    'capacity' => $service->capacity === null ? null : (int) $service->capacity,
                    'valid_from' => $service->valid_from,
                    'valid_to' => $service->valid_to,
                    'status' => $service->status,
                    'state' => $service->status === 'activo' && $service->valid_to < $today ? 'vencido' : $service->status,
                    'expires_in' => CatalogAccess::daysUntil($service->valid_to),
                    'provider' => ['id' => $service->provider_id, 'ref' => $service->provider_ref, 'name' => $service->provider_name, 'state' => $providerState],
                    'products' => array_values($products),
                ];
            });

        return [
            'today' => $today,
            'services' => $services,
            'options' => [
                'providers' => DB::table('catalog_providers')->whereNull('deleted_at')->orderBy('name')->get(['id', 'name', 'type', 'status', 'contract_end'])
                    ->map(fn (object $provider) => ['id' => $provider->id, 'name' => $provider->name, 'type' => $provider->type, 'state' => self::providerState($provider, $today)]),
                'types' => self::TYPES,
                'units' => self::UNITS,
                'currencies' => CatalogAccess::CURRENCIES,
            ],
            'can' => ['manage' => $viewer->can('catalog.providers.manage'), 'see_cost' => $seesCost],
        ];
    }
}
