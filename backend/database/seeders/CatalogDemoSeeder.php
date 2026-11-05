<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Domain\Platform\Models\Tenant;
use Database\Support\KitSeeds;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class CatalogDemoSeeder
{
    private const ITEM_TYPES = ['Traslado', 'Transporte', 'Tren', 'Hotel', 'Alimentación', 'Guía', 'Actividad', 'Entrada', 'Libre', 'Otro'];

    private const PROVIDER_TYPES = ['Hotel', 'Transporte', 'Tren', 'Guía', 'Conductor', 'Restaurante', 'Operador', 'Actividad', 'Entrada', 'Otros'];

    private const AVAILABILITY = ['SIN_CONTROL', 'CUPOS', 'CAPACIDAD', 'POR_PROVEEDOR', 'POR_ACTIVIDAD', 'POR_TRANSPORTE', 'POR_HABITACION', 'POR_SALIDA', 'POR_FECHA'];

    private array $types = [];

    private array $categories = [];

    private array $subcategories = [];

    private array $destinations = [];

    private array $providers = [];

    public function __construct(private readonly Tenant $tenant)
    {
    }

    public function run(): void
    {
        $this->seedTypes();
        $this->seedCategories();
        $this->seedDestinations();
        $this->seedProviders();
        $this->seedProducts();
    }

    private function seedTypes(): void
    {
        foreach (KitSeeds::read('productTypes') as $index => $name) {
            $this->types[$name] = $this->row('catalog_product_types', ['name' => $name], [
                'requires_itinerary' => in_array($name, ['PAQUETE', 'CIRCUITO', 'PROGRAMA TURÍSTICO'], true),
                'sort_order' => $index + 1,
            ]);
        }
    }

    private function seedCategories(): void
    {
        foreach (KitSeeds::read('categories') as $seed) {
            $id = $this->categories[$seed['name']] = $this->row('catalog_product_categories', ['ref' => $seed['id']], ['name' => $seed['name']]);
            foreach ($seed['subs'] ?? [] as $sub) {
                $this->subcategories["{$seed['name']}|{$sub}"] = $this->row('catalog_product_subcategories', ['category_id' => $id, 'name' => $sub], []);
            }
        }
    }

    private function seedDestinations(): void
    {
        $seeds = collect(KitSeeds::read('destinations'))->keyBy('id');
        $level = function (array $seed) use ($seeds, &$level): int {
            return $seed['parent'] ? $level($seeds[$seed['parent']]) + 1 : 0;
        };
        $path = function (array $seed) use ($seeds, &$path): string {
            return $seed['parent'] ? $path($seeds[$seed['parent']]).' / '.$seed['name'] : $seed['name'];
        };

        foreach ($seeds->sortBy(fn (array $seed) => $level($seed)) as $seed) {
            $this->destinations[$seed['id']] = $this->row('catalog_destinations', ['ref' => $seed['id']], [
                'parent_id' => $seed['parent'] ? $this->destinations[$seed['parent']] : null,
                'name' => $seed['name'],
                'type' => $seed['type'],
                'level' => min(6, $level($seed)),
                'lat' => $seed['lat'] ?? null,
                'lng' => isset($seed['lat']) ? ($seed['lng'] ?? null) : null,
                'description' => $seed['desc'] ?? null,
                'path' => $path($seed),
            ]);
        }
    }

    private function seedProviders(): void
    {
        foreach (KitSeeds::read('providers') as $seed) {
            $this->providers[$seed['id']] = $this->row('catalog_providers', ['ref' => $seed['id']], [
                'name' => $seed['name'],
                'type' => in_array($seed['type'], self::PROVIDER_TYPES, true) ? $seed['type'] : 'Otros',
                'ruc' => $seed['ruc'],
                'city' => $seed['city'] ?? null,
                'stars' => $seed['stars'] ?? null,
                'contact_name' => $seed['contact'] ?? $seed['name'],
                'phone' => $seed['phone'] ?? null,
                'email' => $seed['email'] ?? null,
                'contract_start' => $seed['contractStart'],
                'contract_end' => $seed['contractEnd'],
                'currency' => $seed['currency'] ?? 'PEN',
                'payment_terms' => $seed['paymentTerms'] ?? null,
                'status' => $seed['status'] ?? 'activo',
                'rating' => $seed['rating'] ?? 0,
            ]);
        }
    }

    private function seedProducts(): void
    {
        foreach (KitSeeds::read('products') as $seed) {
            $flags = $seed['flags'] ?? [];
            $productId = $this->row('catalog_products', ['ref' => $seed['id']], [
                'code' => $seed['code'],
                'sku' => $seed['sku'],
                'name' => $seed['name'],
                'internal_name' => $seed['internalName'] ?? $seed['name'],
                'product_type_id' => $this->types[$seed['type']] ?? reset($this->types),
                'category_id' => $this->categories[$seed['category']] ?? reset($this->categories),
                'subcategory_id' => $this->subcategories["{$seed['category']}|".($seed['subcategory'] ?? '')] ?? null,
                'primary_destination_id' => $this->destinations[$seed['destId']] ?? reset($this->destinations),
                'status' => $seed['status'],
                'short_description' => $seed['short'] ?? null,
                'long_description' => $seed['long'] ?? null,
                'duration_value' => max(1, (float) ($seed['durationValue'] ?? 1)),
                'duration_unit' => $seed['durationUnit'] ?? 'horas',
                'modality' => $seed['modality'] ?? 'Compartido',
                'main_provider_id' => $this->providers[$seed['mainProviderId'] ?? ''] ?? null,
                'minimum_passengers' => $seed['minPax'] ?? 1,
                'maximum_passengers' => max($seed['minPax'] ?? 1, $seed['maxPax'] ?? 1),
                'minimum_age' => $seed['minAge'] ?? 0,
                'maximum_age' => $seed['maxAge'] ?? 99,
                'booking_advance_min_days' => $seed['advMin'] ?? 0,
                'booking_advance_max_days' => max($seed['advMin'] ?? 0, $seed['advMax'] ?? 365),
                'is_bookable' => (bool) ($flags['bookable'] ?? true),
                'is_quoteable' => (bool) ($flags['quoteable'] ?? true),
                'is_b2b' => (bool) ($flags['b2b'] ?? false),
                'is_ecommerce' => (bool) ($flags['ecommerce'] ?? false),
                'is_featured' => (bool) ($flags['featured'] ?? false),
                'markup_pct' => $seed['markupPct'] ?? 25,
                'availability_model' => in_array($seed['availabilityModel'] ?? '', self::AVAILABILITY, true) ? $seed['availabilityModel'] : 'SIN_CONTROL',
                'slug' => Str::slug($seed['name']),
            ]);

            $this->seedItinerary($productId, $seed['itinerary'] ?? []);
            $this->seedTexts($productId, $seed);
            $this->seedRates($productId, $seed['rates'] ?? []);
        }
    }

    private function seedItinerary(string $productId, array $days): void
    {
        DB::table('catalog_itineraries')->where('product_id', $productId)->delete();
        if ($days === []) {
            return;
        }

        $itineraryId = $this->insert('catalog_itineraries', ['product_id' => $productId, 'name' => 'Principal', 'is_default' => true]);
        foreach ($days as $day) {
            $dayId = $this->insert('catalog_itinerary_days', ['itinerary_id' => $itineraryId, 'day_number' => $day['day'], 'title' => Str::limit($day['title'], 155)]);
            foreach ($day['items'] ?? [] as $item) {
                $this->insert('catalog_itinerary_items', [
                    'day_id' => $dayId,
                    'start_time' => preg_match('/^\d{1,2}:\d{2}$/', (string) ($item['time'] ?? '')) ? $item['time'] : null,
                    'activity' => Str::limit($item['activity'], 195),
                    'item_type' => in_array($item['type'] ?? '', self::ITEM_TYPES, true) ? $item['type'] : 'Otro',
                    'location' => $item['location'] ?? null,
                ]);
            }
        }
    }

    private function seedTexts(string $productId, array $seed): void
    {
        DB::table('catalog_product_inclusions')->where('product_id', $productId)->delete();
        foreach (['include' => $seed['inclusions'] ?? [], 'exclude' => $seed['exclusions'] ?? []] as $kind => $texts) {
            foreach ($texts as $index => $text) {
                $this->insert('catalog_product_inclusions', ['product_id' => $productId, 'kind' => $kind, 'text' => Str::limit($text, 195), 'sort_order' => $index + 1]);
            }
        }

        DB::table('catalog_product_requirements')->where('product_id', $productId)->delete();
        foreach ($seed['requirements'] ?? [] as $text) {
            $this->insert('catalog_product_requirements', ['product_id' => $productId, 'text' => Str::limit($text, 295)]);
        }

        DB::table('catalog_product_policies')->where('product_id', $productId)->delete();
        if ($policies = $seed['policies'] ?? null) {
            $this->insert('catalog_product_policies', [
                'product_id' => $productId,
                'cancellation' => $policies['cancel'] ?? 'Según condiciones del proveedor.',
                'modification' => $policies['modify'] ?? 'Sujeto a disponibilidad.',
                'no_show' => $policies['noshow'] ?? 'Se factura al 100 %.',
                'penalties' => $policies['penalties'] ?? null,
                'refund' => $policies['refund'] ?? 'Por el mismo medio de pago.',
                'advance_min' => $policies['advanceMin'] ?? null,
                'advance_max' => $policies['advanceMax'] ?? null,
            ]);
        }
    }

    private function seedRates(string $productId, array $rates): void
    {
        DB::table('catalog_rates')->where('product_id', $productId)->delete();
        foreach ($rates as $rate) {
            $this->insert('catalog_rates', [
                'ref' => $rate['id'],
                'product_id' => $productId,
                'rate_type' => $rate['type'],
                'segment' => $rate['segment'],
                'channel' => $rate['channel'],
                'currency' => $rate['currency'],
                'price_basis' => $rate['basis'] ?? 'Por persona',
                'cost' => $rate['cost'],
                'price' => $rate['price'],
                'valid_from' => $rate['validFrom'],
                'valid_to' => $rate['validTo'],
                'conditions' => $rate['conditions'] ?? null,
                'status' => ($rate['status'] ?? 'vigente') === 'vigente' ? 'vigente' : 'inactiva',
            ]);
        }
    }

    private function row(string $table, array $key, array $values): string
    {
        $where = ['tenant_id' => $this->tenant->getKey(), ...$key];
        $existing = DB::table($table)->where($where)->value('id');

        if ($existing) {
            if ($values !== []) {
                DB::table($table)->where('id', $existing)->update($values);
            }

            return $existing;
        }

        return $this->insert($table, [...$key, ...$values]);
    }

    private function insert(string $table, array $values): string
    {
        $id = (string) Str::uuid7();
        DB::table($table)->insert(['id' => $id, 'tenant_id' => $this->tenant->getKey(), ...$values]);

        return $id;
    }
}
