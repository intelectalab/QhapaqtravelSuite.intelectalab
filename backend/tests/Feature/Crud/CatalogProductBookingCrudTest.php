<?php

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;

function bkProduct(string $code): object
{
    return rowOf('catalog_products', $code);
}

function bkLock(string $code): int
{
    return (int) bkProduct($code)->lock_version;
}

function bkAudit(string $code, string $action): bool
{
    return withinTenant(tenantA(), fn () => DB::table('audit_events')->where('entity', 'Producto')->where('entity_id', $code)->where('action', $action)->exists());
}

function bkRows(string $table, string $code): array
{
    $id = bkProduct($code)->id;

    return withinTenant(tenantA(), fn () => DB::table($table)->where('product_id', $id)->get()->all());
}

function bkPax(array $overrides = []): array
{
    return [
        'adult_min_age' => 12, 'child_min_age' => 4, 'child_max_age' => 11, 'infant_max_age' => 3,
        'child_pays' => true, 'child_price_pct' => 50, 'infant_allowed' => true, 'infant_pays' => false,
        'max_children_per_adult' => 2, 'max_infants_per_adult' => 1, 'min_adults' => 1, 'note' => 'Nota al cliente',
        ...$overrides,
    ];
}

beforeEach(function () {
    lockCatalogProducts();
    Queue::fake();
});

it('lee la configuración de reservas online del producto con secciones, reglas y ejemplos', function () {
    actingAsSeed('U01');

    $response = $this->getJson('/api/v1/catalog/products/CUS-HUM-FD/booking-config')->assertOk();

    expect($response->json('data.product.code'))->toBe('CUS-HUM-FD')
        ->and($response->json('data.sections.pasajeros.status'))->toBe('on')
        ->and($response->json('data.can.manage_rates'))->toBeTrue()
        ->and($response->json('data.examples.payment'))->not->toBeEmpty()
        ->and(collect($response->json('data.rules'))->pluck('code'))->toContain('R-ADDONS');

    $this->getJson('/api/v1/catalog/products/CUS-HUM-FD/pax-rules')->assertOk()->assertJsonStructure(['data' => ['inherited', 'effective']]);
    $this->getJson('/api/v1/catalog/products/CUS-HUM-FD/addons')->assertOk();
    $this->getJson('/api/v1/catalog/products/CUS-HUM-FD/payment-policy')->assertOk()->assertJsonStructure(['data' => ['effective_modes']]);
    $this->getJson('/api/v1/catalog/products/CUS-HUM-FD/pickup')->assertOk()->assertJsonStructure(['data' => ['required', 'points']]);
    $this->getJson('/api/v1/catalog/products/CUS-HUM-FD/rule-overrides')->assertOk();
    expect($this->getJson('/api/v1/catalog/products/NO-EXISTE/booking-config'))->toBeApiError(404);
});

