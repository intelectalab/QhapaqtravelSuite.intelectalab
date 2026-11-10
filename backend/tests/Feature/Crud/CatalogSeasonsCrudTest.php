<?php

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;

function catSeasonAudit(array $where): bool
{
    return withinTenant(tenantA(), fn () => DB::table('audit_events')->where($where)->exists());
}

function catSeasonRow(string $ref): object
{
    return rowOf('catalog_seasons', $ref, column: 'ref');
}

function catSeasonBody(array $overrides = []): array
{
    return ['name' => 'Puente de octubre', 'type' => 'Feriado', 'date_from' => '2026-10-01', 'date_to' => '2026-10-10', 'priority' => 1, 'factor' => 1.5, ...$overrides];
}

function catSeasonCreate(array $overrides = []): string
{
    return (string) test()->postJson('/api/v1/catalog/seasons', catSeasonBody($overrides))->assertCreated()->json('data.ref');
}

function catSeasonSitePrice(): string
{
    return (string) test()->postJson('/api/v1/public/price-quote', ['product' => 'laguna-humantay-full-day', 'date' => '2026-10-02', 'adults' => 2], siteOf())->assertOk()->json('data.lines.0.unit');
}

function catSeasonDeskPrice(): string
{
    return (string) test()->postJson('/api/v1/reservations/availability-check', ['product_id' => 'CUS-HUM-FD', 'departure_id' => departureRow('SAL-0403')->id, 'adt' => 2])->assertOk()->json('data.adult_price');
}

beforeEach(fn () => Queue::fake());

it('una temporada nueva aplica su factor al sitio y al cotizador en sus fechas', function () {
    actingAsSeed('U01');
    expect(catSeasonSitePrice())->toBe('129.00')->and(catSeasonDeskPrice())->toBe('140.00');

    $ref = catSeasonCreate();
    $row = catSeasonRow($ref);

    expect($ref)->toStartWith('TMP-')
        ->and($row->status)->toBe('activa')
        ->and((string) $row->factor)->toBe('1.50')
        ->and(catSeasonAudit(['entity' => 'Temporada', 'entity_id' => $ref, 'action' => 'crear']))->toBeTrue();
    expect(catSeasonSitePrice())->toBe('193.50')->and(catSeasonDeskPrice())->toBe('210.00');
    expect(collect($this->getJson('/api/v1/catalog/rates')->assertOk()->json('data.seasons'))->pluck('ref'))->toContain($ref);
});

it('editar el factor de la temporada recalcula el precio', function () {
    actingAsSeed('U01');
    $ref = catSeasonCreate();

    $this->patchJson("/api/v1/catalog/seasons/{$ref}", catSeasonBody(['factor' => 1.2, 'name' => 'Puente largo de octubre']))->assertOk()->assertJsonPath('data.ref', $ref);

    expect((string) catSeasonRow($ref)->factor)->toBe('1.20')
        ->and(catSeasonRow($ref)->name)->toBe('Puente largo de octubre')
        ->and(catSeasonAudit(['entity' => 'Temporada', 'entity_id' => $ref, 'action' => 'modificar']))->toBeTrue();
    expect(catSeasonSitePrice())->toBe('154.80')->and(catSeasonDeskPrice())->toBe('168.00');
});

it('desactivar la temporada devuelve el precio base y activarla lo vuelve a aplicar', function () {
    actingAsSeed('U02');
    $ref = catSeasonCreate();

    $this->postJson("/api/v1/catalog/seasons/{$ref}/deactivate")->assertOk();
    expect(catSeasonRow($ref)->status)->toBe('inactiva')
        ->and(catSeasonAudit(['entity' => 'Temporada', 'entity_id' => $ref, 'action' => 'desactivar']))->toBeTrue();
    expect(catSeasonSitePrice())->toBe('129.00')->and(catSeasonDeskPrice())->toBe('140.00');

    $this->postJson("/api/v1/catalog/seasons/{$ref}/activate")->assertOk();
    expect(catSeasonRow($ref)->status)->toBe('activa')
        ->and(catSeasonAudit(['entity' => 'Temporada', 'entity_id' => $ref, 'action' => 'activar']))->toBeTrue();
    expect(catSeasonSitePrice())->toBe('193.50');
});

it('rechaza temporadas activas que se cruzan con la misma prioridad', function () {
    actingAsSeed('U01');
    $ref = catSeasonCreate();

    expect($this->postJson('/api/v1/catalog/seasons', catSeasonBody(['name' => 'Otra fecha', 'date_from' => '2026-10-05', 'date_to' => '2026-10-20'])))->toBeApiError(422, 'PROC-019');
    $this->postJson('/api/v1/catalog/seasons', catSeasonBody(['name' => 'Otra prioridad', 'date_from' => '2026-10-05', 'date_to' => '2026-10-20', 'priority' => 4]))->assertCreated();

    $idle = catSeasonCreate(['name' => 'Borrador de temporada', 'status' => 'inactiva', 'date_from' => '2026-10-08', 'date_to' => '2026-10-12']);
    expect($this->postJson("/api/v1/catalog/seasons/{$idle}/activate"))->toBeApiError(422, 'PROC-019');
    expect(catSeasonRow($idle)->status)->toBe('inactiva');
    expect($this->patchJson("/api/v1/catalog/seasons/{$idle}", catSeasonBody(['status' => 'activa', 'date_from' => '2026-10-08', 'date_to' => '2026-10-12'])))->toBeApiError(422, 'PROC-019');
    expect($this->patchJson('/api/v1/catalog/seasons/TMP-02', catSeasonBody(['name' => 'Temporada media', 'type' => 'Media', 'date_from' => '2026-09-01', 'date_to' => '2026-11-30', 'priority' => 1])))->toBeApiError(422, 'PROC-019');
    expect(catSeasonRow($ref)->status)->toBe('activa');
});

it('valida los datos de la temporada', function () {
    actingAsSeed('U01');

    $this->postJson('/api/v1/catalog/seasons', catSeasonBody(['factor' => 5, 'date_to' => '2026-09-01', 'type' => 'Eterna']))
        ->assertStatus(422)->assertJsonValidationErrors(['factor', 'date_to', 'type']);
    $this->patchJson('/api/v1/catalog/seasons/TMP-02', catSeasonBody(['priority' => 120]))->assertStatus(422)->assertJsonValidationErrors('priority');
    $this->patchJson('/api/v1/catalog/seasons/TMP-99', catSeasonBody())->assertNotFound();
});

it('solo quien gestiona tarifas administra temporadas', function (string $user) {
    actingAsSeed($user);

    expect($this->postJson('/api/v1/catalog/seasons', catSeasonBody()))->toBeApiError(403);
    expect($this->patchJson('/api/v1/catalog/seasons/TMP-02', catSeasonBody(['priority' => 2])))->toBeApiError(403);
    expect($this->postJson('/api/v1/catalog/seasons/TMP-02/deactivate'))->toBeApiError(403);
    expect($this->postJson('/api/v1/catalog/seasons/TMP-02/activate'))->toBeApiError(403);
    expect(catSeasonRow('TMP-02')->status)->toBe('activa');
})->with(['U03', 'U05', 'U07']);
