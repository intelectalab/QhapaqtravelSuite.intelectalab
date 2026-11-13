<?php

use App\Domain\Catalog\Support\ComponentCostBreakdown;
use Brick\Math\BigDecimal;
use Illuminate\Support\Facades\DB;

it('la ficha muestra el costo por persona según el grupo: por pasajero más lo del grupo repartido', function () {
    actingAsSeed('U01');

    $breakdown = $this->getJson('/api/v1/catalog/products/CUS-HUM-FD/overview')->assertOk()->json('data.kpis.cost_breakdown');
    $groups = collect($breakdown['groups'])->keyBy('pax');

    expect($breakdown['per_person'])->toBe('70.00')
        ->and($breakdown['shared'])->toBe('220.00')
        ->and($breakdown['min_pax'])->toBe(2)
        ->and($breakdown['max_pax'])->toBe(20)
        ->and($breakdown['price'])->toBe('140.00')
        ->and(collect($breakdown['items'])->where('per_person', false)->pluck('amount')->all())->toBe(['220.00'])
        ->and($groups[2]['shared_share'])->toBe('110.00')
        ->and($groups[2]['profit'])->toBe('-40.00')
        ->and($groups[2]['cost'])->toBe('180.00')
        ->and($groups[2]['margin_pct'])->toBe('-28.6')
        ->and($groups[20]['cost'])->toBe('81.00')
        ->and($breakdown['break_even'])->toBe(4)
        ->and($breakdown['loses_at_min'])->toBeTrue();
});

it('Ventas no ve el costo por persona, como no ve los costos', function () {
    actingAsSeed('U03');

    expect($this->getJson('/api/v1/catalog/products/CUS-HUM-FD/overview')->assertOk()->json('data.kpis.cost_breakdown'))->toBeNull();
});

it('reparte los servicios por grupo y marca cuándo la tarifa no cubre el costo', function () {
    $components = collect([['unit' => 'pax', 'subtotal_pen' => '50.00'], ['unit' => 'vehículo', 'subtotal_pen' => '300.00']]);

    $covered = ComponentCostBreakdown::of($components, 1, 3, BigDecimal::of('200'));
    $never = ComponentCostBreakdown::of($components, 1, 3, BigDecimal::of('40'));

    expect(array_column($covered['groups'], 'cost'))->toBe(['350.00', '200.00', '150.00'])
        ->and($covered['break_even'])->toBe(2)
        ->and($covered['loses_at_min'])->toBeTrue()
        ->and($never['break_even'])->toBeNull()
        ->and(ComponentCostBreakdown::sizes(2, 20))->toBe([2, 7, 11, 16, 20])
        ->and(ComponentCostBreakdown::of($components, null, null, null)['max_pax'])->toBe(10);
});

it('el sitio dice de qué fecha y temporada sale el precio «desde»', function () {
    $product = $this->getJson('/api/v1/public/products/laguna-humantay-full-day', siteOf())->assertOk()->json('data');
    $card = $product['product'] ?? $product;

    expect($card['from_date'])->not->toBeNull()
        ->and($card)->toHaveKey('from_season');
});

it('cambia solo el mínimo de pasajeros desde la tarjeta: valida contra el máximo, controla la versión y lo deja en la bitácora', function () {
    actingAsSeed('U01');
    $product = withinTenant(tenantA(), fn () => DB::table('catalog_products')->where('code', 'CUS-HUM-FD')->first(['lock_version', 'minimum_passengers', 'maximum_passengers']));

    expect($this->patchJson('/api/v1/catalog/products/CUS-HUM-FD/minimum-passengers', ['minimum_passengers' => $product->maximum_passengers + 1, 'lock_version' => $product->lock_version]))->toBeApiError(422, 'CAT-BR-02')
        ->and($this->patchJson('/api/v1/catalog/products/CUS-HUM-FD/minimum-passengers', ['minimum_passengers' => 4, 'lock_version' => $product->lock_version + 5]))->toBeApiError(409, 'STALE_VERSION');

    $this->patchJson('/api/v1/catalog/products/CUS-HUM-FD/minimum-passengers', ['minimum_passengers' => 4, 'lock_version' => $product->lock_version])->assertOk()->assertJsonPath('data.minimum_passengers', 4);

    $audit = withinTenant(tenantA(), fn () => DB::table('audit_events')->where(['entity' => 'Producto', 'entity_id' => 'CUS-HUM-FD', 'action' => 'modificar'])->orderByDesc('code')->first(['before_value', 'after_value']));
    expect($audit->before_value)->toBe('Pasajeros mínimos: '.$product->minimum_passengers)
        ->and($audit->after_value)->toBe('Pasajeros mínimos: 4')
        ->and($this->getJson('/api/v1/catalog/products/CUS-HUM-FD/overview')->json('data.kpis.cost_breakdown.loses_at_min'))->toBeFalse()
        ->and($this->patchJson('/api/v1/catalog/products/CUS-HUM-FD/minimum-passengers', ['minimum_passengers' => 4, 'lock_version' => $product->lock_version + 1]))->toBeApiError(422, 'CFG-BR-01');

    actingAsSeed('U03');
    expect($this->patchJson('/api/v1/catalog/products/CUS-HUM-FD/minimum-passengers', ['minimum_passengers' => 3, 'lock_version' => $product->lock_version + 1]))->toBeApiError(403);
});

it('en temporada baja el sitio muestra el precio normal tachado y el porcentaje de descuento', function () {
    withinTenant(tenantA(), fn () => DB::table('catalog_seasons')->insert(['ref' => 'TMP-BAJA', 'name' => 'Baja de prueba', 'type' => 'Baja', 'date_from' => BUSINESS_TODAY, 'date_to' => '2026-12-31', 'priority' => 1, 'factor' => '0.80']));

    $product = $this->getJson('/api/v1/public/products/laguna-humantay-full-day', siteOf())->assertOk()->json('data');
    $card = $product['product'] ?? $product;

    expect($card['from_season']['discount_pct'])->toBe(20)
        ->and((float) $card['list'])->toBeGreaterThan((float) $card['from']['amount']);
});