it('guarda y restablece las reglas de pasajeros, valida las bandas y el simulador usa la regla', function () {
    actingAsSeed('U01');

    expect($this->putJson('/api/v1/catalog/products/CUS-HUM-FD/pax-rules', bkPax(['infant_max_age' => 4, 'child_min_age' => 4]), critical()))->toBeApiError(422, 'CAT-PX-01');
    $this->putJson('/api/v1/catalog/products/CUS-HUM-FD/pax-rules', bkPax(['child_price_pct' => 140]), critical())->assertStatus(422)->assertJsonValidationErrors('child_price_pct');

    $this->putJson('/api/v1/catalog/products/CUS-HUM-FD/pax-rules', bkPax(), critical(bkLock('CUS-HUM-FD')))->assertOk()
        ->assertJsonPath('data.inherited', false)
        ->assertJsonPath('data.values.child_max_age', 11)
        ->assertJsonPath('data.effective.child_price_pct', '50');
    expect(bkAudit('CUS-HUM-FD', 'reglas_pasajeros'))->toBeTrue();

    $simulation = $this->postJson('/api/v1/catalog/products/CUS-HUM-FD/pax-rules/simulate', ['adt' => 1, 'chd' => 3, 'inf' => 2, 'ages' => [30, 6, 2]], critical())->assertOk();
    expect($simulation->json('data.ok'))->toBeFalse()
        ->and($simulation->json('data.errors'))->toHaveCount(2)
        ->and(collect($simulation->json('data.ages'))->pluck('type')->all())->toBe(['ADT', 'CHD', 'INF']);

    $valid = $this->postJson('/api/v1/catalog/products/CUS-HUM-FD/pax-rules/simulate', ['adt' => 2, 'chd' => 1], critical())->assertOk();
    $adult = collect($valid->json('data.lines'))->firstWhere('key', 'base-adt');
    $child = collect($valid->json('data.lines'))->firstWhere('key', 'base-chd');
    expect($valid->json('data.ok'))->toBeTrue()
        ->and((float) $child['unit'])->toBe(round((float) $adult['unit'] * 0.5, 2));

    $this->deleteJson('/api/v1/catalog/products/CUS-HUM-FD/pax-rules', [], critical())->assertNoContent();
    expect(bkRows('catalog_pax_rules', 'CUS-HUM-FD'))->toBe([])
        ->and($this->deleteJson('/api/v1/catalog/products/CUS-HUM-FD/pax-rules', [], critical()))->toBeApiError(422, 'CFG-BR-01');
});

it('crea, edita y elimina adicionales con nombre único y proveedor coherente', function () {
    actingAsSeed('U01');
    $body = ['name' => 'Bastones de trekking', 'category' => 'Servicio', 'price' => 15, 'currency' => 'PEN', 'charge_per' => 'pax', 'applies_to' => ['ADT', 'CHD']];

    $created = $this->postJson('/api/v1/catalog/products/CUS-GAS-EXP/addons', $body, critical())->assertCreated();
    $code = $created->json('data.code');
    expect($code)->toStartWith('ADD-')
        ->and(bkAudit('CUS-GAS-EXP', 'adicional_crear'))->toBeTrue();
    expect($this->postJson('/api/v1/catalog/products/CUS-GAS-EXP/addons', [...$body, 'name' => 'bastones de TREKKING'], critical()))->toBeApiError(422, 'CAT-AD-01');
    $this->postJson('/api/v1/catalog/products/CUS-GAS-EXP/addons', [...$body, 'applies_to' => []], critical())->assertStatus(422)->assertJsonValidationErrors('applies_to');

    $service = withinTenant(tenantA(), fn () => DB::table('catalog_services')->whereNull('deleted_at')->first(['id', 'provider_id']));
    $otherProvider = withinTenant(tenantA(), fn () => DB::table('catalog_providers')->where('id', '<>', $service->provider_id)->value('id'));
    expect($this->patchJson("/api/v1/catalog/products/CUS-GAS-EXP/addons/{$code}", ['service_id' => $service->id, 'provider_id' => $otherProvider], critical()))->toBeApiError(422, 'CAT-AD-02');

    $this->patchJson("/api/v1/catalog/products/CUS-GAS-EXP/addons/{$code}", ['price' => 18.5, 'service_id' => $service->id], critical(bkLock('CUS-GAS-EXP')))->assertOk()
        ->assertJsonPath('data.0.price', '18.50')
        ->assertJsonPath('data.0.provider.id', $service->provider_id);
    expect(bkAudit('CUS-GAS-EXP', 'adicional_modificar'))->toBeTrue();

    $this->deleteJson("/api/v1/catalog/products/CUS-GAS-EXP/addons/{$code}", [], critical())->assertNoContent();
    expect($this->getJson('/api/v1/catalog/products/CUS-GAS-EXP/addons')->json('data'))->toBe([])
        ->and(bkAudit('CUS-GAS-EXP', 'adicional_eliminar'))->toBeTrue();
    $this->postJson('/api/v1/catalog/products/CUS-GAS-EXP/addons', $body, critical())->assertCreated();
});

