<?php

use Database\Seeders\Modules\TripBuilderSeeder;
use Illuminate\Support\Facades\DB;

require_once __DIR__.'/TramosHelpers.php';

const TRAMOS_PRODUCT = 'PER-CIR-10D';

function tramosTrip(): array
{
    return test()->getJson('/api/v1/catalog/products/PER-CIR-10D/trip')->assertOk()->json('data');
}

function tramosLeg(string $code): array
{
    return collect(tramosTrip()['legs'])->firstWhere('code', $code);
}

function tramosHotel(string $code): array
{
    return collect(tramosTrip()['legs'])->pluck('hotels')->flatten(1)->firstWhere('code', $code);
}

beforeEach(fn () => actingAsSeed('U01'));

it('el seeder deja PRD-011 con noches por ciudad, temporadas, tours y movilidad', function () {
    withinTenant(tenantA(), fn () => (new TripBuilderSeeder(tenantA()))->run());
    $trip = tramosTrip();
    $arequipa = collect($trip['legs'])->firstWhere('code', 'LEG-2');

    expect($trip['legs'])->toHaveCount(4)
        ->and($arequipa['min_nights'])->toBe(1)
        ->and($arequipa['max_nights'])->toBe(4)
        ->and($trip['summary']['tours'])->toBe(8)
        ->and($trip['summary']['transport'])->toBe(8)
        ->and($trip['summary']['season_rates'])->toBeGreaterThan(0)
        ->and(collect($trip['transport'])->firstWhere('code', 'TR-AQP-PUN-P')['vehicles'])->toHaveCount(2)
        ->and($trip['rules']['trip_builder']['on'])->toBeTrue()
        ->and($trip['can']['update'])->toBeTrue();
});

it('TB-02: fija mínimo y máximo de noches con If-Match y rechaza un rango que no incluye las noches del tramo', function () {
    $leg = tramosLeg('LEG-4');
    $lock = (int) tramosTrip()['product']['lock_version'];

    $this->putJson("/api/v1/catalog/products/PER-CIR-10D/trip/legs/{$leg['id']}/nights", ['min_nights' => 2, 'max_nights' => 7], critical($lock))
        ->assertOk()->assertJsonPath('data.min_nights', 2)->assertJsonPath('data.max_nights', 7);

    expect($this->putJson("/api/v1/catalog/products/PER-CIR-10D/trip/legs/{$leg['id']}/nights", ['min_nights' => 5, 'max_nights' => 6], critical($lock + 1)))->toBeApiError(422, 'TB-02')
        ->and($this->putJson("/api/v1/catalog/products/PER-CIR-10D/trip/legs/{$leg['id']}/nights", ['min_nights' => 2, 'max_nights' => 6], critical($lock)))->toBeApiError(409)
        ->and(tramosAudited(['entity' => 'Producto', 'entity_id' => TRAMOS_PRODUCT, 'action' => 'tramo_noches']))->toBeTrue();
});

it('TB-03: crea y borra temporadas del hotel y rechaza fechas que se cruzan', function () {
    $hotel = tramosHotel('H-AQP-3');

    $created = $this->postJson("/api/v1/catalog/hotels/{$hotel['id']}/season-rates", ['label' => 'Fiesta de la Virgen de Chapi', 'date_from' => '2027-04-28', 'date_to' => '2027-05-02', 'adjust_pct' => 15], critical())
        ->assertCreated()->json('data');

    expect($this->getJson("/api/v1/catalog/hotels/{$hotel['id']}/season-rates")->assertOk()->json('data'))->toHaveCount(1)
        ->and($this->postJson("/api/v1/catalog/hotels/{$hotel['id']}/season-rates", ['label' => 'Cruce', 'date_from' => '2027-05-01', 'date_to' => '2027-05-10', 'adjust_pct' => 10], critical()))->toBeApiError(409, 'TB-03')
        ->and($this->postJson("/api/v1/catalog/hotels/{$hotel['id']}/season-rates", ['label' => 'Fuera de rango', 'date_from' => '2027-06-01', 'date_to' => '2027-06-02', 'adjust_pct' => 400], critical()))->toBeApiError(422);

    $this->deleteJson("/api/v1/catalog/hotels/{$hotel['id']}/season-rates/{$created['id']}", [], critical())->assertNoContent();

    expect($this->getJson("/api/v1/catalog/hotels/{$hotel['id']}/season-rates")->json('data'))->toBe([])
        ->and(tramosAudited(['entity' => 'Producto', 'action' => 'temporada_hotel_eliminar']))->toBeTrue();
});

