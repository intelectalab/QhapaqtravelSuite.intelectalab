<?php

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;

function elProduct(string $code): object
{
    return rowOf('catalog_products', $code);
}

function elRef(string $table, string $ref): string
{
    return rowOf($table, $ref, column: 'ref')->id;
}

function elLock(string $code): int
{
    return (int) elProduct($code)->lock_version;
}

function elAudit(string $code, string $after): bool
{
    return withinTenant(tenantA(), fn () => DB::table('audit_events')->where('entity', 'Producto')->where('entity_id', $code)->where('after_value', $after)->exists());
}

function elComponents(string $code): array
{
    $id = elProduct($code)->id;

    return withinTenant(tenantA(), fn () => DB::table('catalog_product_items')->where('product_id', $id)->orderBy('sort_order')->get()->all());
}

beforeEach(function () {
    lockCatalogProducts();
    Queue::fake();
});

it('agrega, edita y quita componentes uno por uno y deja cada cambio en la auditoría', function () {
    actingAsSeed('U01');
    $service = rowOf('catalog_services', 'SRV-016', column: 'ref');

    $created = $this->postJson('/api/v1/catalog/products/LOR-AMZ-4D/components', ['service_id' => $service->id, 'quantity' => 2, 'is_included' => true], critical())->assertCreated();
    $componentId = $created->json('data.components.0.id');
    expect($componentId)->not->toBeNull()
        ->and(elAudit('LOR-AMZ-4D', "Agregó componente SRV-016 {$service->name} (2 × {$service->currency} ".number_format((float) $service->cost, 2, '.', '').')'))->toBeTrue();

    $this->patchJson("/api/v1/catalog/products/LOR-AMZ-4D/components/{$componentId}", ['quantity' => 3, 'is_included' => false], critical(elLock('LOR-AMZ-4D')))->assertOk()->assertJsonPath('data.components.0.quantity', 3);
    expect(elComponents('LOR-AMZ-4D')[0]->id)->toBe($componentId)
        ->and(elAudit('LOR-AMZ-4D', "Cambió la cantidad de SRV-016 {$service->name} de 2 a 3"))->toBeTrue()
        ->and(elAudit('LOR-AMZ-4D', "Sacó del precio SRV-016 {$service->name}"))->toBeTrue();

    expect($this->patchJson("/api/v1/catalog/products/LOR-AMZ-4D/components/{$componentId}", ['quantity' => 4, 'lock_version' => elLock('LOR-AMZ-4D') - 1], critical(elLock('LOR-AMZ-4D') - 1)))->toBeApiError(409, 'STALE_VERSION');
    $this->patchJson("/api/v1/catalog/products/LOR-AMZ-4D/components/{$componentId}", ['quantity' => 0], critical())->assertStatus(422)->assertJsonValidationErrors('component.quantity');
    expect($this->postJson('/api/v1/catalog/products/LOR-AMZ-4D/components', ['service_id' => elRef('catalog_services', 'SRV-017'), 'quantity' => 1], critical()))->toBeApiError(422, 'PRD-BR-007');
    expect($this->postJson('/api/v1/catalog/products/LOR-AMZ-4D/components', ['service_id' => $service->id, 'quantity' => 1], critical()))->toBeApiError(422, 'CAT-BR-10');
    expect($this->deleteJson('/api/v1/catalog/products/LOR-AMZ-4D/components/01a1ae34-0000-7000-8000-000000000000', [], critical()))->toBeApiError(404);

    $this->deleteJson("/api/v1/catalog/products/LOR-AMZ-4D/components/{$componentId}", [], critical())->assertNoContent();
    expect(elComponents('LOR-AMZ-4D'))->toBe([])
        ->and(elAudit('LOR-AMZ-4D', "Quitó componente SRV-016 {$service->name}"))->toBeTrue();

    actingAsSeed('U03');
    expect($this->postJson('/api/v1/catalog/products/LOR-AMZ-4D/components', ['service_id' => $service->id, 'quantity' => 1], critical()))->toBeApiError(403);
});

