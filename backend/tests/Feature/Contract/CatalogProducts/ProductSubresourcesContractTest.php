<?php

use Illuminate\Support\Facades\DB;

function contractProduct(): object
{
    return withinTenant(tenantA(), fn () => DB::table('catalog_products as p')->whereNull('p.deleted_at')->where('p.status', '<>', 'ARCHIVED')
        ->whereRaw('(select count(*) from catalog_product_items i where i.product_id = p.id) >= 2')->orderBy('p.code')->first(['p.id', 'p.code', 'p.lock_version']));
}

function contractAudit(array $where): bool
{
    return withinTenant(tenantA(), fn () => DB::table('audit_events')->where($where)->exists());
}

function contractOtherProduct(string $exceptId): object
{
    return withinTenant(tenantA(), fn () => DB::table('catalog_products as p')->whereNull('p.deleted_at')->where('p.status', '<>', 'ARCHIVED')->where('p.id', '<>', $exceptId)
        ->whereNotExists(fn ($query) => $query->from('catalog_product_related as r')->where('r.product_id', $exceptId)->whereColumn('r.related_product_id', 'p.id'))
        ->orderBy('p.code')->first(['p.id', 'p.code']));
}

it('lee los sub-recursos del producto por código o por id', function (string $path) {
    actingAsSeed('U01');
    $product = contractProduct();

    $this->getJson("/api/v1/catalog/products/{$product->code}/{$path}")->assertOk()->assertJsonStructure(['data']);
    $this->getJson("/api/v1/catalog/products/{$product->id}/{$path}")->assertOk()->assertJsonStructure(['data']);
})->with(['content', 'components', 'itineraries', 'policies', 'inclusions', 'related', 'config-groups', 'channels', 'usage', 'audit']);

it('responde 404 si el producto no existe', function () {
    actingAsSeed('U01');

    $this->getJson('/api/v1/catalog/products/NO-EXISTE-99/content')->assertNotFound();
    $this->postJson('/api/v1/catalog/products/NO-EXISTE-99/faqs', ['question' => '¿Existe este producto?', 'answer' => 'No'])->assertNotFound();
});

it('el contenido trae ids estables de inclusiones, requisitos, preguntas e imágenes', function () {
    actingAsSeed('U01');
    $product = contractProduct();

    $data = $this->getJson("/api/v1/catalog/products/{$product->code}/content")->assertOk()->json('data');

    expect($data)->toHaveKeys(['slug', 'seo_title', 'video_url', 'features', 'inclusions', 'exclusions', 'requirements', 'faqs', 'media', 'lock_version'])
        ->and($data['code'])->toBe($product->code);
});

it('los 9 canales vienen con estado y ERP siempre publicado', function () {
    actingAsSeed('U03');
    $product = contractProduct();

    $channels = collect($this->getJson("/api/v1/catalog/products/{$product->code}/channels")->assertOk()->json('data'));

    expect($channels)->toHaveCount(9)
        ->and($channels->firstWhere('channel', 'erp')['state'])->toBe('publicado');
});

it('el itinerario oculta costo y precio a quien no ve costos', function () {
    actingAsSeed('U03');
    $product = withinTenant(tenantA(), fn () => DB::table('catalog_itineraries as it')->join('catalog_products as p', 'p.id', '=', 'it.product_id')->whereNull('p.deleted_at')->where('it.is_default', true)->value('p.code'));

    $json = json_encode($this->getJson("/api/v1/catalog/products/{$product}/itineraries")->assertOk()->json('data'));

    expect($json)->not->toMatch('/"cost":"\d/')->and($json)->not->toMatch('/"price":"\d/');
});

it('GET /catalog/products/kpis cuenta productos y muestra el margen solo con rentabilidad', function () {
    actingAsSeed('U07');
    $kpis = $this->getJson('/api/v1/catalog/products/kpis')->assertOk()->json('data');
    $total = withinTenant(tenantA(), fn () => DB::table('catalog_products')->whereNull('deleted_at')->count());

    expect($kpis['total'])->toBe($total)->and($kpis)->toHaveKeys(['active', 'in_progress', 'paused', 'sellable', 'with_future_departures', 'avg_margin_pct']);

    actingAsSeed('U03');
    expect($this->getJson('/api/v1/catalog/products/kpis')->assertOk()->json('data.avg_margin_pct'))->toBeNull();
});

it('GET /catalog/products/export devuelve el CSV y audita exportar', function () {
    $user = actingAsSeed('U01');
    $product = contractProduct();

    $data = $this->getJson('/api/v1/catalog/products/export?filter[q]='.$product->code)->assertOk()->json('data');

    expect($data['format'])->toBe('CSV')->and($data['rows'])->toBeGreaterThanOrEqual(1)->and($data['content'])->toContain($product->code)
        ->and(contractAudit(['entity' => 'Exportación', 'action' => 'exportar', 'actor_id' => $user->getKey()]))->toBeTrue();
});