it('crea, edita y desactiva un tour de un tramo', function () {
    $leg = tramosLeg('LEG-3');

    $tour = $this->postJson('/api/v1/catalog/products/PER-CIR-10D/trip/tours', [
        'leg_id' => $leg['id'], 'name' => 'Isla Taquile al atardecer', 'day_offset' => 1, 'start_time' => '15:00', 'duration_hours' => 3,
        'currency' => 'USD', 'price_adult' => 38, 'price_child' => 20, 'capacity' => 12, 'in_trip_sale' => true,
    ], critical())->assertCreated()->json('data');

    $updated = $this->patchJson("/api/v1/catalog/products/PER-CIR-10D/trip/tours/{$tour['id']}", ['price_adult' => 42, 'active' => false], critical())->assertOk()->json('data');

    expect($tour['code'])->toStartWith('TT-')
        ->and($tour['city'])->toBe('Puno')
        ->and($updated['price_adult'])->toBe('42.00')
        ->and($updated['active'])->toBeFalse()
        ->and(tramosAudited(['entity' => 'Producto', 'action' => 'tour_tramo_desactivar']))->toBeTrue()
        ->and($this->postJson('/api/v1/catalog/products/PER-CIR-10D/trip/tours', ['leg_id' => $leg['id'], 'name' => 'Sin precio'], critical()))->toBeApiError(422);
});

it('TB-05: crea movilidad por vehículo con sus vehículos, la edita y exige precio cuando es por pasajero', function () {
    $from = tramosLeg('LEG-4');

    $option = $this->postJson('/api/v1/catalog/products/PER-CIR-10D/trip/transport', [
        'from_leg_id' => $from['id'], 'mode' => 'traslado', 'name' => 'Traslado aeropuerto ↔ hotel en Cusco', 'pricing' => 'vehiculo', 'currency' => 'USD',
        'vehicles' => [['name' => 'Auto (1–3)', 'max_pax' => 3, 'price' => 25], ['name' => 'Van (4–10)', 'max_pax' => 10, 'price' => 45]],
    ], critical())->assertOk()->json('data');

    $edited = $this->patchJson("/api/v1/catalog/products/PER-CIR-10D/trip/transport/{$option['id']}", ['vehicles' => [['name' => 'Van (4–10)', 'max_pax' => 10, 'price' => 50]], 'in_trip_sale' => false], critical())->assertOk()->json('data');

    expect($option['scope'])->toBe('local')
        ->and($option['vehicles'])->toHaveCount(2)
        ->and($edited['vehicles'])->toHaveCount(1)
        ->and($edited['vehicles'][0]['price'])->toBe('50.00')
        ->and($edited['in_trip_sale'])->toBeFalse()
        ->and($this->postJson('/api/v1/catalog/products/PER-CIR-10D/trip/transport', ['from_leg_id' => $from['id'], 'to_leg_id' => tramosLeg('LEG-3')['id'], 'mode' => 'bus', 'name' => 'Bus sin precio', 'pricing' => 'pax', 'currency' => 'USD'], critical()))->toBeApiError(422, 'TB-05')
        ->and($this->postJson('/api/v1/catalog/products/PER-CIR-10D/trip/transport', ['from_leg_id' => $from['id'], 'mode' => 'vuelo', 'name' => 'Vuelo local', 'pricing' => 'pax', 'price_adult' => 10, 'currency' => 'USD'], critical()))->toBeApiError(422, 'TB-06')
        ->and(tramosAudited(['entity' => 'Producto', 'action' => 'movilidad_modificar']))->toBeTrue();
});

it('sin catalog.products.update no se editan tramos y el 403 dice qué permiso falta', function () {
    actingAsSeed('U07');
    $leg = withinTenant(tenantA(), fn () => DB::table('catalog_accommodation_legs as l')->join('catalog_products as p', 'p.id', '=', 'l.product_id')->where('p.code', TRAMOS_PRODUCT)->where('l.code', 'LEG-3')->value('l.id'));

    $response = $this->postJson('/api/v1/catalog/products/PER-CIR-10D/trip/tours', ['leg_id' => $leg, 'name' => 'X', 'start_time' => '09:00', 'duration_hours' => 2, 'currency' => 'USD', 'price_adult' => 10], critical());

    expect($response)->toBeApiError(403)
        ->and($response->json('required_permissions'))->not->toBeEmpty();
});
