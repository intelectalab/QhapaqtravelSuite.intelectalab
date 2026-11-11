<?php

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;

function taxonomyAudit(array $where): bool
{
    return withinTenant(tenantA(), fn () => DB::table('audit_events')->where($where)->exists());
}

function taxonomyType(string $name): ?object
{
    return withinTenant(tenantA(), fn () => DB::table('catalog_product_types')->whereRaw('lower(name) = lower(?)', [$name])->first());
}

function taxonomyCategory(string $ref): ?object
{
    return rowOf('catalog_product_categories', $ref, column: 'ref');
}

function taxonomyUsedTypeId(): string
{
    return withinTenant(tenantA(), fn () => (string) DB::table('catalog_products')->whereNull('deleted_at')->whereNotNull('product_type_id')->value('product_type_id'));
}

function taxonomyUsedCategory(): object
{
    return withinTenant(tenantA(), fn () => DB::table('catalog_products as p')->join('catalog_product_categories as c', 'c.id', '=', 'p.category_id')
        ->whereNull('p.deleted_at')->whereNotNull('p.subcategory_id')->first(['c.ref', 'p.subcategory_id']));
}

beforeEach(function () {
    lockCatalogProducts();
    Queue::fake();
});

it('lista tipos y categorías con los productos que los usan', function () {
    actingAsSeed('U03');

    $types = $this->getJson('/api/v1/catalog/product-types')->assertOk();
    $categories = $this->getJson('/api/v1/catalog/categories')->assertOk();

    expect(collect($types->json('data'))->pluck('name'))->toContain('TOUR')
        ->and($types->json('meta.can.manage'))->toBeFalse()
        ->and(collect($types->json('data'))->sum(fn (array $type) => count($type['products'])))->toBeGreaterThan(0)
        ->and(collect($categories->json('data'))->pluck('ref'))->toContain('CAT-1')
        ->and($categories->json('data.0.subcategories'))->not->toBeEmpty();
});

it('crea, edita y elimina un tipo de producto con auditoría', function () {
    actingAsSeed('U01');

    $id = (string) $this->postJson('/api/v1/catalog/product-types', ['name' => 'crucero fluvial', 'requires_itinerary' => true])->assertCreated()->json('data.id');
    $type = taxonomyType('CRUCERO FLUVIAL');

    expect($type->name)->toBe('CRUCERO FLUVIAL')
        ->and($type->requires_itinerary)->toBeTrue()
        ->and(taxonomyAudit(['entity' => 'Tipo de producto', 'entity_id' => 'CRUCERO FLUVIAL', 'action' => 'crear']))->toBeTrue();

    $this->patchJson("/api/v1/catalog/product-types/{$id}", ['name' => 'Crucero de río', 'requires_itinerary' => false, 'version' => (string) $type->updated_at])->assertOk();
    expect(taxonomyType('CRUCERO DE RÍO')->requires_itinerary)->toBeFalse()
        ->and(taxonomyAudit(['entity' => 'Tipo de producto', 'action' => 'modificar']))->toBeTrue();

    $this->deleteJson("/api/v1/catalog/product-types/{$id}")->assertNoContent();
    expect(taxonomyType('CRUCERO DE RÍO')->deleted_at)->not->toBeNull()
        ->and(collect($this->getJson('/api/v1/catalog/product-types')->json('data'))->pluck('id'))->not->toContain($id);

    $again = (string) $this->postJson('/api/v1/catalog/product-types', ['name' => 'Crucero de río'])->assertCreated()->json('data.id');
    expect($again)->toBe($id)->and(taxonomyType('CRUCERO DE RÍO')->deleted_at)->toBeNull();
});

it('rechaza tipos duplicados, versiones viejas y borrar un tipo en uso', function () {
    actingAsSeed('U01');

    expect($this->postJson('/api/v1/catalog/product-types', ['name' => 'tour']))->toBeApiError(422, 'CAT-BR-37');
    $this->postJson('/api/v1/catalog/product-types', ['name' => 'x'])->assertStatus(422)->assertJsonValidationErrors(['name']);
    $used = taxonomyUsedTypeId();
    expect($this->deleteJson("/api/v1/catalog/product-types/{$used}"))->toBeApiError(409, 'CAT-BR-37');
    expect($this->patchJson("/api/v1/catalog/product-types/{$used}", ['name' => 'OTRO NOMBRE', 'version' => '2000-01-01 00:00:00+00']))->toBeApiError(409, 'STALE_VERSION');
    $this->patchJson('/api/v1/catalog/product-types/no-existe', ['name' => 'OTRO'])->assertNotFound();
});

