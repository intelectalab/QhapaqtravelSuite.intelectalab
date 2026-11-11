<?php

use Database\Support\PricingSamples;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\DB;

function priceRuleAudit(array $where): bool
{
    return withinTenant(tenantA(), fn () => DB::table('audit_events')->where($where)->exists());
}

function priceRuleRow(string $ref): ?object
{
    return rowOf('catalog_price_rules', $ref, column: 'ref');
}

function pricingRate(): object
{
    return withinTenant(tenantA(), fn () => DB::table('catalog_rates')->where('status', 'vigente')->where('channel', 'Directo')->where('valid_to', '>=', '2026-10-15')->where('valid_from', '<=', '2026-10-15')->orderBy('ref')->first());
}

beforeEach(function () {
    lockCatalogProducts();
    withinTenant(tenantA(), fn () => (new PricingSamples)->seed((string) tenantA()->getKey()));
    $this->withoutMiddleware(ThrottleRequests::class);
});

it('lista las reglas sembradas y crea, edita, desactiva y elimina una regla', function () {
    actingAsSeed('U01');

    $rules = $this->getJson('/api/v1/catalog/price-rules')->assertOk()->json('data.rules');
    expect(collect($rules)->pluck('ref'))->toContain('PR-01', 'PR-05');

    $ref = $this->postJson('/api/v1/catalog/price-rules', ['name' => 'Recargo feriado', 'kind' => 'Markup fijo', 'value' => 12, 'scope' => 'Feriados largos', 'channel' => 'Directo', 'priority' => 30], critical())->assertCreated()->json('data.ref');
    expect($ref)->toStartWith('PR-')->and(priceRuleAudit(['entity' => 'Regla de precio', 'entity_id' => $ref, 'action' => 'crear']))->toBeTrue();

    $this->patchJson("/api/v1/catalog/price-rules/{$ref}", ['name' => 'Recargo feriado largo', 'kind' => 'Markup fijo', 'value' => 15, 'scope' => 'Feriados largos', 'priority' => 30], critical())->assertOk();
    expect((float) priceRuleRow($ref)->value)->toBe(15.0)->and(priceRuleRow($ref)->channel)->toBeNull();

    $this->postJson("/api/v1/catalog/price-rules/{$ref}/deactivate", [], critical())->assertOk();
    expect(priceRuleRow($ref)->status)->toBe('inactiva');

    $this->deleteJson("/api/v1/catalog/price-rules/{$ref}", ['reason' => 'Ya no aplica'], critical())->assertOk();
    expect(priceRuleRow($ref))->toBeNull()->and(priceRuleAudit(['entity' => 'Regla de precio', 'entity_id' => $ref, 'action' => 'eliminar']))->toBeTrue();
});

it('valida la regla y ventas no entra', function () {
    actingAsSeed('U01');
    $this->postJson('/api/v1/catalog/price-rules', ['name' => 'X', 'kind' => 'Otro', 'scope' => ''], critical())->assertStatus(422)->assertJsonValidationErrors(['name', 'kind', 'value', 'scope']);

    actingAsSeed('U03');
    expect($this->getJson('/api/v1/catalog/price-rules'))->toBeApiError(403);
});

it('CAT-BR-42: el simulador aplica markup, descuento por grupo e IGV en orden', function () {
    actingAsSeed('U01');
    $rate = pricingRate();

    $two = $this->postJson('/api/v1/catalog/pricing/simulate', ['rate_id' => $rate->id, 'date' => '2026-10-15', 'pax' => 2, 'channel' => 'Directo', 'residency' => 'dom'])->assertOk()->json('data');
    $group = $this->postJson('/api/v1/catalog/pricing/simulate', ['rate_id' => $rate->id, 'date' => '2026-10-15', 'pax' => 10, 'channel' => 'Directo', 'residency' => 'nodom'])->assertOk()->json('data');
    $steps = collect($two['steps'])->keyBy('id');

    expect($steps['markup']['rule'])->toBe('PR-01')
        ->and($steps['tax']['rule'])->toBe('PR-03')
        ->and((float) $steps['discount']['amount'])->toBe(0.0)
        ->and(collect($group['steps'])->firstWhere('id', 'discount')['rule'])->toBe('PR-05')
        ->and(collect($group['steps'])->firstWhere('id', 'tax')['amount'])->toEqual(0)
        ->and($two['commission']['rule'])->toBe('PR-07');

    $this->postJson('/api/v1/catalog/pricing/simulate', ['rate_id' => $rate->id, 'date' => '2026-10-15', 'pax' => 0, 'channel' => 'Otro', 'residency' => 'dom'])->assertStatus(422)->assertJsonValidationErrors(['pax', 'channel']);
});