it('activa el alojamiento, arma tramos y hoteles, y el motor calcula el ejemplo', function () {
    actingAsSeed('U01');

    $this->putJson('/api/v1/catalog/products/CUS-GAS-EXP/accommodation', ['enabled' => true], critical())->assertStatus(422)->assertJsonValidationErrors('currency');
    $this->putJson('/api/v1/catalog/products/CUS-GAS-EXP/accommodation', ['enabled' => true, 'optional' => true, 'currency' => 'USD', 'note' => 'Desayuno incluido'], critical(bkLock('CUS-GAS-EXP')))->assertOk()->assertJsonPath('data.enabled', true);
    expect(bkAudit('CUS-GAS-EXP', 'alojamiento_activar'))->toBeTrue();

    $lima = $this->postJson('/api/v1/catalog/products/CUS-GAS-EXP/accommodation/legs', ['city' => 'Lima', 'nights' => 1], critical())->assertCreated();
    $cusco = $this->postJson('/api/v1/catalog/products/CUS-GAS-EXP/accommodation/legs', ['city' => 'Cusco', 'nights' => 2], critical())->assertCreated();
    $limaId = collect($lima->json('data.legs'))->firstWhere('city', 'Lima')['id'];
    $cuscoId = collect($cusco->json('data.legs'))->firstWhere('city', 'Cusco')['id'];
    $this->postJson('/api/v1/catalog/products/CUS-GAS-EXP/accommodation/legs', ['city' => 'Puno', 'nights' => 40], critical())->assertStatus(422)->assertJsonValidationErrors('nights');

    $rooms = [['room_type' => 'Simple', 'capacity' => 1, 'price_per_night' => 70], ['room_type' => 'Doble', 'capacity' => 2, 'price_per_night' => 85]];
    $hotel = $this->postJson("/api/v1/catalog/products/CUS-GAS-EXP/accommodation/legs/{$limaId}/hotels", ['name' => 'Hotel Miraflores', 'category' => '3 estrellas', 'room_types' => $rooms], critical())->assertCreated();
    $hotelId = collect($hotel->json('data.legs'))->firstWhere('id', $limaId)['hotels'][0]['id'];
    $this->postJson("/api/v1/catalog/products/CUS-GAS-EXP/accommodation/legs/{$cuscoId}/hotels", ['name' => 'Hostal Cusco', 'category' => 'Hostal', 'room_types' => [['room_type' => 'Doble', 'capacity' => 2, 'price_per_night' => 60]]], critical())->assertCreated();
    expect($this->postJson("/api/v1/catalog/products/CUS-GAS-EXP/accommodation/legs/{$limaId}/hotels", ['name' => 'hotel miraflores', 'category' => '3 estrellas', 'room_types' => $rooms], critical()))->toBeApiError(422, 'CAT-LG-01');
    $this->postJson("/api/v1/catalog/products/CUS-GAS-EXP/accommodation/legs/{$limaId}/hotels", ['name' => 'Sin cuartos', 'category' => '3 estrellas', 'room_types' => []], critical())->assertStatus(422)->assertJsonValidationErrors('room_types');

    $example = $this->getJson('/api/v1/catalog/products/CUS-GAS-EXP/booking-config')->assertOk()->json('data.examples.lodging');
    expect($example['rooms'])->toBe(2)
        ->and($example['nights'])->toBe(3)
        ->and($example['currency'])->toBe('USD')
        ->and($example['total'])->toBe('205.00');

    $this->patchJson("/api/v1/catalog/products/CUS-GAS-EXP/accommodation/legs/{$limaId}/hotels/{$hotelId}", ['room_types' => [['room_type' => 'Doble', 'capacity' => 2, 'price_per_night' => 90]]], critical(bkLock('CUS-GAS-EXP')))->assertOk();
    $this->patchJson("/api/v1/catalog/products/CUS-GAS-EXP/accommodation/legs/{$cuscoId}", ['nights' => 3], critical())->assertOk();
    $this->postJson('/api/v1/catalog/products/CUS-GAS-EXP/accommodation/legs/reorder', ['ids' => [$cuscoId, $limaId]], critical())->assertOk()->assertJsonPath('data.legs.0.city', 'Cusco');
    expect(bkAudit('CUS-GAS-EXP', 'hotel_modificar'))->toBeTrue()
        ->and(bkAudit('CUS-GAS-EXP', 'tramo_reordenar'))->toBeTrue();

    $this->deleteJson("/api/v1/catalog/products/CUS-GAS-EXP/accommodation/legs/{$limaId}/hotels/{$hotelId}", [], critical())->assertNoContent();
    $this->deleteJson("/api/v1/catalog/products/CUS-GAS-EXP/accommodation/legs/{$limaId}", [], critical())->assertNoContent();
    expect(bkAudit('CUS-GAS-EXP', 'hotel_eliminar'))->toBeTrue()
        ->and(bkAudit('CUS-GAS-EXP', 'tramo_eliminar'))->toBeTrue()
        ->and(bkRows('catalog_accommodation_legs', 'CUS-GAS-EXP'))->toHaveCount(1);

    $this->putJson('/api/v1/catalog/products/CUS-GAS-EXP/accommodation', ['enabled' => false], critical())->assertOk()->assertJsonPath('data.enabled', false)->assertJsonCount(1, 'data.legs');
    expect(bkAudit('CUS-GAS-EXP', 'alojamiento_desactivar'))->toBeTrue();
});

