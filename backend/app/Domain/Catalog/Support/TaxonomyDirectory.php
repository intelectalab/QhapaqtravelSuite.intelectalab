<?php

declare(strict_types=1);

namespace App\Domain\Catalog\Support;

use App\Domain\Iam\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

final class TaxonomyDirectory
{
    public function types(User $viewer): array
    {
        $products = $this->products()->groupBy('product_type_id');

        return [
            'types' => DB::table('catalog_product_types')->whereNull('deleted_at')->orderBy('sort_order')->orderBy('name')
                ->get(['id', 'name', 'requires_itinerary', 'requires_components', 'sort_order', 'updated_at'])
                ->map(fn (object $type): array => [
                    'id' => $type->id,
                    'name' => $type->name,
                    'requires_itinerary' => (bool) $type->requires_itinerary,
                    'requires_components' => (bool) $type->requires_components,
                    'sort_order' => (int) $type->sort_order,
                    'version' => (string) $type->updated_at,
                    'products' => $this->names($products, $type->id),
                ])->values(),
            'can' => ['manage' => $viewer->can('catalog.products.update')],
        ];
    }

    public function categories(User $viewer): array
    {
        $products = $this->products();
        $byCategory = $products->groupBy('category_id');
        $bySubcategory = $products->whereNotNull('subcategory_id')->groupBy('subcategory_id');
        $subcategories = DB::table('catalog_product_subcategories')->whereNull('deleted_at')->orderBy('name')->get(['id', 'category_id', 'name', 'updated_at'])->groupBy('category_id');

        $categories = [];

        foreach (DB::table('catalog_product_categories')->whereNull('deleted_at')->orderBy('name')->get(['id', 'ref', 'name', 'updated_at']) as $category) {
            $subs = [];

            foreach (ProviderDirectory::group($subcategories, $category->id) as $sub) {
                $subs[] = ['id' => $sub->id, 'name' => $sub->name, 'version' => (string) $sub->updated_at, 'products' => $this->names($bySubcategory, $sub->id)];
            }

            $categories[] = [
                'id' => $category->id,
                'ref' => $category->ref,
                'name' => $category->name,
                'version' => (string) $category->updated_at,
                'products' => $this->names($byCategory, $category->id),
                'subcategories' => $subs,
            ];
        }

        return ['categories' => $categories, 'can' => ['manage' => $viewer->can('catalog.products.update')]];
    }

    private function products(): Collection
    {
        return DB::table('catalog_products')->whereNull('deleted_at')->orderBy('name')->get(['code', 'name', 'status', 'product_type_id', 'category_id', 'subcategory_id']);
    }

    private function names(Collection $grouped, string $key): array
    {
        return array_map(fn (object $product): array => ['code' => $product->code, 'name' => $product->name, 'status' => $product->status], ProviderDirectory::group($grouped, $key));
    }
}