it('crea una categoría con subcategorías, la renombra y gestiona sus subcategorías', function () {
    actingAsSeed('U01');

    $ref = (string) $this->postJson('/api/v1/catalog/categories', ['name' => 'Bienestar', 'subcategories' => ['Spa andino', 'Yoga', 'yoga']])->assertCreated()->json('data.ref');
    $category = taxonomyCategory($ref);
    $subs = withinTenant(tenantA(), fn () => DB::table('catalog_product_subcategories')->where('category_id', $category->id)->whereNull('deleted_at')->pluck('name', 'id'));

    expect($ref)->toStartWith('CAT-')->and($subs->values()->sort()->values()->all())->toBe(['Spa andino', 'Yoga'])
        ->and(taxonomyAudit(['entity' => 'Categoría de producto', 'entity_id' => $ref, 'action' => 'crear']))->toBeTrue();

    $this->patchJson("/api/v1/catalog/categories/{$ref}", ['name' => 'Bienestar y salud', 'version' => (string) $category->updated_at])->assertOk();
    expect(taxonomyCategory($ref)->name)->toBe('Bienestar y salud');

    $subId = (string) $this->postJson("/api/v1/catalog/categories/{$ref}/subcategories", ['name' => 'Meditación'])->assertCreated()->json('data.id');
    $this->patchJson("/api/v1/catalog/categories/{$ref}/subcategories/{$subId}", ['name' => 'Meditación guiada'])->assertOk();
    expect($this->postJson("/api/v1/catalog/categories/{$ref}/subcategories", ['name' => 'spa andino']))->toBeApiError(422, 'CAT-BR-37');
    $this->deleteJson("/api/v1/catalog/categories/{$ref}/subcategories/{$subId}")->assertNoContent();
    expect(taxonomyAudit(['entity' => 'Categoría de producto', 'entity_id' => $ref, 'action' => 'quitar_subcategoria', 'before_value' => 'Meditación guiada']))->toBeTrue();

    $this->deleteJson("/api/v1/catalog/categories/{$ref}")->assertNoContent();
    expect(taxonomyCategory($ref)->deleted_at)->not->toBeNull()
        ->and(withinTenant(tenantA(), fn () => DB::table('catalog_product_subcategories')->where('category_id', $category->id)->whereNull('deleted_at')->count()))->toBe(0);
});

it('no elimina categorías ni subcategorías en uso', function () {
    actingAsSeed('U01');
    $used = taxonomyUsedCategory();

    expect($this->deleteJson("/api/v1/catalog/categories/{$used->ref}"))->toBeApiError(409, 'CAT-BR-37');
    expect($this->deleteJson("/api/v1/catalog/categories/{$used->ref}/subcategories/{$used->subcategory_id}"))->toBeApiError(409, 'CAT-BR-37');
    expect($this->deleteJson('/api/v1/catalog/categories/CAT-1/subcategories/01a1b4f8-0000-7000-8000-000000000000'))->toBeApiError(404);
});

it('ventas y finanzas no editan tipos ni categorías', function (string $user) {
    actingAsSeed($user);
    $type = taxonomyType('TOUR');

    expect($this->postJson('/api/v1/catalog/product-types', ['name' => 'NUEVO']))->toBeApiError(403);
    expect($this->patchJson("/api/v1/catalog/product-types/{$type->id}", ['name' => 'TOUR 2']))->toBeApiError(403);
    expect($this->deleteJson("/api/v1/catalog/product-types/{$type->id}"))->toBeApiError(403);
    expect($this->postJson('/api/v1/catalog/categories', ['name' => 'Nueva']))->toBeApiError(403);
    expect($this->patchJson('/api/v1/catalog/categories/CAT-1', ['name' => 'Otra']))->toBeApiError(403);
    expect($this->deleteJson('/api/v1/catalog/categories/CAT-1'))->toBeApiError(403);
    expect($this->postJson('/api/v1/catalog/categories/CAT-1/subcategories', ['name' => 'Otra']))->toBeApiError(403);
    expect(taxonomyType('TOUR')->name)->toBe('TOUR');
})->with(['U03', 'U07']);
