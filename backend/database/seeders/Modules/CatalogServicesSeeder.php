<?php

declare(strict_types=1);

namespace Database\Seeders\Modules;

use App\Domain\Platform\Models\Tenant;
use Database\Support\KitSeeds;
use Database\Support\SeedsTenant;

final class CatalogServicesSeeder
{
    public const ORDER = 20;

    use SeedsTenant;

    private const UNITS = ['pax', 'servicio', 'habitación', 'noche', 'vehículo', 'unidad'];

    public function __construct(private readonly Tenant $tenant) {}

    protected function tenant(): Tenant
    {
        return $this->tenant;
    }

    public function run(): void
    {
        $providers = [];

        foreach (KitSeeds::read('providers') as $seed) {
            $providerId = $providers[$seed['id']] = $this->idByCode('catalog_providers', $seed['id'], 'ref');

            if ($providerId && ($seed['contact'] ?? '') !== '') {
                $this->upsert('catalog_provider_contacts', ['provider_id' => $providerId, 'name' => $seed['contact']], [
                    'role' => 'Contacto comercial',
                    'phone' => $seed['phone'] ?? null,
                    'email' => $seed['email'] ?? null,
                ]);
            }
        }

        $services = [];

        foreach (KitSeeds::read('services') as $seed) {
            $providerId = $providers[$seed['providerId']] ?? null;

            if ($providerId === null) {
                continue;
            }

            $services[$seed['id']] = ['id' => $this->upsert('catalog_services', ['ref' => $seed['id']], [
                'provider_id' => $providerId,
                'name' => $seed['name'],
                'type' => $seed['type'],
                'unit' => in_array($seed['unit'], self::UNITS, true) ? $seed['unit'] : 'unidad',
                'cost' => $seed['cost'],
                'currency' => $seed['currency'],
                'capacity' => $seed['capacity'] ?? null,
                'valid_from' => $seed['validFrom'],
                'valid_to' => $seed['validTo'],
                'status' => $seed['status'],
                'deleted_at' => null,
            ]), 'provider' => $providerId, 'unit' => $seed['unit']];
        }

        foreach (KitSeeds::read('products') as $product) {
            $productId = $this->idByCode('catalog_products', $product['id'], 'ref');

            if ($productId === null) {
                continue;
            }

            foreach ($product['components'] ?? [] as $index => $component) {
                $service = $services[$component['serviceId'] ?? ''] ?? null;

                if ($service === null) {
                    continue;
                }

                $this->upsert('catalog_product_items', ['product_id' => $productId, 'service_id' => $service['id']], [
                    'provider_id' => $service['provider'],
                    'quantity' => max(1, (float) ($component['qty'] ?? 1)),
                    'unit' => in_array($component['unit'] ?? '', self::UNITS, true) ? $component['unit'] : (in_array($service['unit'], self::UNITS, true) ? $service['unit'] : 'unidad'),
                    'sort_order' => $component['order'] ?? $index + 1,
                    'is_required' => (bool) ($component['required'] ?? true),
                    'is_included' => (bool) ($component['included'] ?? true),
                    'notes' => ($component['notes'] ?? '') !== '' ? $component['notes'] : null,
                ]);
            }
        }
    }
}
