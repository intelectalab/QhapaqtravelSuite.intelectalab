<?php

declare(strict_types=1);

namespace Database\Seeders\Modules;

use App\Domain\Platform\Models\Tenant;
use Database\Support\KitSeeds;
use Database\Support\SeedsTenant;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class CatalogSeasonsSeeder
{
    public const ORDER = 10;

    use SeedsTenant;

    public function __construct(private readonly Tenant $tenant) {}

    protected function tenant(): Tenant
    {
        return $this->tenant;
    }

    public function run(): void
    {
        $seasons = [];

        foreach (KitSeeds::read('seasons') as $seed) {
            $seasons[$seed['id']] = $this->upsert('catalog_seasons', ['ref' => $seed['id']], [
                'name' => $seed['name'],
                'type' => $seed['type'],
                'date_from' => $seed['from'],
                'date_to' => $seed['to'],
                'priority' => $seed['priority'],
                'factor' => $seed['factor'],
                'status' => $seed['status'] === 'activa' ? 'activa' : 'inactiva',
                'deleted_at' => null,
            ]);
        }

        foreach (KitSeeds::read('products') as $product) {
            $productId = $this->idByCode('catalog_products', $product['id'], 'ref');

            if ($productId === null) {
                continue;
            }

            $linked = $product['seasons'] ?? [];

            foreach ($product['rates'] ?? [] as $rate) {
                $seasonId = $seasons[$rate['season'] ?? ''] ?? null;
                DB::table('catalog_rates')->where('tenant_id', $this->tenant->getKey())->where('ref', $rate['id'])->update(['season_id' => $seasonId]);
                $linked[] = $rate['season'] ?? null;
            }

            foreach (array_unique(array_filter($linked)) as $ref) {
                $key = ['tenant_id' => $this->tenant->getKey(), 'product_id' => $productId, 'season_id' => $seasons[$ref] ?? null];

                if ($key['season_id'] && ! DB::table('catalog_product_seasons')->where($key)->exists()) {
                    DB::table('catalog_product_seasons')->insert([...$key, 'id' => (string) Str::uuid7()]);
                }
            }
        }
    }
}