it('el historial exige editar, rentabilidad o auditoría y filtra por entidad', function () {
    $product = contractProduct();

    actingAsSeed('U03');
    $response = $this->getJson("/api/v1/catalog/products/{$product->code}/audit");
    expect($response)->toBeApiError(403);
    expect($response->json('required_permissions'))->toContain('catalog.products.update');

    actingAsSeed('U07');
    $rows = $this->getJson("/api/v1/catalog/products/{$product->code}/audit?filter[entity]=producto&page[size]=5")->assertOk()->assertJsonStructure(['data', 'meta' => ['next_cursor'], 'links'])->json('data');
    expect(collect($rows)->pluck('entity')->unique()->all())->toBeIn([[], ['Producto']]);
});

it('Ventas no edita sub-recursos y recibe los permisos requeridos', function () {
    actingAsSeed('U03');
    $product = contractProduct();

    $response = $this->postJson("/api/v1/catalog/products/{$product->code}/faqs", ['question' => '¿Puedo editar esto?', 'answer' => 'No']);
    expect($response)->toBeApiError(403);
    expect($response->json('required_permissions'))->toContain('catalog.products.update');
});

it('agrega y quita requisitos, inclusiones y preguntas con auditoría', function () {
    lockCatalogProducts();
    actingAsSeed('U01');
    $product = contractProduct();

    $requirement = $this->postJson("/api/v1/catalog/products/{$product->code}/requirements", ['category' => 'Documentos', 'text' => 'Pasaporte vigente de prueba'])->assertCreated()->json('data.id');
    $inclusion = $this->postJson("/api/v1/catalog/products/{$product->code}/inclusions", ['kind' => 'exclude', 'text' => 'Propinas de prueba'])->assertCreated()->json('data.id');
    $this->postJson("/api/v1/catalog/products/{$product->code}/inclusions", ['kind' => 'exclude', 'text' => 'propinas de PRUEBA'])->assertUnprocessable()->assertJsonPath('code', 'CAT-BR-33');
    $faq = $this->postJson("/api/v1/catalog/products/{$product->code}/faqs", ['question' => '¿Hay pregunta de prueba?', 'answer' => 'Sí'])->assertCreated()->json('data.id');

    $content = $this->getJson("/api/v1/catalog/products/{$product->code}/content")->json('data');
    expect(collect($content['requirements'])->pluck('id'))->toContain($requirement)
        ->and(collect($content['exclusions'])->pluck('id'))->toContain($inclusion)
        ->and(collect($content['faqs'])->pluck('id'))->toContain($faq)
        ->and(contractAudit(['entity' => 'Producto', 'entity_id' => $product->code, 'after_value' => 'Agregó el requisito «Pasaporte vigente de prueba»']))->toBeTrue();

    $this->deleteJson("/api/v1/catalog/products/{$product->code}/requirements/{$requirement}")->assertNoContent();
    $this->deleteJson("/api/v1/catalog/products/{$product->code}/inclusions/{$inclusion}")->assertNoContent();
    $this->deleteJson("/api/v1/catalog/products/{$product->code}/faqs/{$faq}")->assertNoContent();
    $this->deleteJson("/api/v1/catalog/products/{$product->code}/faqs/{$faq}")->assertNotFound();

    expect(rowOf('catalog_product_requirements', $requirement, column: 'id'))->toBeNull()
        ->and(rowOf('catalog_product_inclusions', $inclusion, column: 'id'))->toBeNull()
        ->and(contractAudit(['entity' => 'Producto', 'entity_id' => $product->code, 'after_value' => 'Quitó la pregunta «¿Hay pregunta de prueba?»']))->toBeTrue();
});

it('gestiona la galería con una sola portada que no se quita', function () {
    lockCatalogProducts();
    actingAsSeed('U01');
    $product = contractProduct();

    $first = $this->postJson("/api/v1/catalog/products/{$product->code}/media", ['url' => 'https://cdn.example.com/prueba-1.jpg', 'alt_text' => 'Imagen de prueba uno', 'is_main' => true])->assertCreated()->json('data');
    $second = $this->postJson("/api/v1/catalog/products/{$product->code}/media", ['url' => 'https://cdn.example.com/prueba-2.jpg', 'alt_text' => 'Imagen de prueba dos'])->assertCreated()->json('data');
    expect($first['is_main'])->toBeTrue()->and($second['is_main'])->toBeFalse();

    $this->deleteJson("/api/v1/catalog/products/{$product->code}/media/{$first['id']}")->assertUnprocessable()->assertJsonPath('code', 'CAT-BR-29');
    $this->patchJson("/api/v1/catalog/products/{$product->code}/media/{$second['id']}", ['is_main' => true, 'alt_text' => 'Nueva portada de prueba'])->assertOk()->assertJsonPath('data.is_main', true)->assertJsonPath('data.alt_text', 'Nueva portada de prueba');
    $this->patchJson("/api/v1/catalog/products/{$product->code}/media/{$second['id']}", ['is_main' => false])->assertUnprocessable();

    expect(withinTenant(tenantA(), fn () => DB::table('catalog_product_media')->where('product_id', $product->id)->where('is_main', true)->count()))->toBe(1);

    $this->deleteJson("/api/v1/catalog/products/{$product->code}/media/{$first['id']}")->assertNoContent();
    expect(contractAudit(['entity' => 'Producto', 'entity_id' => $product->code, 'after_value' => 'Cambió la portada a «Nueva portada de prueba»']))->toBeTrue();
});

