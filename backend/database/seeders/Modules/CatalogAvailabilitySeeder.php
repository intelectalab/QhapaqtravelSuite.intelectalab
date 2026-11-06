<?php

declare(strict_types=1);

namespace Database\Seeders\Modules;

use App\Domain\Platform\Models\Tenant;
use Database\Support\KitSeeds;
use Database\Support\SeedsTenant;

final class CatalogAvailabilitySeeder
{
    public const ORDER = 70;

    use SeedsTenant;

    public function __construct(private readonly Tenant $tenant) {}

    protected function tenant(): Tenant
    {
        return $this->tenant;
    }

    public function run(): void
    {
        foreach (KitSeeds::read('products') as $product) {
            $productId = $this->idByCode('catalog_products', $product['id'], 'ref');

            if ($productId === null) {
                continue;
            }

            foreach ($product['availability']['ranges'] ?? [] as $seed) {
                $open = $seed['status'] === 'disponible';
                $this->upsert('catalog_availability_ranges', ['code' => $seed['id']], [
                    'product_id' => $productId,
                    'date_from' => $this->day($seed['from']),
                    'date_to' => $this->day($seed['to']),
                    'status' => $seed['status'],
                    'capacity_per_day' => $open ? max(1, (int) $seed['capacityPerDay']) : 0,
                    'note' => ($seed['note'] ?? '') !== '' ? $seed['note'] : null,
                    'deleted_at' => null,
                ]);
            }
        }
    }
}