it('guarda la política de pago, el pagar después como ajuste de la regla y la restablece', function () {
    actingAsSeed('U01');

    $this->putJson('/api/v1/catalog/products/CUS-GAS-EXP/payment-policy', ['modes' => []], critical())->assertStatus(422)->assertJsonValidationErrors('modes');
    $this->putJson('/api/v1/catalog/products/CUS-GAS-EXP/payment-policy', ['modes' => ['total', 'adelanto'], 'deposit_pct' => 100], critical())->assertStatus(422)->assertJsonValidationErrors('deposit_pct');

    $saved = $this->putJson('/api/v1/catalog/products/CUS-GAS-EXP/payment-policy', ['modes' => ['adelanto'], 'deposit_pct' => 40, 'balance_due_days' => 20, 'note' => 'Saldo antes del viaje', 'pay_later_enabled' => false], critical(bkLock('CUS-GAS-EXP')))->assertOk();
    expect($saved->json('data.values.deposit_pct'))->toBe(40)
        ->and($saved->json('data.effective_modes'))->toBe(['adelanto'])
        ->and(bkAudit('CUS-GAS-EXP', 'politica_pago'))->toBeTrue();

    $example = collect($this->getJson('/api/v1/catalog/products/CUS-GAS-EXP/booking-config')->json('data.examples.payment'))->firstWhere('mode', 'adelanto');
    expect($example['deposit_pct'])->toBe(40);

    $this->deleteJson('/api/v1/catalog/products/CUS-GAS-EXP/payment-policy', [], critical())->assertNoContent();
    expect(bkRows('catalog_payment_policies', 'CUS-GAS-EXP'))->toBe([]);
});

