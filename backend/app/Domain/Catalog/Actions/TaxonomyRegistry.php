<?php

declare(strict_types=1);

namespace App\Domain\Catalog\Actions;

use App\Domain\Crm\Support\CodeSequence;
use App\Domain\Iam\Models\User;
use App\Domain\Shared\Audit\AuditLogger;
use App\Domain\Shared\Errors\ApiException;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\DB;

final class TaxonomyRegistry
{
    private const TYPES = 'catalog_product_types';

    private const CATEGORIES = 'catalog_product_categories';

    private const SUBCATEGORIES = 'catalog_product_subcategories';

    public function __construct(private readonly AuditLogger $audit, private readonly CodeSequence $codes) {}

    public function createType(array $data, User $actor): string
    {
        return DB::transaction(function () use ($data, $actor): string {
            $name = $this->typeName($data['name']);
            $values = [...$this->typeValues($data), 'name' => $name, 'updated_by' => $actor->getKey()];
            $id = $this->revive(self::TYPES, DB::table(self::TYPES), $name, null, $values, 'Ya existe un tipo con ese nombre.')
                ?? (string) DB::table(self::TYPES)->insertGetId([...$values, 'sort_order' => (int) DB::table(self::TYPES)->whereNull('deleted_at')->max('sort_order') + 1, 'created_by' => $actor->getKey()]);
            $this->audit->log('Tipo de producto', $name, 'crear', after: $this->typeSummary($values));

            return $id;
        });
    }

