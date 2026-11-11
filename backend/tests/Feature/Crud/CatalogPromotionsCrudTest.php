<?php

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;

beforeEach(fn () => Queue::fake());

function promoBody(array $extra = []): array
{
    $today = now('America/Lima')->toDateString();

    return ['name' => 'Verano andino', 'kind' => 'Descuento %', 'value' => 12, 'channel' => 'E-commerce', 'promo_code' => 'verano12', 'valid_from' => $today, 'valid_to' => now('America/Lima')->addDays(30)->toDateString(), ...$extra];
}

function promoRow(string $ref): ?object
{
    return withinTenant(tenantA(), fn () => DB::table('catalog_product_promotions')->where('ref', $ref)->first());
}

function promoAudit(string $ref, string $action): bool
{
    return withinTenant(tenantA(), fn () => DB::table('audit_events')->where(['entity' => 'Promoción', 'entity_id' => $ref, 'action' => $action])->exists());
}

it('crea, edita, pausa, activa y elimina una promoción del producto', function () {
    actingAsSeed('U01');

    $ref = $this->postJson('/api/v1/catalog/products/CUS-HUM-FD/promotions', promoBody(), critical())->assertCreated()->json('data.ref');
    $row = promoRow($ref);
    expect($ref)->toStartWith('PROMO-')
        ->and($row->promo_code)->toBe('VERANO12')
        ->and($row->status)->toBe('activa')
        ->and(promoAudit($ref, 'crear'))->toBeTrue();

    $this->patchJson("/api/v1/catalog/products/CUS-HUM-FD/promotions/{$ref}", ['value' => 15, 'name' => 'Verano andino plus'], critical())->assertOk();
    expect((string) promoRow($ref)->value)->toBe('15.00')->and(promoRow($ref)->name)->toBe('Verano andino plus')->and(promoAudit($ref, 'modificar'))->toBeTrue();

    $this->postJson("/api/v1/catalog/products/CUS-HUM-FD/promotions/{$ref}/pause", [], critical())->assertOk()->assertJsonPath('data.status', 'inactiva');
    expect(promoRow($ref)->status)->toBe('inactiva');
    $this->postJson("/api/v1/catalog/products/CUS-HUM-FD/promotions/{$ref}/activate", [], critical())->assertOk();
    $this->postJson("/api/v1/catalog/promotions/{$ref}/deactivate", [], critical())->assertOk();
    $this->postJson("/api/v1/catalog/promotions/{$ref}/activate", [], critical())->assertOk();
    expect(promoRow($ref)->status)->toBe('activa');

    $list = $this->getJson('/api/v1/catalog/products/CUS-HUM-FD/promotions')->assertOk()->json('data');
    expect(collect($list)->firstWhere('ref', $ref)['state'])->toBe('vigente');

    $this->deleteJson("/api/v1/catalog/products/CUS-HUM-FD/promotions/{$ref}", [], critical())->assertNoContent();
    expect(promoRow($ref)->deleted_at)->not->toBeNull()
        ->and(collect($this->getJson('/api/v1/channels/ecommerce/promotions')->assertOk()->json('data.rows'))->pluck('ref'))->not->toContain($ref);
});

it('CAT-BR-27: valida el tope porcentual, la vigencia, el código único y el precio sobre la tarifa pública', function () {
    actingAsSeed('U01');
    $this->postJson('/api/v1/catalog/products/CUS-HUM-FD/promotions', promoBody(['promo_code' => 'UNICO10']), critical())->assertCreated();

    expect($this->postJson('/api/v1/catalog/products/CUS-HUM-FD/promotions', promoBody(['value' => 60, 'promo_code' => null]), critical()))->toBeApiError(422, 'CAT-BR-27')
        ->and($this->postJson('/api/v1/catalog/products/CUS-HUM-FD/promotions', promoBody(['promo_code' => 'unico10']), critical()))->toBeApiError(422, 'CAT-BR-27')
        ->and($this->postJson('/api/v1/catalog/products/CUS-HUM-FD/promotions', promoBody(['promo_code' => null, 'valid_to' => now('America/Lima')->subDay()->toDateString(), 'valid_from' => now('America/Lima')->subDays(5)->toDateString()]), critical()))->toBeApiError(422, 'CAT-BR-27')
        ->and($this->postJson('/api/v1/catalog/products/CUS-HUM-FD/promotions', promoBody(['promo_code' => null, 'kind' => 'Precio promocional', 'value' => 999999]), critical()))->toBeApiError(422, 'CAT-BR-27')
        ->and($this->postJson('/api/v1/catalog/products/CUS-HUM-FD/promotions', promoBody(['promo_code' => null, 'kind' => 'Descuento por cantidad']), critical()))->toBeApiError(422, 'CAT-BR-27');

    $this->postJson('/api/v1/catalog/products/CUS-HUM-FD/promotions', ['name' => 'x', 'kind' => 'Regalo', 'value' => 0], critical())
        ->assertStatus(422)->assertJsonValidationErrors(['name', 'kind', 'value', 'valid_from', 'valid_to']);
});

it('ECO-BR-05: una promoción nueva del canal e-commerce aparece en el sitio y en las ofertas', function () {
    actingAsSeed('U01');
    $ref = $this->postJson('/api/v1/catalog/products/CUS-HUM-FD/promotions', promoBody(['promo_code' => 'OFERTA9', 'value' => 9]), critical())->assertCreated()->json('data.ref');

    $offers = $this->getJson('/api/v1/public/offers', siteOf())->assertOk()->json('data');
    expect(collect($offers['codes'])->pluck('code'))->toContain('OFERTA9')
        ->and($offers)->toHaveKeys(['offers', 'codes', 'departures']);

    $this->postJson("/api/v1/catalog/products/CUS-HUM-FD/promotions/{$ref}/pause", [], critical())->assertOk();
    expect(collect($this->getJson('/api/v1/public/offers', siteOf())->assertOk()->json('data.codes'))->pluck('code'))->not->toContain('OFERTA9');
});

it('Operaciones no administra promociones', function () {
    actingAsSeed('U05');

    expect($this->postJson('/api/v1/catalog/products/CUS-HUM-FD/promotions', promoBody(), critical()))->toBeApiError(403)
        ->and($this->getJson('/api/v1/channels/ecommerce/promotions'))->toBeApiError(403);
});
