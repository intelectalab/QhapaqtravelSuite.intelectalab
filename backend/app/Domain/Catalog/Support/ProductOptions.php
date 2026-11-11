<?php

declare(strict_types=1);

namespace App\Domain\Catalog\Support;

use App\Domain\Catalog\Actions\ProductWorkflow;
use App\Domain\Iam\Models\User;
use Illuminate\Support\Facades\DB;

final class ProductOptions
{
    public const UNITS = ['horas', 'días', 'noches'];

    public const MODALITIES = ['Compartido', 'Privado', 'Grupal'];

    public const AVAILABILITY = ['SIN_CONTROL', 'CUPOS', 'CAPACIDAD', 'POR_PROVEEDOR', 'POR_ACTIVIDAD', 'POR_TRANSPORTE', 'POR_HABITACION', 'POR_SALIDA', 'POR_FECHA'];

    public const DEFAULT_EXCLUSIONS = ['Propinas', 'Bebidas', 'Gastos personales', 'Servicios no especificados'];

    public function all(User $user): array
    {
        $today = CatalogAccess::today();
        $seesCost = CatalogAccess::seesCost($user);
        $seesNet = CatalogAccess::seesNetRates($user);
        $subcategories = DB::table('catalog_product_subcategories')->whereNull('deleted_at')->orderBy('name')->get(['id', 'category_id', 'name'])->groupBy('category_id');

        return [
            'types' => DB::table('catalog_product_types')->whereNull('deleted_at')->orderBy('sort_order')->orderBy('name')->get(['id', 'name', 'requires_itinerary', 'requires_components']),
            'categories' => DB::table('catalog_product_categories')->whereNull('deleted_at')->orderBy('name')->get(['id', 'name'])
                ->map(fn (object $category) => ['id' => $category->id, 'name' => $category->name, 'subcategories' => ($subcategories[$category->id] ?? collect())->map(fn (object $sub) => ['id' => $sub->id, 'name' => $sub->name])->values()]),
            'destinations' => DB::table('catalog_destinations')->whereNull('deleted_at')->orderBy('path')->get(['id', 'name', 'path', 'level']),
            'providers' => DB::table('catalog_providers')->whereNull('deleted_at')->orderBy('name')->get(['id', 'name', 'type', 'status', 'contract_end'])
                ->map(fn (object $provider) => [
                    'id' => $provider->id,
                    'name' => $provider->name,
                    'type' => $provider->type,
                    'blocked' => $provider->status !== 'activo' ? 'Proveedor inactivo' : ($provider->contract_end < $today ? 'Contrato vencido' : null),
                ]),
            'services' => DB::table('catalog_services as s')->join('catalog_providers as pv', 'pv.id', '=', 's.provider_id')->whereNull('s.deleted_at')->orderBy('s.type')->orderBy('s.name')
                ->get(['s.id', 's.ref', 's.name', 's.type', 's.unit', 's.cost', 's.currency', 's.status', 's.valid_to', 's.provider_id', 'pv.name as provider', 'pv.status as provider_status', 'pv.contract_end', 'pv.deleted_at as provider_deleted'])
                ->map(fn (object $service) => [
                    'id' => $service->id,
                    'ref' => $service->ref,
                    'name' => $service->name,
                    'type' => $service->type,
                    'unit' => $service->unit,
                    'cost' => $seesCost ? $service->cost : null,
                    'currency' => $service->currency,
                    'provider_id' => $service->provider_id,
                    'provider' => $service->provider,
                    'blocked' => match (true) {
                        $service->status !== 'activo' || $service->valid_to < $today => 'Servicio vencido o inactivo',
                        $service->provider_status !== 'activo' || $service->provider_deleted !== null => 'Proveedor inactivo',
                        $service->contract_end < $today => 'Contrato del proveedor vencido',
                        default => null,
                    },
                ]),
            'products' => DB::table('catalog_products')->whereNull('deleted_at')->where('status', 'ACTIVE')->orderBy('name')->get(['id', 'code', 'name']),
            'seasons' => DB::table('catalog_seasons')->whereNull('deleted_at')->orderBy('date_from')->get(['id', 'ref', 'name', 'type', 'date_from', 'date_to', 'priority', 'factor', 'status']),
            'units' => self::UNITS,
            'modalities' => self::MODALITIES,
            'availability' => self::AVAILABILITY,
            'availability_sources' => ProductSectionRules::SOURCES,
            'item_types' => ProductSectionRules::ITEM_TYPES,
            'requirement_categories' => ProductSectionRules::REQUIREMENT_CATEGORIES,
            'destination_types' => array_keys(DestinationDirectory::RANKS),
            'season_types' => RateDirectory::SEASON_TYPES,
            'channels' => ProductSectionRules::CHANNELS,
            'rates' => [
                'types' => $seesNet ? RateDirectory::TYPES : array_values(array_diff(RateDirectory::TYPES, ['Proveedor', 'Costo', 'B2B', 'Mayorista'])),
                'segments' => RateDirectory::SEGMENTS,
                'channels' => $seesNet ? RateDirectory::CHANNELS : array_values(array_diff(RateDirectory::CHANNELS, ['B2B', 'Mayorista'])),
                'bases' => RateDirectory::BASES,
                'currencies' => CatalogAccess::CURRENCIES,
            ],
            'defaults' => [
                'policies' => ProductWorkflow::defaultPolicies(),
                'exclusions' => self::DEFAULT_EXCLUSIONS,
            ],
            'today' => $today,
            'can_create' => $user->can('catalog.products.create'),
            'can_update' => $user->can('catalog.products.update'),
            'can_activate' => $user->can('catalog.products.activate'),
            'can_manage_rates' => $user->can('catalog.products.manage_rates'),
            'can_publish' => $user->can('catalog.products.publish'),
            'can_manage_destinations' => $user->can('catalog.products.update'),
            'sees_cost' => $seesCost,
            'sees_margin' => CatalogAccess::seesMargin($user),
        ];
    }
}
