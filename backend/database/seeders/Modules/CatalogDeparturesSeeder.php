<?php

declare(strict_types=1);

namespace Database\Seeders\Modules;

use App\Domain\Platform\Models\Tenant;
use Database\Support\KitSeeds;
use Database\Support\SeedsTenant;

final class CatalogDeparturesSeeder
{
    public const ORDER = 60;

    use SeedsTenant;

    private const STATUSES = ['abierta', 'completa', 'cerrada', 'cancelada'];

    public function __construct(private readonly Tenant $tenant) {}

    protected function tenant(): Tenant
    {
        return $this->tenant;
    }

    public function run(): void
    {
        $plates = collect(KitSeeds::read('vehicles'))->pluck('plate', 'id');
        $departures = [];

        foreach (KitSeeds::read('products') as $product) {
            $productId = $this->idByCode('catalog_products', $product['id'], 'ref');

            if ($productId === null) {
                continue;
            }

            foreach ($product['departures'] ?? [] as $seed) {
                $capacity = max(1, min(60, (int) $seed['capacity']));
                $sold = max(0, min($capacity, (int) ($seed['sold'] ?? 0)));
                $departures[$seed['id']] = $this->upsert('catalog_product_departures', ['ref' => $seed['id']], [
                    'product_id' => $productId,
                    'departure_date' => $this->day($seed['date']),
                    'departure_time' => $seed['time'] ?? '08:00',
                    'capacity' => $capacity,
                    'sold' => $sold,
                    'status' => in_array($seed['status'] ?? '', self::STATUSES, true) ? $seed['status'] : 'abierta',
                    'guide_id' => $this->idByCode('ops_guides', $seed['guideId'] ?? null),
                    'vehicle_id' => $this->idByCode('ops_vehicles', $plates[$seed['vehicleId'] ?? ''] ?? null, 'plate'),
                    'meeting_point' => $seed['meeting'] ?? 'Por confirmar',
                    'return_point' => $seed['ret'] ?? null,
                    'notes' => $seed['notes'] ?? null,
                ]);
            }
        }

        foreach (KitSeeds::read('catalogHolds') as $seed) {
            $departureId = $departures[$seed['depId']] ?? null;

            if ($departureId === null) {
                continue;
            }

            $this->upsert('catalog_availability_holds', ['ref' => $seed['id']], [
                'departure_id' => $departureId,
                'quantity' => $seed['qty'],
                'reference' => $seed['ref'],
                'reference_type' => match (true) {
                    str_starts_with($seed['ref'], 'COT-') => 'quote',
                    str_starts_with($seed['ref'], 'RES-') => 'reservation',
                    str_starts_with($seed['ref'], 'WEB-') => 'order',
                    default => null,
                },
                'status' => $seed['status'],
                'expires_at' => $this->moment($seed['expiresAt']),
                'released_reason' => $seed['status'] === 'liberada' ? ($seed['notes'] ?? 'Liberado') : null,
                'notes' => $seed['notes'] ?? null,
                'created_by' => str_starts_with((string) ($seed['user'] ?? ''), 'U') ? $this->userId($seed['user']) : null,
                'created_at' => $this->moment($seed['createdAt']),
            ]);
        }
    }
}