    public function updateType(string $id, array $data, User $actor): string
    {
        return DB::transaction(function () use ($id, $data, $actor): string {
            $type = $this->row(self::TYPES, $id, 'El tipo de producto no existe.');
            $this->assertVersion($type, $data['version'] ?? null);
            $name = $this->typeName($data['name']);
            $this->assertFree(DB::table(self::TYPES), $name, $type->id, 'Ya existe un tipo con ese nombre.');
            $values = [...$this->typeValues($data), 'name' => $name];
            DB::table(self::TYPES)->where('id', $type->id)->update([...$values, 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
            $this->audit->log('Tipo de producto', $name, 'modificar', $this->typeSummary((array) $type), $this->typeSummary($values));

            return $type->id;
        });
    }

    public function deleteType(string $id, User $actor): void
    {
        DB::transaction(function () use ($id, $actor): void {
            $type = $this->row(self::TYPES, $id, 'El tipo de producto no existe.');
            $this->assertUnused('product_type_id', $type->id, "el tipo {$type->name}");
            DB::table(self::TYPES)->where('id', $type->id)->update(['deleted_at' => now(), 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
            $this->audit->log('Tipo de producto', $type->name, 'eliminar', $type->name);
        });
    }

    public function createCategory(array $data, User $actor): string
    {
        return DB::transaction(function () use ($data, $actor): string {
            $name = $this->label($data['name']);
            $values = ['name' => $name, 'updated_by' => $actor->getKey()];
            $id = $this->revive(self::CATEGORIES, DB::table(self::CATEGORIES), $name, null, $values, 'Ya existe una categoría con ese nombre.');
            $ref = $id ? (string) DB::table(self::CATEGORIES)->where('id', $id)->value('ref') : $this->codes->next(self::CATEGORIES, 'CAT-', 1, 'ref');
            $id ??= (string) DB::table(self::CATEGORIES)->insertGetId([...$values, 'ref' => $ref, 'created_by' => $actor->getKey()]);
            $subcategories = collect($data['subcategories'] ?? [])->map(fn (string $sub): string => $this->label($sub))->filter()->unique(fn (string $sub): string => mb_strtolower($sub));

            foreach ($subcategories as $sub) {
                $this->insertSubcategory($id, $sub, $actor);
            }

            $this->audit->log('Categoría de producto', $ref, 'crear', after: $subcategories->isEmpty() ? $name : "{$name} · ".$subcategories->implode(', '));

            return $ref;
        });
    }

    public function updateCategory(string $ref, array $data, User $actor): string
    {
        return DB::transaction(function () use ($ref, $data, $actor): string {
            $category = $this->category($ref);
            $this->assertVersion($category, $data['version'] ?? null);
            $name = $this->label($data['name']);
            $this->assertFree(DB::table(self::CATEGORIES), $name, $category->id, 'Ya existe una categoría con ese nombre.');
            DB::table(self::CATEGORIES)->where('id', $category->id)->update(['name' => $name, 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
            $this->audit->log('Categoría de producto', $ref, 'modificar', $category->name, $name);

            return $ref;
        });
    }

    public function deleteCategory(string $ref, User $actor): void
    {
        DB::transaction(function () use ($ref, $actor): void {
            $category = $this->category($ref);
            $this->assertUnused('category_id', $category->id, "la categoría {$category->name}");
            $subcategories = DB::table(self::SUBCATEGORIES)->where('category_id', $category->id)->whereNull('deleted_at')->pluck('name');
            DB::table(self::SUBCATEGORIES)->where('category_id', $category->id)->whereNull('deleted_at')->update(['deleted_at' => now(), 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
            DB::table(self::CATEGORIES)->where('id', $category->id)->update(['deleted_at' => now(), 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
            $this->audit->log('Categoría de producto', $ref, 'eliminar', $subcategories->isEmpty() ? $category->name : "{$category->name} · ".$subcategories->implode(', '));
        });
    }

    public function createSubcategory(string $ref, string $name, User $actor): string
    {
        return DB::transaction(function () use ($ref, $name, $actor): string {
            $category = $this->category($ref);
            $label = $this->label($name);
            $id = $this->insertSubcategory($category->id, $label, $actor);
            $this->audit->log('Categoría de producto', $ref, 'agregar_subcategoria', after: $label);

            return $id;
        });
    }

    public function updateSubcategory(string $ref, string $id, array $data, User $actor): string
    {
        return DB::transaction(function () use ($ref, $id, $data, $actor): string {
            $category = $this->category($ref);
            $sub = $this->subcategory($category->id, $id);
            $this->assertVersion($sub, $data['version'] ?? null);
            $label = $this->label($data['name']);
            $this->assertFree(DB::table(self::SUBCATEGORIES)->where('category_id', $category->id), $label, $sub->id, "Ya existe esa subcategoría en {$category->name}.");
            DB::table(self::SUBCATEGORIES)->where('id', $sub->id)->update(['name' => $label, 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
            $this->audit->log('Categoría de producto', $ref, 'modificar_subcategoria', $sub->name, $label);

            return $sub->id;
        });
    }

    public function deleteSubcategory(string $ref, string $id, User $actor): void
    {
        DB::transaction(function () use ($ref, $id, $actor): void {
            $category = $this->category($ref);
            $sub = $this->subcategory($category->id, $id);
            $this->assertUnused('subcategory_id', $sub->id, "la subcategoría {$sub->name}");
            DB::table(self::SUBCATEGORIES)->where('id', $sub->id)->update(['deleted_at' => now(), 'updated_by' => $actor->getKey(), 'updated_at' => now()]);
            $this->audit->log('Categoría de producto', $ref, 'quitar_subcategoria', $sub->name);
        });
    }

    private function insertSubcategory(string $categoryId, string $name, User $actor): string
    {
        $values = ['name' => $name, 'updated_by' => $actor->getKey()];
        $query = DB::table(self::SUBCATEGORIES)->where('category_id', $categoryId);

        return $this->revive(self::SUBCATEGORIES, $query, $name, null, $values, 'Ya existe esa subcategoría en la categoría.')
            ?? (string) DB::table(self::SUBCATEGORIES)->insertGetId([...$values, 'category_id' => $categoryId, 'created_by' => $actor->getKey()]);
    }

    private function revive(string $table, Builder $scope, string $name, ?string $exceptId, array $values, string $taken): ?string
    {
        $existing = (clone $scope)->whereRaw('lower(name) = lower(?)', [$name])->when($exceptId, fn ($query) => $query->where('id', '<>', $exceptId))->lockForUpdate()->first(['id', 'deleted_at']);

        if ($existing === null) {
            return null;
        }

        if ($existing->deleted_at === null) {
            throw ApiException::unprocessable('CAT-BR-37', $taken);
        }

        DB::table($table)->where('id', $existing->id)->update([...$values, 'deleted_at' => null, 'updated_at' => now()]);

        return (string) $existing->id;
    }

    private function assertFree(Builder $scope, string $name, string $exceptId, string $taken): void
    {
        $existing = $scope->whereRaw('lower(name) = lower(?)', [$name])->where('id', '<>', $exceptId)->first(['deleted_at']);

        if ($existing) {
            throw ApiException::unprocessable('CAT-BR-37', $existing->deleted_at ? 'Ese nombre lo usó un registro eliminado. Créalo de nuevo para recuperarlo o elige otro.' : $taken);
        }
    }

    private function assertUnused(string $column, string $id, string $label): void
    {
        $products = DB::table('catalog_products')->where($column, $id)->whereNull('deleted_at')->count();

        if ($products > 0) {
            throw ApiException::conflict('CAT-BR-37', $products === 1 ? "Un producto usa {$label}. Cambia su clasificación antes de eliminar." : "{$products} productos usan {$label}. Cambia su clasificación antes de eliminar.");
        }
    }

    private function assertVersion(object $row, ?string $version): void
    {
        if ($version !== null && $version !== '' && $version !== (string) $row->updated_at) {
            throw ApiException::conflict('STALE_VERSION', 'Alguien cambió este registro mientras lo veías. Recarga la página e inténtalo de nuevo.');
        }
    }

    private function row(string $table, string $id, string $missing): object
    {
        if (! preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i', $id)) {
            throw ApiException::notFound($missing);
        }

        return DB::table($table)->where('id', $id)->whereNull('deleted_at')->lockForUpdate()->first() ?? throw ApiException::notFound($missing);
    }

    private function category(string $ref): object
    {
        return DB::table(self::CATEGORIES)->where('ref', $ref)->whereNull('deleted_at')->lockForUpdate()->first() ?? throw ApiException::notFound('La categoría no existe.');
    }

    private function subcategory(string $categoryId, string $id): object
    {
        $sub = $this->row(self::SUBCATEGORIES, $id, 'La subcategoría no existe.');

        return $sub->category_id === $categoryId ? $sub : throw ApiException::notFound('La subcategoría no existe.');
    }

    private function typeName(string $name): string
    {
        return mb_strtoupper($this->label($name));
    }

    private function label(string $name): string
    {
        return trim((string) preg_replace('/\s+/', ' ', $name));
    }

    private function typeValues(array $data): array
    {
        return ['requires_itinerary' => (bool) ($data['requires_itinerary'] ?? false), 'requires_components' => (bool) ($data['requires_components'] ?? true)];
    }

    private function typeSummary(array $values): string
    {
        return trim(($values['name'] ?? '').' · '.(($values['requires_itinerary'] ?? false) ? 'requiere itinerario' : 'itinerario opcional').' · '.(($values['requires_components'] ?? true) ? 'requiere componentes' : 'componentes opcionales'));
    }
}
