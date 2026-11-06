<?php

declare(strict_types=1);

namespace App\Domain\Catalog\Support;

use App\Domain\Iam\Models\User;
use Illuminate\Support\Facades\DB;

final class ProductOptions
{
    public const UNITS = ['horas', 'días', 'noches'];

    public const MODALITIES = ['Compartido', 'Privado', 'Grupal'];

    public const AVAILABILITY = ['SIN_CONTROL', 'CUPOS', 'CAPACIDAD', 'POR_PROVEEDOR', 'POR_ACTIVIDAD', 'POR_TRANSPORTE', 'POR_HABITACION', 'POR_SALIDA', 'POR_FECHA'];

    public function all(User $user): array
    {
        $subcategories = DB::table('catalog_product_subcategories')->whereNull('deleted_at')->orderBy('name')->get(['id', 'category_id', 'name'])->groupBy('category_id');

        return [
            'types' => DB::table('catalog_product_types')->whereNull('deleted_at')->orderBy('sort_order')->orderBy('name')->get(['id', 'name']),
            'categories' => DB::table('catalog_product_categories')->whereNull('deleted_at')->orderBy('name')->get(['id', 'name'])
                ->map(fn (object $category) => ['id' => $category->id, 'name' => $category->name, 'subcategories' => ($subcategories[$category->id] ?? collect())->map(fn (object $sub) => ['id' => $sub->id, 'name' => $sub->name])->values()]),
            'destinations' => DB::table('catalog_destinations')->whereNull('deleted_at')->orderBy('path')->get(['id', 'name', 'path', 'level']),
            'providers' => DB::table('catalog_providers')->whereNull('deleted_at')->where('status', 'activo')->orderBy('name')->get(['id', 'name', 'type']),
            'units' => self::UNITS,
            'modalities' => self::MODALITIES,
            'availability' => self::AVAILABILITY,
            'can_create' => $user->can('catalog.products.create'),
            'can_update' => $user->can('catalog.products.update'),
            'can_activate' => $user->can('catalog.products.activate'),
        ];
    }
}