it('maneja días y actividades del itinerario por elemento conservando sus identificadores', function () {
    actingAsSeed('U01');

    $day = $this->postJson('/api/v1/catalog/products/LOR-AMZ-4D/itineraries/principal/days', ['title' => 'Llegada a Iquitos', 'items' => [['time' => '10:00', 'activity' => 'Traslado al lodge', 'type' => 'Traslado']]], critical())->assertCreated();
    $itinerary = $day->json('data.itinerary_id');
    $dayId = $day->json('data.itinerary.0.id');
    expect(elAudit('LOR-AMZ-4D', 'Agregó el día 1: Llegada a Iquitos'))->toBeTrue()
        ->and(elAudit('LOR-AMZ-4D', 'Agregó la actividad 10:00 Traslado al lodge del día 1'))->toBeTrue();

    $this->postJson("/api/v1/catalog/products/LOR-AMZ-4D/itineraries/{$itinerary}/days/{$dayId}/items", ['time' => '15:00', 'activity' => 'Caminata nocturna', 'type' => 'Actividad'], critical())->assertCreated();
    $items = $this->getJson('/api/v1/catalog/products/LOR-AMZ-4D/editor')->json('data.itinerary.0.items');
    $walk = collect($items)->firstWhere('activity', 'Caminata nocturna')['id'];

    $this->patchJson("/api/v1/catalog/products/LOR-AMZ-4D/itineraries/{$itinerary}/days/{$dayId}/items/{$walk}", ['time' => '19:00'], critical())->assertOk();
    expect(elAudit('LOR-AMZ-4D', 'Cambió la actividad 19:00 Caminata nocturna del día 1'))->toBeTrue();

    $this->patchJson("/api/v1/catalog/products/LOR-AMZ-4D/itineraries/{$itinerary}/days/{$dayId}", ['title' => 'Iquitos y el río Amazonas'], critical())->assertOk()->assertJsonPath('data.itinerary.0.id', $dayId);
    expect(elAudit('LOR-AMZ-4D', 'Cambió el título del día 1 a Iquitos y el río Amazonas'))->toBeTrue();
    $this->patchJson("/api/v1/catalog/products/LOR-AMZ-4D/itineraries/{$itinerary}/days/{$dayId}", ['title' => 'X'], critical())->assertStatus(422)->assertJsonValidationErrors('day.title');
    expect($this->patchJson('/api/v1/catalog/products/LOR-AMZ-4D/itineraries/otro/days/'.$dayId, ['title' => 'Otro título'], critical()))->toBeApiError(404);

    $this->deleteJson("/api/v1/catalog/products/LOR-AMZ-4D/itineraries/{$itinerary}/days/{$dayId}/items/{$walk}", [], critical())->assertNoContent();
    expect(elAudit('LOR-AMZ-4D', 'Quitó la actividad 19:00 Caminata nocturna'))->toBeTrue();

    $this->deleteJson("/api/v1/catalog/products/LOR-AMZ-4D/itineraries/{$itinerary}/days/{$dayId}", [], critical())->assertNoContent();
    expect($this->getJson('/api/v1/catalog/products/LOR-AMZ-4D/editor')->json('data.itinerary'))->toBe([])
        ->and(elAudit('LOR-AMZ-4D', 'Quitó el día 1: Iquitos y el río Amazonas'))->toBeTrue();
});