it('guarda la operación y el recojo, exige un punto si es obligatorio y aplica a Operaciones', function () {
    actingAsSeed('U05');

    $this->putJson('/api/v1/catalog/products/CUS-GAS-EXP/operation', ['operating_weekdays' => []], critical())->assertStatus(422)->assertJsonValidationErrors('operating_weekdays');
    $this->putJson('/api/v1/catalog/products/CUS-GAS-EXP/operation', ['operating_weekdays' => [1, 2, 3, 4, 5], 'cutoff_hours' => 48], critical(bkLock('CUS-GAS-EXP')))->assertOk()
        ->assertJsonPath('data.operating_weekdays', [1, 2, 3, 4, 5])
        ->assertJsonPath('data.cutoff_hours', 48);
    expect(bkAudit('CUS-GAS-EXP', 'disponibilidad_operacion'))->toBeTrue();

    expect($this->putJson('/api/v1/catalog/products/CUS-GAS-EXP/pickup', ['required' => true, 'points' => []], critical()))->toBeApiError(422, 'CAT-PK-01');
    expect($this->putJson('/api/v1/catalog/products/CUS-GAS-EXP/pickup', ['required' => true, 'points' => [['label' => 'Plaza de Armas'], ['label' => 'plaza de armas']]], critical()))->toBeApiError(422, 'CAT-PK-01');
    $this->putJson('/api/v1/catalog/products/CUS-GAS-EXP/pickup', ['required' => true, 'ask_flight' => true, 'points' => [['label' => 'Aeropuerto de Cusco'], ['label' => 'Hotel en el Centro Histórico'], ['label' => 'Plaza Regocijo', 'kind' => 'punto_encuentro']]], critical())->assertOk()
        ->assertJsonPath('data.required', true)
        ->assertJsonPath('data.points.0.kind', 'aeropuerto')
        ->assertJsonPath('data.points.1.requires_address', true);
    expect(bkAudit('CUS-GAS-EXP', 'recojo'))->toBeTrue();

    expect($this->putJson('/api/v1/catalog/products/CUS-GAS-EXP/pax-rules', bkPax(), critical()))->toBeApiError(403)
        ->and($this->postJson('/api/v1/catalog/products/CUS-GAS-EXP/addons', ['name' => 'Algo'], critical()))->toBeApiError(403);
});

it('ajusta reglas por producto sin activar una regla apagada en la agencia ni tocar reglas solo de la agencia', function () {
    actingAsSeed('U01');

    expect($this->putJson('/api/v1/catalog/products/CUS-GAS-EXP/rule-overrides/R-HOLD', ['enabled' => false], critical()))->toBeApiError(422, 'CAT-RL-01');

    $this->putJson('/api/v1/catalog/products/CUS-GAS-EXP/rule-overrides/R-ADDONS', ['enabled' => false], critical(bkLock('CUS-GAS-EXP')))->assertOk();
    $config = $this->getJson('/api/v1/catalog/products/CUS-GAS-EXP/booking-config')->json('data');
    expect($config['sections']['adicionales']['status'])->toBe('product_off')
        ->and(bkAudit('CUS-GAS-EXP', 'regla_producto'))->toBeTrue();

    $this->putJson('/api/v1/catalog/products/CUS-GAS-EXP/rule-overrides/R-SINGLE-SUPP', ['enabled' => true], critical())->assertOk();
    $single = collect($this->getJson('/api/v1/catalog/products/CUS-GAS-EXP/rule-overrides')->json('data'))->firstWhere('code', 'R-SINGLE-SUPP');
    expect($single['tenant_enabled'])->toBeFalse()->and($single['effective'])->toBeFalse();

    $this->putJson('/api/v1/catalog/products/CUS-GAS-EXP/rule-overrides/R-GROUP-DISC', ['params' => ['pct' => 150]], critical())->assertStatus(422)->assertJsonValidationErrors('params.pct');
    $this->putJson('/api/v1/catalog/products/CUS-GAS-EXP/rule-overrides/R-GROUP-DISC', ['params' => ['pct' => 8]], critical())->assertOk();
    $group = collect($this->getJson('/api/v1/catalog/products/CUS-GAS-EXP/rule-overrides')->json('data'))->firstWhere('code', 'R-GROUP-DISC');
    expect($group['own_params'])->toBe(['pct' => 8])
        ->and(bkAudit('CUS-GAS-EXP', 'regla_parametros'))->toBeTrue();

    $this->deleteJson('/api/v1/catalog/products/CUS-GAS-EXP/rule-overrides/R-ADDONS', [], critical())->assertNoContent();
    expect($this->getJson('/api/v1/catalog/products/CUS-GAS-EXP/booking-config')->json('data.sections.adicionales.status'))->toBe('on')
        ->and(bkAudit('CUS-GAS-EXP', 'regla_restablecer'))->toBeTrue()
        ->and($this->deleteJson('/api/v1/catalog/products/CUS-GAS-EXP/rule-overrides/R-ADDONS', [], critical()))->toBeApiError(404);
});

