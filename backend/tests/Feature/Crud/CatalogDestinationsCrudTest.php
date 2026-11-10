<?php

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;

function catDestAudit(array $where): bool
{
    return withinTenant(tenantA(), fn () => DB::table('audit_events')->where($where)->exists());
}

function catDestRow(string $ref): object
{
    return rowOf('catalog_destinations', $ref, column: 'ref');
}

function catDestBody(array $overrides = []): array
{
    return ['name' => 'Nasca', 'type' => 'Ciudad', 'parent_id' => catDestRow('D15')->id, 'lat' => -14.835, 'lng' => -74.932, 'description' => 'Líneas de Nasca', ...$overrides];
}

function catDestBodyOf(string $ref, array $overrides = []): array
{
    $row = catDestRow($ref);

    return ['name' => $row->name, 'type' => $row->type, 'parent_id' => $row->parent_id, 'lat' => $row->lat, 'lng' => $row->lng, 'description' => $row->description, ...$overrides];
}

function catDestCreate(array $overrides = []): string
{
    return (string) test()->postJson('/api/v1/catalog/destinations', catDestBody($overrides))->assertCreated()->json('data.ref');
}

beforeEach(fn () => Queue::fake());

it('crea un destino dentro de la jerarquía con su ruta y nivel', function () {
    actingAsSeed('U02');

    $ref = catDestCreate();
    $row = catDestRow($ref);

    expect($ref)->toStartWith('D')
        ->and($row->path)->toBe('Perú / Costa Centro / Ica / Nasca')
        ->and((int) $row->level)->toBe((int) catDestRow('D15')->level + 1)
        ->and($row->parent_id)->toBe(catDestRow('D15')->id)
        ->and(catDestAudit(['entity' => 'Destino', 'entity_id' => $ref, 'action' => 'crear']))->toBeTrue();
    expect(collect($this->getJson('/api/v1/catalog/destinations')->assertOk()->json('data.destinations'))->pluck('ref'))->toContain($ref);
});

it('valida la jerarquía, los hermanos y las coordenadas', function () {
    actingAsSeed('U01');

    expect($this->postJson('/api/v1/catalog/destinations', catDestBody(['type' => 'Región', 'parent_id' => null])))->toBeApiError(422, 'CAT-BR-39');
    expect($this->postJson('/api/v1/catalog/destinations', catDestBody(['type' => 'País'])))->toBeApiError(422, 'CAT-BR-39');
    expect($this->postJson('/api/v1/catalog/destinations', catDestBody(['type' => 'Región', 'parent_id' => catDestRow('D16')->id])))->toBeApiError(422, 'PROC-011');
    expect($this->postJson('/api/v1/catalog/destinations', catDestBody(['name' => 'paracas'])))->toBeApiError(422, 'CAT-BR-39');
    $this->postJson('/api/v1/catalog/destinations', catDestBody(['lng' => null, 'lat' => -95, 'type' => 'Volcán']))->assertStatus(422)->assertJsonValidationErrors(['lat', 'type']);
});

it('ventas y operaciones no editan destinos', function (string $user) {
    actingAsSeed($user);

    expect($this->postJson('/api/v1/catalog/destinations', catDestBody()))->toBeApiError(403);
    expect($this->patchJson('/api/v1/catalog/destinations/D17', catDestBodyOf('D17', ['name' => 'Oasis'])))->toBeApiError(403);
    expect($this->deleteJson('/api/v1/catalog/destinations/D17', ['reason' => 'Prueba']))->toBeApiError(403);
    expect(catDestRow('D17')->name)->toBe('Huacachina');
})->with(['U03', 'U05']);

it('renombrar un destino reindexa la ruta de sus subdestinos', function () {
    actingAsSeed('U01');

    $this->patchJson('/api/v1/catalog/destinations/D15', catDestBodyOf('D15', ['name' => 'Ica y Paracas']))->assertOk()->assertJsonPath('data.ref', 'D15');

    expect(catDestRow('D15')->path)->toBe('Perú / Costa Centro / Ica y Paracas')
        ->and(catDestRow('D16')->path)->toBe('Perú / Costa Centro / Ica y Paracas / Paracas')
        ->and(catDestRow('D17')->path)->toBe('Perú / Costa Centro / Ica y Paracas / Huacachina')
        ->and(catDestAudit(['entity' => 'Destino', 'entity_id' => 'D15', 'action' => 'modificar']))->toBeTrue();
});

it('mover un destino a otro padre cambia su nivel y el de sus hijos', function () {
    actingAsSeed('U01');

    $this->patchJson('/api/v1/catalog/destinations/D15', catDestBodyOf('D15', ['parent_id' => catDestRow('D02')->id]))->assertOk();

    expect(catDestRow('D15')->path)->toBe('Perú / Sur Andino / Ica')
        ->and(catDestRow('D16')->path)->toBe('Perú / Sur Andino / Ica / Paracas')
        ->and((int) catDestRow('D16')->level)->toBe((int) catDestRow('D15')->level + 1);
});

it('rechaza ciclos y cambios de tipo que desordenan a los hijos', function () {
    actingAsSeed('U01');

    expect($this->patchJson('/api/v1/catalog/destinations/D02', catDestBodyOf('D02', ['parent_id' => catDestRow('D03')->id])))->toBeApiError(422, 'PROC-011');
    expect($this->patchJson('/api/v1/catalog/destinations/D03', catDestBodyOf('D03', ['parent_id' => catDestRow('D03')->id])))->toBeApiError(422, 'PROC-011');
    expect($this->patchJson('/api/v1/catalog/destinations/D03', catDestBodyOf('D03', ['type' => 'Atracción'])))->toBeApiError(422, 'CAT-BR-39');
    expect($this->patchJson('/api/v1/catalog/destinations/D16', catDestBodyOf('D16', ['name' => 'Huacachina'])))->toBeApiError(422, 'CAT-BR-39');
    expect(catDestRow('D02')->path)->toBe('Perú / Sur Andino');
});

it('elimina de forma lógica un destino sin hijos ni productos', function () {
    actingAsSeed('U01');
    $ref = catDestCreate();

    $this->deleteJson("/api/v1/catalog/destinations/{$ref}", [])->assertStatus(422)->assertJsonValidationErrors('reason');
    $this->deleteJson("/api/v1/catalog/destinations/{$ref}", ['reason' => 'Creado por error'])->assertOk();

    expect(catDestRow($ref)->deleted_at)->not->toBeNull()
        ->and(catDestAudit(['entity' => 'Destino', 'entity_id' => $ref, 'action' => 'eliminar']))->toBeTrue();
    expect(collect($this->getJson('/api/v1/catalog/destinations')->json('data.destinations'))->pluck('ref'))->not->toContain($ref);
    expect($this->postJson('/api/v1/catalog/destinations', catDestBody()))->toBeApiError(422, 'CAT-BR-39');
    $this->deleteJson("/api/v1/catalog/destinations/{$ref}", ['reason' => 'Otra vez'])->assertNotFound();
});

it('no elimina destinos con subdestinos o con productos', function () {
    actingAsSeed('U01');

    expect($this->deleteJson('/api/v1/catalog/destinations/D03', ['reason' => 'Prueba']))->toBeApiError(409, 'CAT-BR-39');
    expect($this->deleteJson('/api/v1/catalog/destinations/D06', ['reason' => 'Prueba']))->toBeApiError(409, 'CAT-BR-39');
    expect(catDestRow('D03')->deleted_at)->toBeNull()->and(catDestRow('D06')->deleted_at)->toBeNull();
});