it('asocia y quita temporadas por elemento y protege las que usan tarifas', function () {
    actingAsSeed('U01');
    $season = rowOf('catalog_seasons', 'TMP-03', column: 'ref');

    $this->postJson('/api/v1/catalog/products/LOR-AMZ-4D/seasons', ['season_id' => $season->id], critical())->assertCreated();
    expect(elAudit('LOR-AMZ-4D', "Asoció la temporada {$season->name}"))->toBeTrue();
    expect($this->postJson('/api/v1/catalog/products/LOR-AMZ-4D/seasons', ['season_id' => $season->id], critical()))->toBeApiError(409, 'CAT-BR-13');

    $this->deleteJson('/api/v1/catalog/products/LOR-AMZ-4D/seasons/TMP-03', [], critical())->assertNoContent();
    expect(elAudit('LOR-AMZ-4D', "Quitó la temporada {$season->name}"))->toBeTrue();
    expect($this->deleteJson('/api/v1/catalog/products/LOR-AMZ-4D/seasons/TMP-03', [], critical()))->toBeApiError(404);

    $rated = withinTenant(tenantA(), fn () => DB::table('catalog_rates')->whereNotNull('season_id')->first(['product_id', 'season_id']));
    $product = withinTenant(tenantA(), fn () => DB::table('catalog_products')->where('id', $rated->product_id)->value('code'));
    withinTenant(tenantA(), fn () => DB::table('catalog_product_seasons')->insertOrIgnore(['product_id' => $rated->product_id, 'season_id' => $rated->season_id]));
    expect($this->deleteJson("/api/v1/catalog/products/{$product}/seasons/{$rated->season_id}", [], critical()))->toBeApiError(422, 'CAT-BR-13');

    actingAsSeed('U03');
    expect($this->postJson('/api/v1/catalog/products/LOR-AMZ-4D/seasons', ['season_id' => $season->id], critical()))->toBeApiError(403);
});

it('publica o despublica un canal solo con el producto activo y nunca despublica ERP', function () {
    actingAsSeed('U01');

    $state = fn () => withinTenant(tenantA(), fn () => DB::table('catalog_product_channels')->where('product_id', elProduct('CUS-HUM-FD')->id)->where('channel', 'mobile')->value('is_published'));

    $this->putJson('/api/v1/catalog/products/CUS-HUM-FD/channels/mobile', ['published' => false], critical())->assertOk();
    expect($state())->toBeFalse()->and(elAudit('CUS-HUM-FD', 'Despublicó el canal Mobile'))->toBeTrue();

    $this->putJson('/api/v1/catalog/products/CUS-HUM-FD/channels/mobile', ['published' => true], critical())->assertOk();
    expect($state())->toBeTrue()->and(elAudit('CUS-HUM-FD', 'Publicó el canal Mobile'))->toBeTrue();

    expect($this->putJson('/api/v1/catalog/products/CUS-HUM-FD/channels/erp', ['published' => false], critical()))->toBeApiError(422, 'CAT-BR-04');
    expect($this->putJson('/api/v1/catalog/products/LOR-AMZ-4D/channels/b2b', ['published' => true], critical()))->toBeApiError(422, 'PRD-BR-002');
    expect($this->putJson('/api/v1/catalog/products/CUS-HUM-FD/channels/fax', ['published' => true], critical()))->toBeApiError(404);
    $this->putJson('/api/v1/catalog/products/CUS-HUM-FD/channels/b2b', [], critical())->assertStatus(422)->assertJsonValidationErrors('published');

    actingAsSeed('U03');
    expect($this->putJson('/api/v1/catalog/products/CUS-HUM-FD/channels/b2b', ['published' => true], critical()))->toBeApiError(403);
});

