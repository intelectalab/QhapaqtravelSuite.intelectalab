<?php

declare(strict_types=1);

namespace App\Domain\Catalog\Actions;

use App\Domain\Catalog\Support\CancellationTiers;
use App\Domain\Catalog\Support\CatalogAccess;
use App\Domain\Catalog\Support\ProductSectionRules;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use App\Domain\Shared\Money\Decimal;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class ProductSections
{
    public const CHANNEL_LABELS = ['erp' => 'ERP', 'crm' => 'CRM', 'quotes' => 'Cotizaciones', 'b2b' => 'B2B', 'portal' => 'Portal cliente', 'portal_pax' => 'Portal pasajero', 'cms' => 'CMS', 'ecommerce' => 'E-commerce', 'mobile' => 'Mobile'];

    private const POLICY_LABELS = ['cancellation' => 'cancelación', 'modification' => 'cambios', 'no_show' => 'no-show', 'refund' => 'reembolsos', 'penalties' => 'penalidades', 'date_change' => 'cambio de fecha'];

    public function __construct(private readonly AuditLogger $audit) {}

    public function edit(string $code, ?int $version, User $actor, callable $work): int
    {
        return DB::transaction(function () use ($code, $version, $actor, $work): int {
            $product = DB::table('catalog_products')->where('code', $code)->whereNull('deleted_at')->lock('for no key update')->first()
                ?? throw ApiException::notFound('El producto no existe.');

            if ($product->status === 'ARCHIVED') {
                throw ApiException::conflict('PRD-ARCHIVED', 'Un producto archivado no se edita.');
            }

            if ($version !== null && (int) $product->lock_version !== $version) {
                throw ApiException::conflict('STALE_VERSION', 'Alguien cambió este producto mientras lo veías. Recarga la página e inténtalo de nuevo.');
            }

            DB::table('catalog_products')->where('id', $product->id)->update(['lock_version' => (int) $product->lock_version + 1, 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
            $work($product);

            return (int) DB::table('catalog_products')->where('id', $product->id)->value('lock_version');
        });
    }

    public function currentComponents(string $productId): array
    {
        return DB::table('catalog_product_items')->where('product_id', $productId)->orderBy('sort_order')
            ->get(['id', 'service_id', 'component_product_id', 'quantity', 'is_required', 'is_included', 'notes'])
            ->map(fn (object $row) => [
                'id' => $row->id,
                'service_id' => $row->service_id,
                'component_product_id' => $row->component_product_id,
                'quantity' => (float) $row->quantity,
                'is_required' => (bool) $row->is_required,
                'is_included' => (bool) $row->is_included,
                'notes' => $row->notes,
            ])->all();
    }

    public function currentItinerary(string $productId): array
    {
        $itinerary = $this->itineraryId($productId);
        $days = $itinerary ? DB::table('catalog_itinerary_days')->where('itinerary_id', $itinerary)->orderBy('day_number')->get(['id', 'title'])->all() : [];
        $items = DB::table('catalog_itinerary_items as i')->leftJoin('catalog_services as s', 's.id', '=', 'i.service_id')->whereIn('i.day_id', array_column($days, 'id'))->orderBy('i.start_time')
            ->get(['i.id', 'i.day_id', 'i.start_time', 'i.activity', 'i.item_type', 'i.location', 'i.service_id', 'i.note', 'i.image_ref', 'i.cost', 'i.price', 's.name as service_name'])->groupBy('day_id');
        $result = [];

        foreach ($days as $day) {
            $activities = [];
            foreach ($items[$day->id] ?? [] as $item) {
                $activities[] = [
                    'id' => $item->id, 'time' => $item->start_time ? substr((string) $item->start_time, 0, 5) : null, 'activity' => $item->activity, 'type' => $item->item_type, 'location' => $item->location,
                    'service_id' => $item->service_id, 'service' => $item->service_name, 'note' => $item->note, 'image_ref' => $item->image_ref, 'cost' => (string) $item->cost, 'price' => (string) $item->price,
                ];
            }
            $result[] = ['id' => $day->id, 'title' => $day->title, 'items' => $activities];
        }

        return $result;
    }

    public function itineraryId(string $productId, ?User $create = null): ?string
    {
        $id = DB::table('catalog_itineraries')->where('product_id', $productId)->where('is_default', true)->value('id');

        if (! $id && $create) {
            $id = (string) Str::uuid7();
            DB::table('catalog_itineraries')->insert(['id' => $id, 'product_id' => $productId, 'name' => 'Principal', 'is_default' => true, 'created_by' => $create->getKey()]);
        }

        return $id ? (string) $id : null;
    }

    public function secondaryDestinations(object $product, array $ids, User $actor): void
    {
        $ids = array_values(array_diff(array_unique($ids), [$product->primary_destination_id]));

        if (DB::table('catalog_destinations')->whereIn('id', $ids)->whereNull('deleted_at')->count() !== count($ids)) {
            throw ApiException::unprocessable('CAT-BR-03', 'Uno de los destinos secundarios ya no existe.');
        }

        $current = DB::table('catalog_product_destinations')->where('product_id', $product->id)->pluck('destination_id')->all();
        $removed = array_values(array_diff($current, $ids));
        $added = array_values(array_diff($ids, $current));

        DB::table('catalog_product_destinations')->where('product_id', $product->id)->whereIn('destination_id', $removed)->delete();
        if ($added !== []) {
            DB::table('catalog_product_destinations')->insert(array_map(fn (string $id) => ['product_id' => $product->id, 'destination_id' => $id, 'role' => 'secondary', 'created_by' => $actor->getKey()], $added));
        }

        $names = DB::table('catalog_destinations')->whereIn('id', [...$added, ...$removed])->pluck('name', 'id');
        foreach ($added as $id) {
            $this->note($product, "Agregó destino secundario {$names[$id]}");
        }
        foreach ($removed as $id) {
            $this->note($product, "Quitó destino secundario {$names[$id]}");
        }
    }

    public function mainProvider(object $product, ?string $providerId, User $actor, ?string $reason = null): void
    {
        if ($providerId && $providerId !== $product->main_provider_id && ! $this->providerActive($providerId)) {
            throw ApiException::unprocessable('PRD-BR-007', 'Elige un proveedor activo y con contrato vigente.');
        }

        if ($providerId !== $product->main_provider_id) {
            $names = DB::table('catalog_providers')->whereIn('id', array_filter([$providerId, $product->main_provider_id]))->pluck('name', 'id');
            DB::table('catalog_products')->where('id', $product->id)->update(['main_provider_id' => $providerId]);
            $before = $product->main_provider_id ? $names[$product->main_provider_id] : null;
            $after = $providerId ? $names[$providerId] : 'sin proveedor';

            if ($reason !== null && trim($reason) !== '') {
                $this->audit->log('Producto', $product->code, 'cambio_proveedor', $before, mb_substr("{$after} · ".trim($reason), 0, 500));
            } else {
                $this->note($product, "Cambió el proveedor principal a {$after}", $before);
            }
        }
    }

    public function components(object $product, array $components, User $actor): void
    {
        $today = CatalogAccess::today();
        $current = collect($this->currentComponents($product->id))->keyBy('id');
        $services = DB::table('catalog_services as s')->join('catalog_providers as pv', 'pv.id', '=', 's.provider_id')
            ->whereIn('s.id', array_filter([...array_column($components, 'service_id'), ...$current->pluck('service_id')->all()]))
            ->get(['s.id', 's.ref', 's.name', 's.unit', 's.cost', 's.currency', 's.provider_id', 's.status', 's.valid_to', 's.deleted_at', 'pv.status as provider_status', 'pv.contract_end', 'pv.deleted_at as provider_deleted'])->keyBy('id');
        $products = DB::table('catalog_products')->whereIn('id', array_filter([...array_column($components, 'component_product_id'), ...$current->pluck('component_product_id')->all()]))->get(['id', 'code', 'name', 'status', 'deleted_at'])->keyBy('id');
        $label = function (array $component) use ($services, $products): string {
            if ($component['service_id'] ?? null) {
                $service = $services[$component['service_id']];

                return "{$service->ref} {$service->name}";
            }
            $child = $products[$component['component_product_id']];

            return "{$child->code} {$child->name}";
        };
        $seen = [];
        $kept = [];
        $rows = [];

        foreach (array_values($components) as $index => $component) {
            $position = $index + 1;
            $id = $component['id'] ?? null;
            $previous = $id ? ($current[$id] ?? throw ApiException::unprocessable('CAT-BR-10', "El componente {$position} no pertenece a este producto.")) : null;
            $serviceId = $component['service_id'] ?? null;
            $productId = $serviceId ? null : ($component['component_product_id'] ?? null);
            $key = $serviceId ?? "p:{$productId}";

            if (isset($seen[$key])) {
                throw ApiException::unprocessable('CAT-BR-10', "El componente {$position} está repetido.");
            }
            $seen[$key] = true;
            $linked = $current->contains(fn (array $row) => ($serviceId && $row['service_id'] === $serviceId) || ($productId && $row['component_product_id'] === $productId));

            if ($serviceId) {
                $service = $services[$serviceId] ?? throw ApiException::unprocessable('CAT-BR-10', "El servicio del componente {$position} no existe.");
                $usable = $service->status === 'activo' && $service->valid_to >= $today && $service->deleted_at === null
                    && $service->provider_status === 'activo' && $service->contract_end >= $today && $service->provider_deleted === null;

                if (! $usable && ! $linked) {
                    throw ApiException::unprocessable('PRD-BR-007', "{$service->ref} {$service->name}: el servicio o su proveedor no están activos y vigentes.");
                }
                $base = ['service_id' => $serviceId, 'component_product_id' => null, 'provider_id' => $service->provider_id, 'unit' => $service->unit];
            } else {
                $child = $products[$productId] ?? throw ApiException::unprocessable('CAT-BR-10', "El producto del componente {$position} no existe.");

                if ($child->id === $product->id) {
                    throw ApiException::unprocessable('CAT-BR-10', 'Un producto no puede ser componente de sí mismo.');
                }
                if (($child->status !== 'ACTIVE' || $child->deleted_at !== null) && ! $linked) {
                    throw ApiException::unprocessable('CAT-BR-10', "{$child->code}: solo se agregan productos activos.");
                }
                $base = ['service_id' => null, 'component_product_id' => $productId, 'provider_id' => null, 'unit' => 'unidad'];
            }

            $values = [
                ...$base,
                'quantity' => round((float) $component['quantity'], 2),
                'sort_order' => $position,
                'is_required' => (bool) ($component['is_required'] ?? true),
                'is_included' => (bool) ($component['is_included'] ?? true),
                'notes' => trim((string) ($component['notes'] ?? '')) ?: null,
            ];
            $rows[] = ['id' => $id, 'values' => $values, 'previous' => $previous];
            if ($id) {
                $kept[] = $id;
            }
        }

        foreach ($current->except($kept) as $row) {
            DB::table('catalog_product_items')->where('id', $row['id'])->delete();
            $this->note($product, 'Quitó componente '.$label($row));
        }

        foreach ($rows as $row) {
            $values = $row['values'];
            $name = $label($values);

            if (! $row['id']) {
                DB::table('catalog_product_items')->insert([...$values, 'product_id' => $product->id, 'created_by' => $actor->getKey()]);
                $service = $values['service_id'] ? $services[$values['service_id']] : null;
                $price = $service ? ' ('.$this->number($values['quantity'])." × {$service->currency} ".number_format((float) $service->cost, 2, '.', '').')' : '';
                $this->note($product, "Agregó componente {$name}{$price}");

                continue;
            }

            DB::table('catalog_product_items')->where('id', $row['id'])->update([...$values, 'updated_by' => $actor->getKey()]);
            $previous = $row['previous'];
            if ($previous['service_id'] !== $values['service_id'] || $previous['component_product_id'] !== $values['component_product_id']) {
                $this->note($product, "Cambió el componente {$label($previous)} por {$name}");
            }
            if ((float) $previous['quantity'] !== (float) $values['quantity']) {
                $this->note($product, "Cambió la cantidad de {$name} de {$this->number($previous['quantity'])} a {$this->number($values['quantity'])}");
            }
            if ($previous['is_included'] !== $values['is_included']) {
                $this->note($product, ($values['is_included'] ? 'Incluyó en el precio ' : 'Sacó del precio ').$name);
            }
            if ($previous['is_required'] !== $values['is_required']) {
                $this->note($product, "Marcó {$name} como ".($values['is_required'] ? 'requerido' : 'opcional'));
            }
            if ((string) $previous['notes'] !== (string) $values['notes']) {
                $this->note($product, "Cambió la nota de {$name}");
            }
        }

        $firstProvider = array_values(array_filter(array_map(fn (array $row) => $row['values']['provider_id'], $rows)))[0] ?? null;
        if (! $product->main_provider_id && $firstProvider) {
            DB::table('catalog_products')->where('id', $product->id)->update(['main_provider_id' => $firstProvider]);
        }
    }

    public function itinerary(object $product, array $days, User $actor): void
    {
        $itinerary = (string) $this->itineraryId($product->id, $actor);
        $current = collect($this->currentItinerary($product->id))->keyBy('id');
        $currentItems = $current->flatMap(fn (array $day) => array_map(fn (array $item) => [...$item, 'day_id' => $day['id']], $day['items']))->keyBy('id');
        $keptDays = array_values(array_filter(array_column($days, 'id')));
        $keptItems = collect($days)->flatMap(fn (array $day) => array_filter(array_column($day['items'] ?? [], 'id')))->values()->all();

        foreach ($keptDays as $id) {
            if (! $current->has($id)) {
                throw ApiException::unprocessable('CAT-BR-12', 'Uno de los días no pertenece a este producto.');
            }
        }
        foreach ($keptItems as $id) {
            if (! $currentItems->has($id)) {
                throw ApiException::unprocessable('CAT-BR-12', 'Una de las actividades no pertenece a este producto.');
            }
        }

        $position = 0;
        foreach ($current as $id => $day) {
            $position++;
            if (! in_array($id, $keptDays, true)) {
                DB::table('catalog_itinerary_days')->where('id', $id)->delete();
                $this->note($product, "Quitó el día {$position}: {$day['title']}");
            }
        }

        DB::table('catalog_itinerary_items')->whereIn('id', $currentItems->keys()->diff($keptItems)->all())->get(['id'])
            ->each(function (object $row) use ($product, $currentItems): void {
                $item = $currentItems[$row->id];
                DB::table('catalog_itinerary_items')->where('id', $row->id)->delete();
                $this->note($product, 'Quitó la actividad '.$this->activity($item));
            });

        DB::table('catalog_itinerary_days')->where('itinerary_id', $itinerary)->update(['day_number' => DB::raw('day_number + 1000')]);
        $order = array_values(array_intersect($current->keys()->all(), $keptDays));

        foreach (array_values($days) as $index => $day) {
            $number = $index + 1;
            $title = trim($day['title']);
            $dayId = $day['id'] ?? null;

            if ($dayId) {
                DB::table('catalog_itinerary_days')->where('id', $dayId)->update(['day_number' => $number, 'title' => $title, 'updated_by' => $actor->getKey()]);
                if ($current[$dayId]['title'] !== $title) {
                    $this->note($product, "Cambió el título del día {$number} a {$title}", $current[$dayId]['title']);
                }
            } else {
                $dayId = (string) Str::uuid7();
                DB::table('catalog_itinerary_days')->insert(['id' => $dayId, 'itinerary_id' => $itinerary, 'day_number' => $number, 'title' => $title, 'created_by' => $actor->getKey()]);
                $this->note($product, "Agregó el día {$number}: {$title}");
            }

            foreach ($day['items'] ?? [] as $item) {
                $values = [
                    'day_id' => $dayId,
                    'start_time' => $item['time'] ?? null,
                    'activity' => trim($item['activity']),
                    'item_type' => $item['type'] ?? null,
                    'location' => trim((string) ($item['location'] ?? '')) ?: null,
                    'service_id' => $this->ownService($product, $item['service_id'] ?? null),
                    'note' => trim((string) ($item['note'] ?? '')) ?: null,
                    'image_ref' => trim((string) ($item['image_ref'] ?? '')) ?: null,
                    'cost' => (string) Decimal::round2((string) ($item['cost'] ?? '0')),
                    'price' => (string) Decimal::round2((string) ($item['price'] ?? '0')),
                ];
                $itemId = $item['id'] ?? null;
                if (! CatalogAccess::seesMargin($actor) || ! array_key_exists('cost', $item) || $item['cost'] === null || $item['cost'] === '') {
                    $values['cost'] = $itemId ? (string) Decimal::round2((string) ($currentItems[$itemId]['cost'] ?? '0')) : '0.00';
                }
                $text = $this->activity(['time' => $values['start_time'], 'activity' => $values['activity']])." del día {$number}";

                if (! $itemId) {
                    DB::table('catalog_itinerary_items')->insert([...$values, 'created_by' => $actor->getKey()]);
                    $this->note($product, "Agregó la actividad {$text}");

                    continue;
                }

                $previous = $currentItems[$itemId];
                DB::table('catalog_itinerary_items')->where('id', $itemId)->update([...$values, 'updated_by' => $actor->getKey()]);
                $changed = $previous['activity'] !== $values['activity'] || (string) $previous['time'] !== (string) $values['start_time']
                    || (string) $previous['type'] !== (string) $values['item_type'] || (string) $previous['location'] !== (string) $values['location'] || $previous['day_id'] !== $dayId
                    || (string) ($previous['service_id'] ?? '') !== (string) $values['service_id'] || (string) ($previous['note'] ?? '') !== (string) $values['note']
                    || (string) ($previous['image_ref'] ?? '') !== (string) $values['image_ref'] || Decimal::round2((string) ($previous['cost'] ?? '0'))->compareTo($values['cost']) !== 0 || Decimal::round2((string) ($previous['price'] ?? '0'))->compareTo($values['price']) !== 0;
                if ($changed) {
                    $this->note($product, "Cambió la actividad {$text}", $this->activity($previous));
                }
            }
        }

        if ($order !== $keptDays) {
            $this->note($product, 'Reordenó los días del itinerario');
        }
    }

    public function seasons(object $product, array $ids, User $actor): void
    {
        $ids = array_values(array_unique($ids));
        $byRates = $this->seasonsUsedByRates($product->id);
        $current = DB::table('catalog_product_seasons')->where('product_id', $product->id)->pluck('season_id')->all();
        $new = array_values(array_diff($ids, $current));

        if ($new !== [] && DB::table('catalog_seasons')->whereIn('id', $new)->whereNull('deleted_at')->where('status', 'activa')->count() !== count($new)) {
            throw ApiException::unprocessable('CAT-BR-13', 'Solo puedes asociar temporadas activas.');
        }

        $keep = array_values(array_unique([...$ids, ...$byRates]));
        $removed = array_values(array_diff($current, $keep));
        $insert = array_values(array_diff($keep, $current));
        DB::table('catalog_product_seasons')->where('product_id', $product->id)->whereIn('season_id', $removed)->delete();

        if ($insert !== []) {
            DB::table('catalog_product_seasons')->insert(array_map(fn (string $id) => ['product_id' => $product->id, 'season_id' => $id, 'created_by' => $actor->getKey()], $insert));
        }

        $names = DB::table('catalog_seasons')->whereIn('id', [...$insert, ...$removed])->pluck('name', 'id');
        foreach ($insert as $id) {
            $this->note($product, "Asoció la temporada {$names[$id]}");
        }
        foreach ($removed as $id) {
            $this->note($product, "Quitó la temporada {$names[$id]}");
        }
    }

    public function removeSeason(object $product, string $seasonId, User $actor): void
    {
        if (! DB::table('catalog_product_seasons')->where('product_id', $product->id)->where('season_id', $seasonId)->exists()) {
            throw ApiException::notFound('La temporada no está asociada a este producto.');
        }

        if (in_array($seasonId, $this->seasonsUsedByRates($product->id), true)) {
            throw ApiException::unprocessable('CAT-BR-13', 'Una tarifa del producto usa esta temporada. Cambia o desactiva esa tarifa antes de quitarla.');
        }

        $remaining = DB::table('catalog_product_seasons')->where('product_id', $product->id)->where('season_id', '<>', $seasonId)->pluck('season_id')->all();
        $this->seasons($product, $remaining, $actor);
    }

    public function availability(object $product, array $data, User $actor): void
    {
        $values = [
            'availability_model' => $data['model'],
            'availability_capacity' => isset($data['capacity']) ? (int) $data['capacity'] : null,
            'availability_source' => $data['source'],
        ];

        DB::table('catalog_products')->where('id', $product->id)->update($values);
        $describe = fn (string $model, mixed $capacity, string $source) => $model.($capacity ? " · {$capacity} cupos" : '').' · '.($source === 'externa' ? 'proveedor externo' : 'inventario propio');
        $before = $describe($product->availability_model, $product->availability_capacity, $product->availability_source);
        $after = $describe($values['availability_model'], $values['availability_capacity'], $values['availability_source']);

        if ($before !== $after) {
            $this->note($product, "Cambió la disponibilidad a {$after}", $before);
        }
    }

    public function content(object $product, array $data, User $actor): void
    {
        $slug = trim((string) ($data['slug'] ?? '')) ?: ($product->slug ?? Str::slug($product->name.' '.$product->code));

        if (DB::table('catalog_products')->where('slug', $slug)->where('id', '<>', $product->id)->exists()) {
            throw ApiException::unprocessable('CAT-BR-01', 'Ese slug ya lo usa otro producto. Elige otro.');
        }

        $values = [
            'long_description' => trim((string) ($data['long_description'] ?? '')) ?: null,
            'seo_title' => trim((string) ($data['seo_title'] ?? '')) ?: null,
            'seo_description' => trim((string) ($data['seo_description'] ?? '')) ?: null,
            'slug' => $slug,
            'video_url' => trim((string) ($data['video_url'] ?? '')) ?: null,
        ];
        $fieldLabels = ['long_description' => 'la descripción completa', 'seo_title' => 'el título SEO', 'seo_description' => 'la descripción SEO', 'slug' => 'el slug', 'video_url' => 'el video'];
        foreach ($values as $field => $value) {
            if ((string) $value !== (string) $product->{$field}) {
                $this->note($product, "Cambió {$fieldLabels[$field]}".($field === 'slug' ? " a {$value}" : ''), $field === 'slug' ? $product->slug : null);
            }
        }
        if (array_key_exists('features', $data)) {
            $features = array_values(array_filter(array_map(fn ($text) => trim((string) $text), (array) ($data['features'] ?? [])), fn (string $text) => $text !== ''));
            $previous = json_decode((string) ($product->features ?? '[]'), true) ?: [];
            if ($features !== $previous) {
                $this->note($product, 'Cambió las características destacadas: '.(implode(' · ', $features) ?: 'ninguna'), $previous === [] ? null : implode(' · ', $previous));
            }
            $values['features'] = json_encode($features, JSON_UNESCAPED_UNICODE);
        }
        DB::table('catalog_products')->where('id', $product->id)->update($values);

        $texts = DB::table('catalog_product_inclusions')->where('product_id', $product->id)->get(['kind', 'text']);
        foreach (['include' => ['inclusions', 'Incluye'], 'exclude' => ['exclusions', 'No incluye']] as $kind => [$key, $title]) {
            $before = $texts->where('kind', $kind)->pluck('text')->all();
            $after = array_map('trim', $data[$key] ?? []);
            $this->listChanges($product, $before, $after, "a «{$title}»", "de «{$title}»");
        }
        DB::table('catalog_product_inclusions')->where('product_id', $product->id)->delete();
        $lines = [...$this->lines($data['inclusions'] ?? [], 'include'), ...$this->lines($data['exclusions'] ?? [], 'exclude')];
        $this->insert('catalog_product_inclusions', $product->id, $lines, $actor);

        $requirements = array_map(fn (array $item) => ['category' => $item['category'] ?? null, 'text' => trim($item['text'])], $data['requirements'] ?? []);
        $before = DB::table('catalog_product_requirements')->where('product_id', $product->id)->pluck('text')->all();
        $this->listChanges($product, $before, array_column($requirements, 'text'), 'el requisito', 'el requisito', true);
        DB::table('catalog_product_requirements')->where('product_id', $product->id)->delete();
        $this->insert('catalog_product_requirements', $product->id, $requirements, $actor);

        $faqs = array_map(fn (array $faq, int $index) => ['question' => trim($faq['question']), 'answer' => trim($faq['answer']), 'sort_order' => $index + 1], $data['faqs'] ?? [], array_keys($data['faqs'] ?? []));
        $previousFaqs = DB::table('catalog_product_faqs')->where('product_id', $product->id)->pluck('answer', 'question')->all();
        $this->listChanges($product, array_keys($previousFaqs), array_column($faqs, 'question'), 'la pregunta', 'la pregunta', true);
        foreach ($faqs as $faq) {
            if (isset($previousFaqs[$faq['question']]) && $previousFaqs[$faq['question']] !== $faq['answer']) {
                $this->note($product, "Cambió la respuesta de la pregunta «{$faq['question']}»");
            }
        }
        DB::table('catalog_product_faqs')->where('product_id', $product->id)->delete();
        $this->insert('catalog_product_faqs', $product->id, $faqs, $actor);

        $this->media($product, $data['media'] ?? [], $actor);
    }

    public function policies(object $product, array $data, User $actor): void
    {
        $values = [];
        foreach (array_keys(self::POLICY_LABELS) as $field) {
            $values[$field] = trim((string) ($data[$field] ?? '')) ?: null;
        }

        $previous = DB::table('catalog_product_policies')->where('product_id', $product->id)->first();
        $tiers = array_key_exists('penalty_tiers', $data) ? CancellationTiers::normalize($data['penalty_tiers'] ?? []) : CancellationTiers::normalize($previous->penalty_tiers ?? '[]');
        $stored = [...$values, 'penalty_tiers' => json_encode($tiers)];
        $previous
            ? DB::table('catalog_product_policies')->where('product_id', $product->id)->update([...$stored, 'updated_by' => $actor->getKey()])
            : DB::table('catalog_product_policies')->insert([...$stored, 'product_id' => $product->id, 'created_by' => $actor->getKey()]);

        foreach ($values as $field => $value) {
            if ((string) $value !== (string) ($previous->{$field} ?? '')) {
                $this->note($product, 'Cambió la política de '.self::POLICY_LABELS[$field], $previous->{$field} ?? null);
            }
        }

        $before = CancellationTiers::normalize($previous->penalty_tiers ?? '[]');
        if ($tiers !== $before) {
            $this->note($product, 'Tramos de cancelación: '.CancellationTiers::describe($tiers === [] ? CancellationTiers::fromText($values['cancellation']) : $tiers), $before === [] ? null : CancellationTiers::describe($before));
        }
    }

    public function channels(object $product, array $channels, User $actor): void
    {
        $chosen = array_values(array_unique(['erp', ...$channels]));
        $rows = DB::table('catalog_product_channels')->where('product_id', $product->id)->get(['id', 'channel', 'is_published'])->keyBy('channel');

        foreach (ProductSectionRules::CHANNELS as $channel) {
            $on = in_array($channel, $chosen, true);
            $row = $rows[$channel] ?? null;

            if ($row && (bool) $row->is_published === $on) {
                continue;
            }

            if (! $row && ! $on) {
                continue;
            }

            $values = ['is_published' => $on, 'published_at' => $on ? now() : null, 'published_by' => $on ? $actor->getKey() : null, 'updated_by' => $actor->getKey()];
            $row
                ? DB::table('catalog_product_channels')->where('id', $row->id)->update($values)
                : DB::table('catalog_product_channels')->insert([...$values, 'product_id' => $product->id, 'channel' => $channel, 'created_by' => $actor->getKey()]);
            $this->note($product, ($on ? ($product->status === 'ACTIVE' ? 'Publicó el canal ' : 'Solicitó el canal ') : 'Retiró el canal ').self::CHANNEL_LABELS[$channel]);
        }
    }

    public function publishChannel(object $product, string $channel, bool $published, User $actor): void
    {
        if (! in_array($channel, ProductSectionRules::CHANNELS, true)) {
            throw ApiException::notFound('El canal no existe.');
        }

        if ($channel === 'erp' && ! $published) {
            throw ApiException::unprocessable('CAT-BR-04', 'El canal ERP siempre queda publicado.');
        }

        if ($published && $product->status !== 'ACTIVE') {
            throw ApiException::unprocessable('PRD-BR-002', 'Solo un producto activo se publica en canales. Mientras tanto el canal queda solicitado.');
        }

        $row = DB::table('catalog_product_channels')->where('product_id', $product->id)->where('channel', $channel)->first(['id', 'is_published']);
        $values = ['is_published' => $published, 'published_at' => $published ? now() : null, 'published_by' => $published ? $actor->getKey() : null, 'updated_by' => $actor->getKey()];

        if ($row && (bool) $row->is_published === $published) {
            return;
        }

        $row
            ? DB::table('catalog_product_channels')->where('id', $row->id)->update($values)
            : DB::table('catalog_product_channels')->insert([...$values, 'product_id' => $product->id, 'channel' => $channel, 'created_by' => $actor->getKey()]);
        $this->note($product, ($published ? 'Publicó el canal ' : 'Despublicó el canal ').self::CHANNEL_LABELS[$channel]);
        $flag = ['b2b' => 'is_b2b', 'ecommerce' => 'is_ecommerce', 'quotes' => 'is_quoteable'][$channel] ?? null;

        if ($flag !== null) {
            DB::table('catalog_products')->where('id', $product->id)->update([$flag => $published, 'updated_at' => now()]);
        }
    }

    private function media(object $product, array $media, User $actor): void
    {
        $existing = DB::table('catalog_product_media')->where('product_id', $product->id)->get(['id', 'storage_path', 'alt_text', 'is_main'])->keyBy('storage_path');
        $urls = array_map(fn (array $item) => trim($item['url']), $media);
        $removed = $existing->reject(fn (object $row) => in_array($row->storage_path, $urls, true));

        if ($removed->isNotEmpty()) {
            DB::table('catalog_destination_contents')->whereIn('hero_media_id', $removed->pluck('id'))->update(['hero_media_id' => null]);
            DB::table('catalog_product_media')->whereIn('id', $removed->pluck('id'))->delete();
            $removed->each(fn (object $row) => $this->note($product, "Quitó la imagen «{$row->alt_text}»"));
        }

        $previousMain = $existing->firstWhere('is_main', true)?->storage_path;
        DB::table('catalog_product_media')->where('product_id', $product->id)->update(['is_main' => false]);
        $main = array_search(true, array_map(fn (array $item) => (bool) ($item['is_main'] ?? false), $media), true);
        $main = $main === false ? 0 : $main;

        foreach (array_values($media) as $index => $item) {
            $url = trim($item['url']);
            $values = ['alt_text' => trim($item['alt_text']), 'is_main' => $index === $main, 'sort_order' => $index + 1, 'updated_by' => $actor->getKey()];
            $row = $existing[$url] ?? null;

            if ($row) {
                DB::table('catalog_product_media')->where('id', $row->id)->update($values);
                if ($row->alt_text !== $values['alt_text']) {
                    $this->note($product, "Cambió la descripción de la imagen a «{$values['alt_text']}»", $row->alt_text);
                }
            } else {
                DB::table('catalog_product_media')->insert([...$values, 'product_id' => $product->id, 'kind' => 'image', 'storage_path' => $url, 'created_by' => $actor->getKey()]);
                $this->note($product, "Agregó la imagen «{$values['alt_text']}»");
            }

            if ($index === $main && $previousMain !== null && $previousMain !== $url) {
                $this->note($product, "Cambió la portada a «{$values['alt_text']}»");
            }
        }
    }

    private function listChanges(object $product, array $before, array $after, string $addedLabel, string $removedLabel, bool $plain = false): void
    {
        $lower = fn (array $items) => array_map(fn (string $text) => mb_strtolower(trim($text)), $items);
        foreach ($after as $text) {
            if (! in_array(mb_strtolower(trim($text)), $lower($before), true)) {
                $this->note($product, $plain ? "Agregó {$addedLabel} «{$text}»" : "Agregó «{$text}» {$addedLabel}");
            }
        }
        foreach ($before as $text) {
            if (! in_array(mb_strtolower(trim($text)), $lower($after), true)) {
                $this->note($product, $plain ? "Quitó {$removedLabel} «{$text}»" : "Quitó «{$text}» {$removedLabel}");
            }
        }
    }

    private function seasonsUsedByRates(string $productId): array
    {
        return DB::table('catalog_rates')->where('product_id', $productId)->whereNotNull('season_id')->distinct()->pluck('season_id')->all();
    }

    private function activity(array $item): string
    {
        return trim(($item['time'] ? substr((string) $item['time'], 0, 5).' ' : '').$item['activity']);
    }

    private function number(float|int|string $value): string
    {
        $value = (float) $value;

        return $value == floor($value) ? (string) (int) $value : rtrim(rtrim(number_format($value, 2, '.', ''), '0'), '.');
    }

    private function ownService(object $product, mixed $serviceId): ?string
    {
        if ($serviceId === null || $serviceId === '') {
            return null;
        }

        if (! DB::table('catalog_services')->where('id', $serviceId)->whereNull('deleted_at')->exists()) {
            throw ApiException::unprocessable('CAT-BR-12', "El servicio vinculado a una actividad de {$product->name} no existe.");
        }

        return (string) $serviceId;
    }

    private function note(object $product, string $after, ?string $before = null): void
    {
        $this->audit->log('Producto', $product->code, 'modificar', $before === null ? null : mb_substr($before, 0, 500), mb_substr($after, 0, 500));
    }

    private function lines(array $texts, string $kind): array
    {
        return array_map(fn (string $text, int $index) => ['kind' => $kind, 'text' => trim($text), 'sort_order' => $index + 1], $texts, array_keys($texts));
    }

    private function insert(string $table, string $productId, array $rows, User $actor): void
    {
        if ($rows !== []) {
            DB::table($table)->insert(array_map(fn (array $row) => [...$row, 'product_id' => $productId, 'created_by' => $actor->getKey()], $rows));
        }
    }

    private function providerActive(string $providerId): bool
    {
        return DB::table('catalog_providers')->where('id', $providerId)->where('status', 'activo')->where('contract_end', '>=', CatalogAccess::today())->whereNull('deleted_at')->exists();
    }
}