it('bloquea la escritura con versión vieja, en productos archivados y para Ventas', function () {
    actingAsSeed('U01');
    $stale = bkLock('CUS-GAS-EXP') - 1;

    expect($this->putJson('/api/v1/catalog/products/CUS-GAS-EXP/operation', ['operating_weekdays' => [1], 'lock_version' => $stale], critical($stale)))->toBeApiError(409, 'STALE_VERSION');

    withinTenant(tenantA(), fn () => DB::table('catalog_products')->where('code', 'CUS-VIN-FD')->update(['status' => 'ARCHIVED']));
    expect($this->putJson('/api/v1/catalog/products/CUS-VIN-FD/pickup', ['required' => false], critical()))->toBeApiError(409, 'PRD-ARCHIVED');

    actingAsSeed('U03');
    $this->getJson('/api/v1/catalog/products/CUS-GAS-EXP/booking-config')->assertOk()->assertJsonPath('data.can.update', false);
    expect($this->putJson('/api/v1/catalog/products/CUS-GAS-EXP/payment-policy', ['modes' => ['total']], critical()))->toBeApiError(403)
        ->and($this->putJson('/api/v1/catalog/products/CUS-GAS-EXP/rule-overrides/R-ADDONS', ['enabled' => false], critical()))->toBeApiError(403)
        ->and($this->putJson('/api/v1/catalog/products/CUS-GAS-EXP/accommodation', ['enabled' => false], critical()))->toBeApiError(403);
});

it('quita una tarifa sin uso desde el producto y rechaza quitar una ya cotizada', function () {
    actingAsSeed('U01');
    $created = $this->postJson('/api/v1/catalog/products/CUS-GAS-EXP/rates', ['rate_type' => 'Venta', 'segment' => 'Niño', 'channel' => 'Directo', 'currency' => 'PEN', 'cost' => 50, 'price' => 120, 'min_price' => 100, 'max_price' => 150, 'conditions' => 'Solo fines de semana', 'valid_from' => BUSINESS_TODAY, 'valid_to' => '2026-12-31'], critical())->assertCreated();
    $ref = $created->json('data.ref');
    $editor = collect($this->getJson('/api/v1/catalog/products/CUS-GAS-EXP/editor')->json('data.rates'))->firstWhere('ref', $ref);
    expect($editor['min_price'])->toBe('100.00')->and($editor['conditions'])->toBe('Solo fines de semana');

    $this->deleteJson("/api/v1/catalog/products/CUS-GAS-EXP/rates/{$ref}", [], critical())->assertNoContent();
    expect(rowOf('catalog_rates', $ref, column: 'ref'))->toBeNull()
        ->and(withinTenant(tenantA(), fn () => DB::table('audit_events')->where('entity', 'Tarifa')->where('entity_id', $ref)->where('action', 'eliminar')->exists()))->toBeTrue();

    $quoted = $this->postJson('/api/v1/catalog/products/CUS-GAS-EXP/rates', ['rate_type' => 'Venta', 'segment' => 'Grupo', 'channel' => 'Directo', 'currency' => 'PEN', 'cost' => 50, 'price' => 160, 'valid_from' => BUSINESS_TODAY, 'valid_to' => '2026-12-31'], critical())->assertCreated()->json('data.ref');
    withinTenant(tenantA(), fn () => DB::table('quote_items')->where('id', DB::table('quote_items')->value('id'))->update(['rate_id' => rowOf('catalog_rates', $quoted, column: 'ref')->id]));
    expect($this->deleteJson("/api/v1/catalog/products/CUS-GAS-EXP/rates/{$quoted}", [], critical()))->toBeApiError(409, 'CAT-RATE-IN-USE')
        ->and($this->deleteJson('/api/v1/catalog/products/CUS-GAS-EXP/rates/TAR-NOPE', [], critical()))->toBeApiError(404);
});