it('relaciona y desrelaciona productos; el otro lo ve en referenced_by', function () {
    lockCatalogProducts();
    actingAsSeed('U01');
    $product = contractProduct();
    $other = contractOtherProduct($product->id);

    $id = $this->postJson("/api/v1/catalog/products/{$product->code}/related", ['related_product_id' => $other->code, 'relation' => 'Upsell'])->assertCreated()->json('data.id');
    $this->postJson("/api/v1/catalog/products/{$product->code}/related", ['related_product_id' => $other->id, 'relation' => 'Upsell'])->assertConflict();
    $this->postJson("/api/v1/catalog/products/{$product->code}/related", ['related_product_id' => $product->code, 'relation' => 'Upsell'])->assertUnprocessable();

    expect(collect($this->getJson("/api/v1/catalog/products/{$other->code}/related")->json('meta.referenced_by'))->pluck('product.code'))->toContain($product->code)
        ->and(contractAudit(['entity' => 'Producto', 'entity_id' => $product->code, 'action' => 'relacionar']))->toBeTrue();

    $this->deleteJson("/api/v1/catalog/products/{$product->code}/related/{$id}")->assertNoContent();
    expect(contractAudit(['entity' => 'Producto', 'entity_id' => $product->code, 'action' => 'desrelacionar']))->toBeTrue();
});

it('crea y quita grupos de personalización con al menos dos opciones', function () {
    lockCatalogProducts();
    actingAsSeed('U01');
    $product = contractProduct();

    $this->postJson("/api/v1/catalog/products/{$product->code}/config-groups", ['name' => 'Grupo de prueba', 'options' => [['label' => 'Única']]])->assertUnprocessable();
    $group = $this->postJson("/api/v1/catalog/products/{$product->code}/config-groups", ['name' => 'Grupo de prueba', 'options' => [['label' => 'Estándar', 'price_delta' => 0], ['label' => 'Superior', 'price_delta' => 45.5]]])
        ->assertCreated()->assertJsonPath('data.options.1.price_delta', '45.50')->json('data.id');
    $this->postJson("/api/v1/catalog/products/{$product->code}/config-groups", ['name' => 'grupo de PRUEBA', 'options' => [['label' => 'A'], ['label' => 'B']]])->assertUnprocessable()->assertJsonPath('code', 'CAT-BR-30');

    $this->deleteJson("/api/v1/catalog/products/{$product->code}/config-groups/{$group}")->assertNoContent();
    expect(rowOf('catalog_product_config_groups', $group, column: 'id'))->toBeNull()
        ->and(contractAudit(['entity' => 'Producto', 'entity_id' => $product->code, 'action' => 'cambio_personalizacion']))->toBeTrue();
});

it('PUT markup exige tarifas, respeta lock_version y audita cambio_markup', function () {
    lockCatalogProducts();
    $product = contractProduct();

    actingAsSeed('U05');
    expect($this->putJson("/api/v1/catalog/products/{$product->code}/markup", ['markup_pct' => 30]))->toBeApiError(403);

    actingAsSeed('U01');
    $this->putJson("/api/v1/catalog/products/{$product->code}/markup", ['markup_pct' => 31.5, 'lock_version' => $product->lock_version + 50])->assertConflict();
    $this->putJson("/api/v1/catalog/products/{$product->code}/markup", ['markup_pct' => 31.5, 'lock_version' => $product->lock_version])->assertOk()->assertJsonPath('data.markup_pct', 31.5);

    expect((float) rowOf('catalog_products', $product->code)->markup_pct)->toBe(31.5)
        ->and(contractAudit(['entity' => 'Producto', 'entity_id' => $product->code, 'action' => 'cambio_markup', 'after_value' => '31.5 %']))->toBeTrue();
});

it('reordena los componentes y rechaza listas incompletas', function () {
    lockCatalogProducts();
    actingAsSeed('U01');
    $product = contractProduct();
    $ids = collect($this->getJson("/api/v1/catalog/products/{$product->code}/components")->assertOk()->json('data'))->pluck('id')->all();

    $this->postJson("/api/v1/catalog/products/{$product->code}/components/reorder", ['ids' => [$ids[0]]])->assertUnprocessable()->assertJsonPath('code', 'CAT-BR-10');
    $reversed = array_reverse($ids);
    $this->postJson("/api/v1/catalog/products/{$product->code}/components/reorder", ['ids' => $reversed])->assertOk();

    expect(collect($this->getJson("/api/v1/catalog/products/{$product->code}/components")->json('data'))->pluck('id')->all())->toBe($reversed)
        ->and(contractAudit(['entity' => 'Producto', 'entity_id' => $product->code, 'after_value' => 'Reordenó los componentes']))->toBeTrue();
});