it('el guardado por sección registra cada cambio con su detalle', function () {
    actingAsSeed('U01');
    $lock = elLock('LOR-AMZ-4D');
    $destination = rowOf('catalog_destinations', 'D20', column: 'ref');

    $this->putJson('/api/v1/catalog/products/LOR-AMZ-4D/channels', ['lock_version' => $lock, 'channels' => ['b2b']], critical($lock))->assertOk();
    expect(elAudit('LOR-AMZ-4D', 'Solicitó el canal B2B'))->toBeTrue();

    $lock = elLock('LOR-AMZ-4D');
    $this->putJson('/api/v1/catalog/products/LOR-AMZ-4D/availability', ['lock_version' => $lock, 'model' => 'CAPACIDAD', 'capacity' => 12, 'source' => 'interna'], critical($lock))->assertOk();
    expect(elAudit('LOR-AMZ-4D', 'Cambió la disponibilidad a CAPACIDAD · 12 cupos · inventario propio'))->toBeTrue();

    $lock = elLock('LOR-AMZ-4D');
    $policies = ['cancellation' => 'Sin costo hasta 20 días antes.', 'modification' => 'Cambios sujetos a disponibilidad.', 'no_show' => 'Se cobra el 100 %.', 'refund' => 'Reembolso en 10 días hábiles.'];
    $this->putJson('/api/v1/catalog/products/LOR-AMZ-4D/policies', ['lock_version' => $lock, ...$policies], critical($lock))->assertOk();
    expect(elAudit('LOR-AMZ-4D', 'Cambió la política de cancelación'))->toBeTrue();

    $lock = elLock('LOR-AMZ-4D');
    $content = ['long_description' => 'Lodge en la selva.', 'slug' => 'amazonia-lodge', 'inclusions' => ['Pensión completa'], 'exclusions' => [], 'requirements' => [['category' => 'Documentos', 'text' => 'Pasaporte vigente']], 'faqs' => [], 'media' => []];
    $this->putJson('/api/v1/catalog/products/LOR-AMZ-4D/content', ['lock_version' => $lock, ...$content], critical($lock))->assertOk();
    expect(elAudit('LOR-AMZ-4D', 'Agregó «Pensión completa» a «Incluye»'))->toBeTrue()
        ->and(elAudit('LOR-AMZ-4D', 'Agregó el requisito «Pasaporte vigente»'))->toBeTrue();

    $product = elProduct('LOR-AMZ-4D');
    $lock = (int) $product->lock_version;
    $body = ['name' => $product->name, 'code' => $product->code, 'type_id' => $product->product_type_id, 'category_id' => $product->category_id, 'destination_id' => $product->primary_destination_id, 'duration_value' => (float) $product->duration_value, 'duration_unit' => $product->duration_unit, 'modality' => $product->modality, 'minimum_passengers' => (int) $product->minimum_passengers, 'maximum_passengers' => (int) $product->maximum_passengers, 'minimum_age' => (int) $product->minimum_age, 'maximum_age' => (int) $product->maximum_age, 'booking_advance_min_days' => (int) $product->booking_advance_min_days, 'booking_advance_max_days' => (int) $product->booking_advance_max_days, 'secondary_destination_ids' => [$destination->id], 'lock_version' => $lock];
    $this->patchJson('/api/v1/catalog/products/LOR-AMZ-4D', $body, critical($lock))->assertOk();
    expect(elAudit('LOR-AMZ-4D', "Agregó destino secundario {$destination->name}"))->toBeTrue();
});

it('la ficha del producto reúne salidas, uso en ventas, versiones e historial según el rol', function () {
    actingAsSeed('U01');

    $data = $this->getJson('/api/v1/catalog/products/CUS-HUM-FD/overview')->assertOk()->json('data');
    expect($data['kpis']['sellable'])->toBeTrue()
        ->and($data['checklist']['total'])->toBe(12)
        ->and($data['departures'])->not->toBeEmpty()
        ->and($data['providers'])->toBeArray()
        ->and($data['history'])->toBeArray()
        ->and($data['versions'])->toBeArray();

    actingAsSeed('U03');
    $sales = $this->getJson('/api/v1/catalog/products/CUS-HUM-FD/overview')->assertOk()->json('data');
    expect($sales['profitability'])->toBeNull()->and($sales['history'])->toBeNull();
    $this->getJson('/api/v1/catalog/products/NO-EXISTE/overview')->assertNotFound();
});
