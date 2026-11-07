<?php

declare(strict_types=1);

namespace Database\Seeders\Modules;

use App\Domain\Platform\Models\Tenant;
use Database\Support\KitSeeds;
use Database\Support\SeedsTenant;
use Illuminate\Support\Facades\DB;

final class B2bPortalSeeder
{
    use SeedsTenant;

    public const ORDER = 55;

    public function __construct(private readonly Tenant $tenant) {}

    protected function tenant(): Tenant
    {
        return $this->tenant;
    }

    public function run(): void
    {
        foreach (KitSeeds::read('products') as $product) {
            $productId = $this->idByCode('catalog_products', $product['code']);

            if ($productId === null) {
                continue;
            }

            $general = collect($product['rates'] ?? [])->first(fn (array $rate): bool => ($rate['channel'] ?? null) === 'B2B');

            foreach ($product['b2b'] ?? [] as $seed) {
                $agency = DB::table('channel_b2b_agencies')->where('tenant_id', $this->tenant->getKey())->where('code', $seed['agencyId'])->first(['id', 'price_list_id']);

                if ($agency === null) {
                    continue;
                }

                $this->upsert('catalog_product_b2b_rates', ['product_id' => $productId, 'agency_id' => $agency->id], [
                    'price_list_id' => $agency->price_list_id,
                    'price_list' => $seed['priceList'],
                    'price' => $seed['price'],
                    'currency' => $general['currency'] ?? 'USD',
                    'commission_pct' => $seed['commissionPct'],
                    'is_credit' => (bool) $seed['credit'],
                    'valid_to' => $this->day($general['validTo'] ?? null),
                    'conditions' => 'Tarifa neta por pasajero. Incluye los servicios publicados en la ficha del producto.',
                    'restrictions' => $seed['credit'] ? null : 'Solo prepago.',
                    'created_by' => $this->userId('U01'),
                ]);
            }
        }
    }
}
